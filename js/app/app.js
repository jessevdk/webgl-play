/*
 * Copyright (c) 2014 Jesse van den Kieboom. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 *      copyright notice, this list of conditions and the following disclaimer
 *      in the documentation and/or other materials provided with the
 *      distribution.
 *    * Neither the name of Google Inc. nor the names of its
 *      contributors may be used to endorse or promote products derived from
 *      this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var Editor = require('./editor');
var Document = require('./document'); // jshint ignore:line
var ui = require('../ui/ui');
var glsl = require('../glsl/glsl');
var Store = require('./store');
var Renderer = require('./renderer');
var Signals = require('../signals/signals');
var marked = require('../vendor/marked');
var utils = require('../utils/utils');

require('./js-mode');

var defaultSettings = {
    author: null,
    license: null
};

var licenseDescriptions = {
    'CC 0': 'No Attribution',
    'CC BY': 'Attribution: This license lets others distribute, remix, tweak, and build upon your work, even commercially, as long as they credit you for the original creation. This is the most accommodating of licenses offered. Recommended for maximum dissemination and use of licensed materials.',
    'CC BY-NC': 'Attribution, Non Commercial: This license lets others remix, tweak, and build upon your work non-commercially, and although their new works must also acknowledge you and be non-commercial, they don’t have to license their derivative works on the same terms.',
    'CC BY-SA': 'Attribution, Share Alike: This license lets others remix, tweak, and build upon your work even for commercial purposes, as long as they credit you and license their new creations under the identical terms. This license is often compared to “copyleft” free and open source software licenses. All new works based on yours will carry the same license, so any derivatives will also allow commercial use. This is the license used by Wikipedia, and is recommended for materials that would benefit from incorporating content from Wikipedia and similarly licensed projects.',
    'CC BY-NC-SA': 'Attribution, Non Commercial, Share Alike: This license lets others remix, tweak, and build upon your work non-commercially, as long as they credit you and license their new creations under the identical terms.'
};

marked.setOptions({
    sanitize: true,
    smartypants: true
});

function App() {
    Signals.call(this);

    this.document = null;

    this._onDocumentChanged = this.registerSignal('notify::document');
    this._lastFocus = null;
    this._mode = null;

    this.settings = utils.merge({}, defaultSettings);

    window.addEventListener('error', (function(e) {
        var error = e.error;

        if (error.originalStack) {
            this._handleJsError(error);

            e.preventDefault();
            e.stopPropagation();
            return true;
        }
    }).bind(this));

    if (document.readyState === 'complete') {
        this._init();
    } else {
        document.addEventListener('DOMContentLoaded', this._init.bind(this));
    }
}

App.prototype = Object.create(Signals.prototype);
App.prototype.constructor = App;

App.prototype.find = function(elems) {
    var ret = {};

    for (var k in elems) {
        ret[k] = document.querySelector(elems[k]);
    }

    return ret;
};

App.prototype.newDocument = function(cb) {
    var doc = new Document(this);

    this.loadDocument(doc, {}, (function() {
        this._saveCurrentDoc();

        if (cb) {
            cb();
        }
    }).bind(this));
};

App.prototype.loadDocument = function(doc, options, cb) {
    if (doc === null) {
        this.newDocument(cb);
        return;
    }

    if (!Document.prototype.isPrototypeOf(doc)) {
        doc = Document.deserialize(doc);
    }

    this._loadDoc(doc, options, cb);
};

App.prototype._extractJsErrorLoc = function(e) {
    var stack;

    stack = e.originalStack || e.stack;
    var lines = stack.split('\n');

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Chrome
        var anon = /, <anonymous>:([0-9]+):([0-9]+)\)$/;
        var m = line.match(anon);

        if (m) {
            return {
                line: parseInt(m[1]) - 1,
                column: parseInt(m[2])
            };
        }

        // Firefox
        var func = /> Function:([0-9]+):([0-9]+)$/;
        m = line.match(func);

        if (m) {
            return {
                line: parseInt(m[1]),
                column: parseInt(m[2])
            };
        }
    }

    return null;
};

App.prototype._handleJsError = function(e) {
    var message = e.message;
    var loc = this._extractJsErrorLoc(e);

    if (loc) {
        this.jsEditor.runtimeError({
            message: message,
            location: loc
        });
    } else {
        console.error(e.stack);
    }
};

App.prototype._updateRenderer = function() {
    var ret = this.renderer.update(this.document);

    var i, p;

    if (typeof ret === 'undefined') {
        var c = {
            c: this.renderer.context,
            Math: Math
        };

        if (this.renderer.program) {
            c.this = this.renderer.program;
        }

        this.jsEditor.completionContext(c);

        for (i = 0; i < this.document.programs.length; i++) {
            p = this.document.programs[i];
            p.error(null);
        }
    } else {
        var e = null;

        if (ret.js.extensions !== null) {
            e = ret.js.extensions;
        } else if (ret.js.init !== null) {
            e = ret.js.init;
        } else if (ret.js.run !== null) {
            e = ret.js.run;
        }

        if (e !== null) {
            this._handleJsError(e);
        }

        for (i = 0; i < this.document.programs.length; i++) {
            p = this.document.programs[i];
            var name = p.name();

            if (ret.programs !== null && name in ret.programs) {
                p.error(ret.programs[name]);
            } else {
                p.error(null);
            }
        }
    }
};

App.prototype._updateEditors = function() {
    var up = {};

    var names = ['vertex', 'fragment', 'js'];

    for (var i = 0; i < names.length; i++) {
        var editor = this[names[i] + 'Editor'];

        up[names[i]] = {
            data: editor.value(),
            history: editor.history()
        };
    }

    this._updateDocumentBy(up);
};

App.prototype._onDocumentBeforeActiveProgramChanged = function() {
    this._updateEditors();
};

App.prototype._onDocumentActiveProgramChanged = function() {
    var prg = this.document.activeProgram();

    var loading = this._loading;
    this._loading = true;

    this.vertexEditor.value(prg.vertex.data);
    this.vertexEditor.history(prg.vertex.history);

    this.fragmentEditor.value(prg.fragment.data);
    this.fragmentEditor.history(prg.fragment.history);

    this._loading = loading;
    this._saveCurrentDocWithDelay();
};

App.prototype._onDocumentTitleChanged = function() {
    this.title.textContent = this.document.title;
};

App.prototype._loadDocReal = function(doc, options) {
    options = utils.merge({
        preventPushState: false,
        showInfo: false
    }, options);

    if (this.document !== null) {
        this.document.off('notify-before::active-program', this._onDocumentBeforeActiveProgramChanged, this);
        this.document.off('notify::active-program', this._onDocumentActiveProgramChanged, this);
        this.document.off('notify::title', this._onDocumentTitleChanged, this);

        this.document.off('changed', this._onDocumentChanged, this);
    }

    this.document = doc;

    this._onDocumentActiveProgramChanged();

    this.jsEditor.value(doc.js.data);
    this.jsEditor.history(doc.js.history);

    if (doc.activeEditor !== null) {
        var editor = null;

        switch (doc.activeEditor.name) {
        case 'js':
            editor = this.jsEditor;
            break;
        case 'vertex':
            editor = this.vertexEditor;
            break;
        case 'fragment':
            editor = this.fragmentEditor;
            break;
        }

        if (editor !== null) {
            editor.focus();
            editor.cursor(doc.activeEditor.cursor);
        }
    } else {
        this.canvas.focus();
    }

    this.title.textContent = doc.title;

    if (doc.state && doc.state.panels) {
        for (var k in doc.state.panels) {
            var p = doc.state.panels[k];
            this.panels[k].position(p.position);
        }

        this._updateCanvasSize();
    }

    this._loading = false;
    this._updateRenderer();

    this.document.on('notify-before::active-program', this._onDocumentBeforeActiveProgramChanged, this);
    this.document.on('notify::active-program', this._onDocumentActiveProgramChanged, this);
    this.document.on('notify::title', this._onDocumentTitleChanged, this);
    this.document.on('changed', this._onDocumentHasChanged, this);

    var st = {
        mode: 'document'
    };

    if (doc.id) {
        st.id = doc.id;
    }

    var url;

    if (doc.share) {
        st.share = doc.share;
        url = global.Settings.frontend.dataQuery(doc.share);
    } else {
        url = global.Settings.frontend.url('');
    }

    if (!this._isLocal()) {
        if (!options.preventPushState) {
            global.history.pushState(st, doc.title, url);
        } else {
            global.history.replaceState(st, doc.title, url);
        }
    }

    this._onDocumentChanged();

    this.content.classList.add('loaded');
    this.content.classList.remove('loading');

    this._showDocument();

    if (options.showInfo) {
        this._showInfoPopup();
    }
};

App.prototype._loadDoc = function(doc, options, cb) {
    this._loading = true;

    if (this.document !== null) {
        this.content.classList.remove('loaded');
        this.content.classList.add('loading');

        setTimeout((function() {
            this._loadDocReal(doc, options);

            if (cb) {
                cb();
            }
        }).bind(this), 200);
    } else {
        this._loadDocReal(doc, options);

        if (cb) {
            cb();
        }
    }
};

App.prototype._onDocumentHasChanged = function(doc, opts) {
    this._saveCurrentDocWithDelay((function() {
        if ('vertex' in opts || 'fragment' in opts || 'js' in opts || 'programs' in opts) {
            this._updateRenderer();
        }
    }).bind(this));
};

App.prototype._serializeDocument = function(doc) {
    var ret = doc.serialize();

    ret.state = {
        panels: {}
    };

    for (var k in this.panels) {
        ret.state.panels[k] = {
            position: this.panels[k].position()
        };
    }

    return ret;
};

App.prototype._saveDoc = function(doc, cb) {
    if (this.document === null) {
        if (typeof cb === 'function') {
            cb(true);
        }

        return;
    }

    this._store.save(this._serializeDocument(doc), function(store, retdoc) {
        if (retdoc !== null) {
            doc.id = retdoc.id;
        }

        if (typeof cb === 'function') {
            cb(retdoc !== null);
        }
    });
};

App.prototype._saveCurrentDoc = function(cb) {
    this._saveDoc(this.document, cb);
};

App.prototype._saveCurrentDocWithDelay = function(cb) {
    if (this.document === null) {
        if (typeof cb === 'function') {
            cb(true);
        }

        return;
    }

    var doc = this.document;

    if (this._saveTimeout !== 0) {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = 0;
    }

    this._saveTimeout = setTimeout((function() {
        this._saveTimeout = 0;

        if (doc === this.document) {
            this._saveCurrentDoc(cb);
        }
    }).bind(this), 500);
};

App.prototype._updateCanvasSize = function() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
};

App.prototype._initPanels = function() {
    var panels = document.querySelectorAll('.panel');

    this.panels = {};

    for (var i = 0; i < panels.length; i++) {
        var p = panels[i];

        this.panels[p.id] = new ui.Panel(p);
    }

    this.panels['panel-programs'].on('resized', (function() {
        this.vertexEditor.editor.refresh();
        this.fragmentEditor.editor.refresh();
        this.jsEditor.editor.refresh();
        this._updateCanvasSize();
    }).bind(this));

    this.panels['panel-main'].on('resized', (function() {
        this.vertexEditor.editor.refresh();
        this.fragmentEditor.editor.refresh();
        this.jsEditor.editor.refresh();
        this._updateCanvasSize();
    }).bind(this));

    this.panels['panel-program'].on('resized', (function() {
        this.vertexEditor.editor.refresh();
        this.fragmentEditor.editor.refresh();
    }).bind(this));

    this.panels['panel-js'].on('resized', (function() {
        this.jsEditor.editor.refresh();
        this._updateCanvasSize();
    }).bind(this));
};

App.prototype._updateDocumentBy = function(opts) {
    if (this._loading) {
        return;
    }

    this.document.update(opts);
};

App.prototype._updateDocument = function(name, editor) {
    if (this._loading) {
        return;
    }

    var up = {};

    up[name] = {
        data: editor.value(),
        history: editor.history()
    };

    this._updateDocumentBy(up);
};

App.prototype._initCanvas = function() {
    this.canvas = document.getElementById('view');

    var t = this.canvas.parentElement.querySelector('.editor-title');

    this.canvas.addEventListener('focus', (function() {
        t.classList.add('hidden');
        this._updateDocumentBy({activeEditor: null});

        this._lastFocus = this.canvas;
    }).bind(this, t));

    this.canvas.addEventListener('blur', (function() {
        t.classList.remove('hidden');
    }).bind(this, t));

    window.addEventListener('resize', (function() {
        this._updateCanvasSize();
    }).bind(this));

    this.renderer = new Renderer(this.canvas, document.getElementById('content'));

    this.renderer.on('notify::first-frame', (function(r, frame) {
        this.document.update({
            screenshot: frame
        });
    }).bind(this));

    this.renderer.on('notify::fullscreen', (function() {
        this._updateCanvasSize();
    }).bind(this));

    this.renderer.on('error', (function(r, type, e) {
        switch (type) {
        case 'js':
            this._handleJsError(e);
            break;
        case 'program':
            for (var i = 0; i < this.document.programs.length; i++) {
                var p = this.document.programs[i];

                if (p.name() === e.program) {
                    p.error(e.errors);
                }
            }

            break;
        }
    }).bind(this));
};

App.prototype._initEditors = function() {
    var elems = this.find({
        vertex: '#vertex-editor',
        fragment: '#fragment-editor',
        js: '#js-editor'
    });

    var opts = {
        theme: 'default webgl-play',
        indentUnit: 4,
        lineNumbers: true,
        rulers: [78]
    };

    for (var k in elems) {
        var tname = k + 'Editor';
        var elem = elems[k];

        this[tname] = global.CodeMirror(elem, opts);

        var p = elem.parentElement;
        var t = p.querySelector('.editor-title');

        this[tname].on('focus', (function(title, k, tname) {
            title.classList.add('hidden');

            this._updateDocumentBy({
                activeEditor: {
                    name: k,
                    cursor: this[tname].cursor()
                }
            });

            this._lastFocus = elems[k];
        }).bind(this, t, k, tname));

        this[tname].on('blur', (function(title) {
            title.classList.remove('hidden');
        }).bind(this, t));
    }

    var ctx = this.renderer.context;

    this.vertexEditor = new Editor(this.vertexEditor, ctx, glsl.source.VERTEX);
    this.fragmentEditor = new Editor(this.fragmentEditor, ctx, glsl.source.FRAGMENT);
    this.jsEditor = new Editor(this.jsEditor, ctx, 'javascript');

    var editors = {
        'vertex': this.vertexEditor,
        'fragment': this.fragmentEditor,
        'js': this.jsEditor
    };

    for (var n in editors) {
        editors[n].editor.on('changes', (function(n) {
            this._updateDocument(n, editors[n]);
        }).bind(this, n));

        editors[n].editor.on('cursorActivity', (function(n) {
            this._updateDocumentBy({
                activeEditor: {
                    name: n,
                    cursor: editors[n].cursor()
                }
            });
        }).bind(this, n));
    }

    this._parsedTimeout = 0;
    this.vertexEditor.on('notify::parsed', this._onEditorParsed, this);
    this.fragmentEditor.on('notify::parsed', this._onEditorParsed, this);
};

App.prototype._onEditorParsed = function() {
    if (this._parsedTimeout !== 0) {
        clearTimeout(this._parsedTimeout);
    }

    this._parsedTimeout = setTimeout((function() {
        this._parsedTimeout = 0;

        if (this.vertexEditor.parsed !== null && this.fragmentEditor.parsed !== null) {
            var linker = new glsl.linker.Linker(this.vertexEditor.parsed, this.fragmentEditor.parsed);
            var errors = linker.link();

            this.vertexEditor.externalErrors(errors.vertex);
            this.fragmentEditor.externalErrors(errors.fragment);
        }
    }).bind(this), 50);
};

App.prototype.message = function(type, m, options) {
    options = utils.merge({
        canCancel: true
    }, options);

    var div = document.createElement('div');
    this._message = div;

    div.classList.add('message');

    if (type) {
        div.classList.add(type);
    }

    if (typeof m === 'string') {
        div.textContent = m;
    } else {
        div.appendChild(m);
    }

    var overlay = this._addOverlay();
    document.body.appendChild(div);

    var w = div.offsetWidth;
    var h = div.offsetHeight;

    div.style.left = ((document.body.offsetWidth - w) / 2) + 'px';
    div.style.top = ((document.body.offsetHeight - h) / 2) + 'px';

    var remover = (function() {
        if (options.canCancel) {
            window.removeEventListener('keydown', this._messageKeydown);
            window.removeEventListener('mousedown', this._messageMousedown);

            document.body.removeChild(overlay);
            document.body.removeChild(div);
        }
    }).bind(this);

    this._messageKeydown = (function(e) {
        if (e.keyCode === 27) {
            remover();
        }
    }).bind(this);

    this._messageMousedown = (function(e) {
        if (e.pageX < div.offsetLeft || e.pageX > div.offsetLeft + div.offsetWidth ||
            e.pageY < div.offsetTop || e.pageY > div.offsetTop + div.offsetHeight) {
            remover();
        }
    }).bind(this);

    window.addEventListener('keydown', this._messageKeydown);
    window.addEventListener('mousedown', this._messageMousedown);

    return remover;
};

App.prototype._createLicenseSwitch = function(license, authors) {
    var initial = license || 'CC BY';

    if (authors && authors.length > 0) {
        initial = authors[authors.length - 1].license;
    }

    var values = [
        { name: '0', value: 'CC 0' },
        { name: 'BY', value: 'CC BY' },
        { name: 'BY-NC', value: 'CC BY-NC' },
        { name: 'BY-SA', value: 'CC BY-SA' },
        { name: 'BY-NC-SA', value: 'CC BY-NC-SA' }
    ];

    if (authors && authors.length > 0) {
        var lastlic = authors[authors.length - 1].license;

        if (lastlic === 'CC BY-SA' || lastlic === 'CC BY-NC-SA') {
            /*for (var i = 0; i < values.length; i++) {
                if (values[i].value !== lastlic) {
                    values[i].sensitive = false;
                }
            }*/

            initial = lastlic;
        }
    }

    for (var i = 0; i < values.length; i++) {
        values[i].title = licenseDescriptions[values[i].value];
    }

    return new ui.MultiSwitch({
        values: values,
        value: initial
    });
};

App.prototype._showPublishDialog = function() {
    var w = ui.Widget.createUi;

    var licenseSwitch = this._createLicenseSwitch(this.document.license || this.settings.license, this.document.authors);
    var publishButton = new ui.Button('Publish');
    var requestTokenButton = new ui.Button('Request Token');

    var authorInput = w('input', { classes: 'author', type: 'text', value: (this.document.author || this.settings.author || '') });
    var tokenInput = w('input', { classes: ['token', 'empty'], value: 'E-mail address or token', type: 'text', size: 30 });

    var description = this.document.description;

    if (!description) {
        description = '*You cannot publish documents without a description. You can edit the description by clicking on the document title in the main view*';
        publishButton.sensitive(false);
        requestTokenButton.sensitive(false);
    }

    var desc = marked(description);
    var tokenval = '';

    tokenInput.addEventListener('focus', (function() {
        tokenInput.classList.remove('empty');
        tokenInput.value = tokenval;
    }).bind(this));

    tokenInput.addEventListener('blur', (function() {
        tokenval = tokenInput.value;

        if (!tokenval) {
            tokenInput.value = 'E-mail address or token';
            tokenInput.classList.add('empty');
        }
    }).bind(this));

    var status = w('div', { classes: 'status' });

    var errorStatus = function(m, e) {
        status.classList.add('error');
        status.textContent = m;

        if (e) {
            e.focus();
            var f;

            f = function() {
                e.removeEventListener('input', f);
                e.removeEventListener('change', f);
                e.removeEventListener('blur', f);

                status.textContent = '';
                status.classList.remove('error');
            };

            e.addEventListener('input', f);
            e.addEventListener('change', f);
            e.addEventListener('blur', f);
        }
    };

    var okStatus = function(m) {
        status.classList.remove();
        status.textContent = m;
    };

    this.renderer.grabImage(300, 200, (function(screenshot) {
        var descDiv = w('div', { innerHTML: desc });

        if (!this.document.description) {
            descDiv.classList.add('empty');
        }

        var d = w('div', {
            classes: 'publish',
            children: [
                w('div', { classes: 'title', textContent: 'Publish document: ' + this.document.title }),
                w('div', { classes: 'description', textContent: 'Publishing stores the current document online and makes it available in the online gallery. Publishing a document requires a publishing token. You can request a new publishing token to be send by e-mail, or reuse a previously received token. To request a new token, enter your e-mail address in the Token field and press Request Token.'}),
                w('img', { classes: 'screenshot', src: screenshot }),
                w('div', { classes: 'contents', children:
                    w('table', { classes: 'contents', children: [
                        w('tr', { children: [
                            w('td', { textContent: 'Description:' }),
                            w('td', { classes: 'description', children: descDiv }),
                        ]}),

                        w('tr', { children: [
                            w('td', { textContent: 'Author:' }),
                            w('td', { children: authorInput }),
                        ]}),

                        w('tr', { children: [
                            w('td', { textContent: 'License, CC:' }),
                            licenseSwitch.e
                        ]}),

                        w('tr', { children: [
                            w('td', { textContent: 'Token:' }),
                            w('td', { children: tokenInput })
                        ]}),
                    ]}),
                }),
                w('div', { classes: 'actions', children: [
                    requestTokenButton.e,
                    publishButton.e,
                    status
                ] })
            ]
        });

        var rm = this.message('dialog', d);

        requestTokenButton.on('click', (function() {
            if (authorInput.value.length === 0) {
                errorStatus('Please provide an author name', authorInput);
                return;
            }

            if (tokenval.indexOf('@') === -1) {
                errorStatus('Please provide an e-mail address to send a new token to', tokenInput);
                return;
            }

            utils.post('g/new', {
                email: tokenInput.value,
                title: this.document.title,
                author: authorInput.value
            }, {
                success: function() {
                    okStatus('New request token has been sent and should arrive shortly');
                },

                error: function(req, e) {
                    errorStatus(e ? e.message : req.responseText);
                }
            });
        }).bind(this));

        var doc = this.document;

        publishButton.on('click', (function() {
            if (authorInput.value.length === 0) {
                errorStatus('Please provide an author name', authorInput);
                return;
            }

            if (!tokenval.match(/^[a-zA-Z]+$/)) {
                errorStatus('The specified token does not appear to be a valid token', tokenInput);
                return;
            }

            utils.post('g/update', {
                document: doc.remote(),
                author: authorInput.value,
                license: licenseSwitch.value(),
                screenshot: screenshot,
                token: tokenInput.value
            }, {
                success: (function(req, ret) {
                    if (doc !== this.document) {
                        return;
                    }

                    this.settings.license = licenseSwitch.value();
                    this.settings.author = authorInput.value;
                    this._store.saveAppSettings(this.settings);

                    this.document.license = licenseSwitch.value();
                    this.document.author = authorInput.value;
                    this._saveCurrentDocWithDelay();

                    // Update authors received from remote
                    this.document.authors = ret.document.authors;

                    // Make document shared
                    this._makeShared(ret.published.document);

                    rm();

                    this.message('ok', '\'' + doc.title + '\' has been successfully published in the gallery, thanks!');
                }).bind(this),

                error: (function(req, e) {
                    if (doc === this.document) {
                        errorStatus(e ? e.message : req.responseText);
                    }
                }).bind(this)
            });
        }).bind(this));
    }).bind(this));
};

App.prototype._showShareDialog = function() {
    var w = ui.Widget.createUi;

    var licenseSwitch = this._createLicenseSwitch(this.document.license || this.settings.license, this.document.authors);
    var shareButton = new ui.Button('Share');
    var authorInput = w('input', { classes: 'author', type: 'text', value: (this.document.author || this.settings.author || '') });

    var status = w('div', { classes: 'status' });

    var d = w('div', {
        classes: 'share',
        children: [
            w('div', { classes: 'title', textContent: 'Share document: ' + this.document.title }),
            w('table', { classes: 'contents', children: [
                w('tr', { classes: 'description', children: w('td', {
                    colspan: 2,
                    innerHTML: 'Sharing stores the current document online and makes it accessible by URL only.<br>The document will not appear in the online gallery.'
                }) } ),

                w('tr', { children: [
                    w('td', { textContent: 'Author:' }),
                    w('td', { children: authorInput }),
                ]}),

                w('tr', { children: [
                    w('td', { textContent: 'License, CC:' }),
                    licenseSwitch.e
                ]}),

                w('tr', { classes: 'actions', children: [
                    w('td', {
                        colspan: 2,
                        children: [
                            shareButton.e,
                            status
                        ]
                    }),
                ]})
            ]})
        ]
    });

    var rm = this.message('dialog', d);

    shareButton.on('click', (function() {
        var license = licenseSwitch.value();

        if (authorInput.value.length === 0 && license !== 'CC 0') {
            authorInput.focus();

            status.textContent = 'The selected license requires an author name to give credit';
            status.classList.add('error');

            return;
        }

        this.settings.license = license;
        this.settings.author = authorInput.value;
        this._store.saveAppSettings(this.settings);

        this.document.license = licenseSwitch.value();
        this.document.author = authorInput.value;
        this._saveCurrentDocWithDelay();

        rm();

        this._shareDocument(authorInput.value, licenseSwitch.value());
    }).bind(this));
};

App.prototype._onButtonShareClick = function() {
    this._showShareDialog();
};

App.prototype._onButtonPublishClick = function() {
    this._showPublishDialog();
};

App.prototype._showDocument = function() {
    if (this._mode === 'document') {
        return;
    }

    for (var i = 0; i < this.documentOnlyButtons.length; i++) {
        this.buttons[this.documentOnlyButtons[i]].sensitive(true);
    }

    this.main.classList.add('loaded');
    this.main.classList.remove('gallery');

    this._mode = 'document';
    localStorage.setItem('lastMode', 'document');

    if (!localStorage.getItem('firstVisited')) {
        localStorage.setItem('firstVisited', true);
        this._showIntro();
    }
};

App.prototype._galleryHasEmptyCellsInView = function(empties) {
    var y = this.gallery.scrollTop;
    var h = this.gallery.clientHeight;

    for (var i = 0; i < empties.length; i++) {
        var empty = empties[i];

        if (empty.offsetTop < y + h && empty.offsetTop + empty.offsetHeight > y) {
            return true;
        }
    }

    return false;
};

App.prototype._makeEmptyGalleryCells = function(table, nRows, nColumns) {
    var emptyCells = [];
    var w = ui.Widget.createUi;

    for (var r = 0; r < nRows; r++) {
        var tr = w('tr', {
            parent: table
        });

        for (var c = 0; c < nColumns; c++) {
            var div = w('div', {
                classes: 'gallery-item'
            });

            w('td', {
                parent: tr,
                children: div,
                classes: 'empty'
            });

            emptyCells.push(div);
        }
    }

    return emptyCells;
};

App.prototype._fillGalleryItem = function(container, item) {
    var w = ui.Widget.createUi;

    w('div', {
        classes: 'title',
        textContent: item.title,
        parent: container
    });

    var date = new Date(item.modificationDate);

    w('table', {
        classes: 'info',
        children: [
            w('tr', { children: [
                w('td', {
                    classes: 'screenshot',
                    children: w('img', {
                        src: global.Settings.backend.url('s/' + item.screenshot + '.png'),
                        parent: container
                    })
                }),

                w('td', { children: w('table', { classes: 'properties', children: [
                    w('tr', { children: [
                        w('td', { textContent: 'Author:' }),
                        w('td', { textContent: item.author })
                    ]}),
                    w('tr', { children: [
                        w('td', { textContent: 'License:' }),
                        w('td', { textContent: item.license, title: licenseDescriptions[item.license] })
                    ]}),
                    w('tr', { children: [
                        w('td', { textContent: 'Published:' }),
                        w('td', { textContent: this._relDate(date) })
                    ]}),
                    w('tr', { children: [
                        w('td', { textContent: 'Views:' }),
                        w('td', { textContent: item.views })
                    ]})
                ]})})
            ]})
        ],
        parent: container
    });

    var desc = marked(item.description);
    var div = document.createElement('div');
    div.innerHTML = desc;
    var shortDescription = div.querySelector('p');

    w('div', {
        classes: 'description',
        innerHTML: shortDescription.innerHTML,
        parent: container
    });

    container.addEventListener('click', (function() {
        this.loadRemoteDocument(item.document, (function(doc) {
            this.loadDocument(doc, { showInfo: true });

            var vkey = 'viewed:' + (item.parent ? item.parent : item.id);

            if (!localStorage.getItem(vkey)) {
                utils.post('g/' + item.parent + '/' + item.id + '/view');
                localStorage.setItem(vkey, true);
            }
        }).bind(this));
    }).bind(this));
};

App.prototype._isLocal = function() {
    return document.location.protocol.indexOf('file') === 0;
};

App.prototype._populateGallery = function() {
    // Clear previous gallery
    this.gallery.innerHTML = '';

    var w = ui.Widget.createUi;

    var table = w('table', {
        classes: 'gallery'
    });

    var colgroup = w('colgroup', { parent: table });

    // Estimate number of columns
    var width = this.content.clientWidth;
    var height = this.content.clientHeight;

    // These are just rough, conservative, estimates
    var pixPerCol = 550;
    var pixPerRow = 350;

    var nColumns = Math.max(1, Math.floor(width / pixPerCol));
    var nRows = Math.max(1, Math.ceil(height / pixPerRow));

    var maxBatchSize = 50;
    var maxRoundBatchSize = Math.floor(maxBatchSize / nColumns) * nColumns;

    var pageSize = nRows * nColumns;
    var pagePerBatch = 3;
    var batchSize = Math.min(maxRoundBatchSize, pagePerBatch * pageSize);

    nRows = batchSize / nColumns;

    var colWidth = (100 / nColumns) + '%';

    for (var i = 0; i < nColumns; i++) {
        var col = document.createElement('col');
        col.setAttribute('width', colWidth);
        colgroup.appendChild(col);
    }

    var cells = this._makeEmptyGalleryCells(table, nRows, nColumns);

    this.gallery.appendChild(table);

    var state = {
        populating: false,
        table: table,
        emptyCells: cells,
        pages: 0,
        pageSize: pageSize,
        pagePerBatch: pagePerBatch,
        batchSize: batchSize,
        nColumns: nColumns,
        nRows: nRows
    };

    var finalize = (function() {
        var trs = [];
        var i, tr;

        for (i = 0; i < state.emptyCells.length; i++) {
            var empty = state.emptyCells[i];
            var td = empty.parentNode;
            
            tr = td.parentNode;

            if (trs.indexOf(tr) === -1) {
                trs.push(tr);
            }

            tr.removeChild(td);
        }

        for (i = 0; i < trs.length; i++) {
            tr = trs[i];

            if (tr.childNodes.length === 0) {
                state.table.removeChild(tr);
            }
        }

        this._checkPopulateGallery = null;
    }).bind(this);

    this._checkPopulateGallery = (function(state) {
        // Check if we are looking at empty cells
        if (state.populating || !this._galleryHasEmptyCellsInView(state.emptyCells)) {
            return;
        }

        state.populating = true;

        // Ok, populate all the empty cells
        utils.getQuery('g', {
            page: state.pages,
            limit: state.batchSize
        }, {
            success: (function(req, ret) {
                if (this._mode !== 'gallery') {
                    return;
                }

                // Fill up to 'ret' empty cells
                for (var i = 0; i < ret.length; i++) {
                    this._fillGalleryItem(state.emptyCells[i], ret[i]);
                    state.emptyCells[i].parentNode.classList.remove('empty');
                }

                state.populating = false;

                if (ret.length < state.batchSize) {
                    var n = Math.ceil(ret.length / state.nColumns) * state.nColumns;
                    state.emptyCells = state.emptyCells.slice(n);

                    finalize();
                } else {
                    state.emptyCells = this._makeEmptyGalleryCells(state.table, state.nRows, state.nColumns);
                    this._checkPopulateGallery();
                }
            }).bind(this),

            error: (function(req, e) {
                if (this._mode !== 'gallery') {
                    return;
                }

                this.message('error', 'Error while requesting gallery: ' + (e ? e.message : req.responseText));
                finalize();
            }).bind(this)
        });
    }).bind(this, state);

    this._checkPopulateGallery();
};

App.prototype._showGallery = function(options) {
    if (this._mode === 'gallery') {
        return;
    }

    if (this._isLocal()) {
        // No gallery when running locally, but this is still called on initializing.
        // Instead, just show a new document
        this.newDocument();
        return;
    }

    options = utils.merge({
        preventPushState: false
    }, options);

    this._saveCurrentDoc((function() {
        for (var i = 0; i < this.documentOnlyButtons.length; i++) {
            this.buttons[this.documentOnlyButtons[i]].sensitive(false);
        }

        this.main.classList.add('loaded');
        this.main.classList.add('gallery');

        this.content.classList.add('loaded');
        this.content.classList.remove('loading');

        this.renderer.pause();

        this.document = null;
        this._mode = 'gallery';

        localStorage.setItem('lastMode', 'gallery');

        var st = {
            mode: 'gallery'
        };

        if (!this._isLocal()) {
            if (!options.preventPushState) {
                global.history.pushState(st, '',  global.Settings.frontend.url(''));
            } else {
                global.history.replaceState(st, '', global.Settings.frontend.url(''));
            }
        }

        this._populateGallery();

        if (!localStorage.getItem('firstVisited')) {
            localStorage.setItem('firstVisited', true);
            this._showIntro();
        }
    }).bind(this));
};

App.prototype._onButtonGalleryClick = function() {
    this._showGallery({
        preventPushState: false
    });
};

App.prototype._makeShared = function(share) {
    this._updateDocumentBy({
        share: share
    });

    var url = global.Settings.frontend.dataQuery(share);

    global.history.replaceState({
        mode: 'document',
        share: share
    }, '', url);

    // Return the full url
    return document.location.href;
};

App.prototype._shareDocument = function(author, license) {
    var doc = this.document;

    utils.post('d/new', {
        document: doc.remote(),
        author: author,
        license: license
    }, {
        success: (function(req, ret) {
            if (this.document === doc) {
                var url = this._makeShared(ret.hash);

                // Update document authors
                this.document.authors = ret.authors;
                this._saveCurrentDoc();

                var w = ui.Widget.createUi;

                var urle = w('span', {
                    textContent: url
                });

                var message = w('div', {
                    children: [
                        w('span', { textContent: 'Shared document at ' }),
                        urle
                    ]
                });

                this.message('ok', message);

                var selection = window.getSelection();
                var range = document.createRange();

                range.selectNodeContents(urle);

                selection.removeAllRanges();
                selection.addRange(range);
            }
        }).bind(this),

        error: (function(req, e) {
            if (this.document === doc) {
                this.message('error', 'Failed to upload document: ' + (e ? e.message : req.responseText));
            }
        }).bind(this)
    });
};

App.prototype._onButtonExportClick = function() {
    var saveas = require('../vendor/FileSaver');

    var blob = new Blob([JSON.stringify(this.document.remote(), undefined, 2)], {type: 'application/json;charset=utf-8'});
    saveas(blob, this.document.title + '.json');
};

App.prototype._initProgramsBar = function() {
    this.programsBar = new ui.ProgramsBar(document.getElementById('programs-sidebar'), this);
};

App.prototype._showOpenglPopup = function(popup) {
    var gl = this.renderer.context.gl;

    var exts = gl.getSupportedExtensions();
    exts.sort();

    for (var i = 0; i < exts.length; i++) {
        exts[i] = ui.Widget.createUi('div', {
            children: ui.Widget.createUi('a', {
                href: 'https://www.khronos.org/registry/webgl/extensions/' + exts[i],
                target: '_blank',
                textContent: exts[i]
            })
        });
    }

    var content = ui.Widget.createUi('table', {
        classes: 'opengl',
        children: [
            ui.Widget.createUi('tr', {
                children: [
                    ui.Widget.createUi('td', { textContent: 'Supported Extensions:' }),
                    ui.Widget.createUi('td', {
                        children: ui.Widget.createUi('div', {
                            classes: 'extensions',
                            children: exts
                        })
                    })
                ]
            })
        ]
    });

    var ext = gl.getExtension('WEBGL_debug_renderer_info');

    if (ext) {
        ui.Widget.createUi('tr', {
            children: [
                ui.Widget.createUi('td', { textContent: 'Vendor:' }),
                ui.Widget.createUi('td', { textContent: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) }),
            ],
            parent: content
        });

        ui.Widget.createUi('tr', {
            children: [
                ui.Widget.createUi('td', { textContent: 'Renderer:' }),
                ui.Widget.createUi('td', { textContent: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) }),
            ],
            parent: content
        });
    }

    popup.content(content);
};

App.prototype._showAboutPopup = function(cb) {
    var popup;

    var items = [
        { name: 'OpenGL Information', action: (function(popup) {
            this._showOpenglPopup(popup);
        }).bind(this) },
        { name: 'Source on Github', action: 'https://github.com/jessevdk/webgl-play' },
        { name: 'Issues on Github', action: 'https://github.com/jessevdk/webgl-play/issues' }
    ];

    var children = [];

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var li;

        if (typeof item.action === 'string') {
            var a = ui.Widget.createUi('a', {
                href: item.action,
                target: '_blank',
                textContent: item.name
            });

            a.addEventListener('click', function(e) {
                e.stopPropagation();
                popup.destroy();
            });

            li = ui.Widget.createUi('li', {
                children: a
            });

            li.addEventListener('click', (function(a) {
                a.click();
                popup.destroy();
            }).bind(this, a));
        } else {
            li = ui.Widget.createUi('li', {
                textContent: item.name
            });

            li.addEventListener('click', (function(action) {
                action(popup);
            }).bind(this, item.action));
        }

        children.push(li);
    }

    var content = ui.Widget.createUi('ul', {
        children: children,
        classes: 'about'
    });

    if (typeof global.Settings.hooks.about === 'function') {
        global.Settings.hooks.about(content);
    }

    popup = new ui.Popup(content, this.buttons.about.e);
    cb(popup);
};

App.prototype._initButtons = function() {
    var buttons = ['new', 'copy', 'export', 'models', 'open', 'about', 'gallery', 'share', 'publish'];

    this.buttons = {};

    this.documentOnlyButtons = [
        'copy',
        'export',
        'models',
        'share',
        'publish'
    ];

    for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var elem = document.getElementById('button-' + b);

        if (elem) {
            var button = new ui.Button({ wrap: elem });

            var eh = '_onButton' + b[0].toUpperCase() + b.slice(1) + 'Click';

            if (eh in this) {
                button.on('click', this[eh], this);
            }

            this.buttons[b] = button;
        }
    }

    ui.Popup.on(this.buttons.open, this._showOpenPopup.bind(this));
    ui.Popup.on(this.buttons.models, this._showModelsPopup.bind(this));
    ui.Popup.on(this.buttons.about, this._showAboutPopup.bind(this));
};

App.prototype._onButtonCopyClick = function() {
    var title = 'Copy of ' + this.document.title;

    var doc = Document.deserialize(this._serializeDocument(this.document));

    doc.id = null;
    doc.title = title;

    this.loadDocument(doc);
};

App.prototype._relDate = function(date) {
    var now = new Date();
    var t = (now - date) / 1000;

    var MINUTE = 60;
    var HOUR = MINUTE * 60;
    var DAY = HOUR * 24;

    if (t < 29.5 * MINUTE) {
        var mins = Math.round(t / MINUTE);

        if (mins === 0) {
            return 'less than a minute ago';
        } else if (mins === 1) {
            return 'a minute ago';
        } else {
            return mins + ' minutes ago';
        }
    } else if (t < 45 * MINUTE) {
        return 'half an hour ago';
    } else if (t < 23.5 * HOUR) {
        var hours = Math.round(t / HOUR);

        if (hours === 1) {
            return 'an hour ago';
        } else {
            return hours + ' hours ago';
        }
    } else if (t < 7 * DAY) {
        var days = Math.round(t / DAY);

        if (days === 1) {
            return 'a day ago';
        } else {
            return days + ' days ago';
        }
    } else {
        return 'on ' + date.toDateString();
    }
};

App.prototype._showModelsPopup = function(cb) {
    var popup;

    this._store.models((function(store, ret) {
        var w = ui.Widget.createUi;
        var content = w('div', { classes: 'models' });

        var li = w('li', {
            classes: 'import',
            innerHTML: 'Import&nbsp;from&nbsp;file',
            title: 'Import a model from a local file'
        });

        li.addEventListener('click', (function() {
            var inp = w('input', { type: 'file', multiple: 'multiple' });

            inp.onchange = (function() {
                var reader = new ui.FilesReader(inp.files);
                var msg;

                if (inp.files.length === 1) {
                    msg = 'Importing 1 model from file';
                } else {
                    msg = 'Importing ' + inp.files.length + ' models from files';
                }

                var but = new ui.Button({
                    value: 'Close'
                });

                var remover = this.message('files', w('div', {
                    classes: 'files',
                    children: [
                        w('div', {
                            classes: 'title',
                            textContent: msg
                        }),

                        reader.e,

                        w('div', {
                            classes: 'actions',
                            children: but.e
                        })
                    ]
                }));

                but.on('click', (function() {
                    remover();
                }).bind(this));

                reader.on('loaded', (function(r, f, data) {
                    if (data !== null) {
                        this._store.addModel({
                            filename: f.name,
                            modificationTime: f.lastModifiedDate,
                            creationTime: new Date()
                        }, data, (function(store, model) {
                            reader.finished(f, model !== null);
                        }).bind(this));
                    }
                }).bind(this));

                reader.on('finished', (function() {
                    this._updateRenderer();
                }).bind(this));

                popup.destroy();
            }).bind(this);

            inp.click();
        }).bind(this));

        content.appendChild(li);

        var popup;

        for (var i = 0; i < ret.length; i++) {
            var sc = {
                classes: 'screenshot'
            };

            if (ret[i].screenshot) {
                sc.src = ret[i].screenshot;
            }

            li = w('li', {
                children: [
                    w('div', {
                        classes: 'screenshot-container',
                        children: w('img', sc)
                    }),

                    w('div', {
                        classes: 'filename',
                        textContent: ret[i].filename
                    }),

                    w('div', {
                        classes: 'modification-time',
                        textContent: 'Added ' + this._relDate(ret[i].creationTime)
                    }),

                    w('div', {
                        classes: 'delete',
                        textContent: '×',
                        title: 'Delete model'
                    })
                ]
            });

            var del = li.querySelector('.delete');

            del.addEventListener('click', (function(model, li, del, e) {
                var spinner = new ui.Spinner();

                del.textContent = '';
                del.classList.add('spinning');

                del.appendChild(spinner.e);
                spinner.start();

                this._store.deleteModel(model, (function(store, deleted) {
                    spinner.cancel();
                    del.removeChild(spinner.e);
                    del.classList.remove('spinning');

                    if (deleted) {
                        content.removeChild(li);
                        this._updateRenderer();
                    } else {
                        del.textContent = '×';
                    }
                }).bind(this));

                e.preventDefault();
                e.stopPropagation();
            }).bind(this, ret[i], li, del));

            content.appendChild(li);
        }

        popup = new ui.Popup(content, this.buttons.models.e);

        popup.on('destroy', (function() {
            if (this._lastFocus) {
                this._lastFocus.focus();
            }
        }).bind(this));

        cb(popup);
    }).bind(this));
};

App.prototype._showOpenPopup = function(cb) {
    var popup;

    this._store.all((function(store, ret) {
        var w = ui.Widget.createUi;
        var content = w('ul', { classes: 'documents' });

        var li = w('li', {
            classes: 'import',
            innerHTML: 'Import&nbsp;from&nbsp;file',
            title: 'Import a previously exported document'
        });

        li.addEventListener('click', (function() {
            var inp = w('input', { type: 'file', multiple: 'multiple' });

            inp.onchange = (function() {
                var reader = new ui.FilesReader(inp.files);
                var msg;

                if (inp.files.length === 1) {
                    msg = 'Importing 1 document from file';
                } else {
                    msg = 'Importing ' + inp.files.length + ' documents from files';
                }

                var but = new ui.Button({
                    value: 'Close'
                });

                var remover = this.message('files', w('div', {
                    classes: 'files',
                    children: [
                        w('div', {
                            classes: 'title',
                            textContent: msg
                        }),

                        reader.e,

                        w('div', {
                            classes: 'actions',
                            children: but.e
                        })
                    ]
                }));

                but.on('click', (function() {
                    remover();
                }).bind(this));

                var docs = new Array(inp.files.length);

                reader.on('loaded', (function(i, r, f, data) {
                    var doc = Document.fromRemote(null, JSON.parse(data));
                    this._saveDoc(doc);

                    docs[i] = doc;

                    r.finished(f, true);
                }).bind(this, i));

                reader.on('finished', (function() {
                    for (var i = docs.length - 1; i >= 0; i--) {
                        if (docs[i]) {
                            this.loadDocument(docs[i]);
                            break;
                        }
                    }
                }).bind(this));

                popup.destroy();
            }).bind(this);

            inp.click();
        }).bind(this));

        content.appendChild(li);

        for (var i = 0; i < ret.length; i++) {
            var sc = {
                classes: 'screenshot'
            };

            if (ret[i].screenshot) {
                sc.src = ret[i].screenshot;
            }

            li = w('li', {
                children: [
                    w('div', {
                        classes: 'screenshot-container',
                        children: w('img', sc)
                    }),

                    w('div', {
                        classes: 'title',
                        textContent: ret[i].title
                    }),

                    w('div', {
                        classes: 'modification-time',
                        textContent: 'Last modified ' + this._relDate(ret[i].modificationTime)
                    }),

                    w('div', {
                        classes: 'delete',
                        textContent: '×',
                        title: 'Delete document'
                    })
                ]
            });

            if (this.document !== null && ret[i].id === this.document.id) {
                var title = li.querySelector('.title');
                title.classList.add('active');
            }

            li.addEventListener('click', (function(doc) {
                this.loadDocument(Document.deserialize(doc));
                popup.destroy();
            }).bind(this, ret[i]));

            var del = li.querySelector('.delete');

            del.addEventListener('click', (function(doc, li, del, e) {
                if (content.querySelectorAll('li').length > 1) {
                    var spinner = new ui.Spinner();

                    del.textContent = '';
                    del.classList.add('spinning');

                    del.appendChild(spinner.e);
                    spinner.start();

                    this._store.delete(doc, (function(store, doc) {
                        spinner.cancel();
                        del.removeChild(spinner.e);
                        del.classList.remove('spinning');

                        if (doc) {
                            content.removeChild(li);

                            if (this.document && this.document.id === doc.id) {
                                delete this.document.id;
                            }
                        } else {
                            del.textContent = '×';
                        }
                    }).bind(this));
                }

                e.preventDefault();
                e.stopPropagation();
            }).bind(this, ret[i], li, del));

            content.appendChild(li);
        }

        popup = new ui.Popup(content, this.buttons.open.e);

        popup.on('destroy', (function() {
            if (this._lastFocus) {
                this._lastFocus.focus();
            }
        }).bind(this));

        cb(popup);
    }).bind(this));
};

App.prototype._onButtonNewClick = function() {
    this._saveCurrentDoc((function(saved) {
        if (saved) {
            this.newDocument();
        }
    }).bind(this));
};

App.prototype._addOverlay = function() {
    var overlay = document.createElement('div');
    overlay.classList.add('overlay');

    document.body.appendChild(overlay);
    overlay.offsetWidth; // jshint ignore:line
    overlay.classList.add('animate');

    return overlay;
};

App.prototype._showInfoPopup = function() {
    var w = ui.Widget.createUi;

    var title = w('input', { classes: 'title', value: this.document.title, type: 'text' });

    var authors = [];

    for (var i = 0; i < this.document.authors.length; i++) {
        var author = this.document.authors[i];

        authors.push(author.name + ' (' + author.license + ', ' + author.year + ')');
    }

    if (authors.length === 0) {
        authors = ['Unpublished'];
    }

    var props = w('table', {
        classes: 'properties',
        children: [
            w('tr', { children: [
                w('td', { textContent: 'Authors:' }),
                w('td', { textContent: authors.join(', ') })
            ]}),
        ]
    });

    var description = w('div', {
        classes: 'description'
    });

    var close = new ui.Button('Close Editor');
    close.e.classList.add('close');

    var editor = w('textarea');

    var content = w('div', {
        classes: 'info-popup',
        children: [
            title,
            props,
            description,
            close.e,
            editor
        ]
    });

    var f = (function() {
        this._updateDocumentBy({
            title: title.value
        });

        this._saveCurrentDocWithDelay();
    }).bind(this);

    title.addEventListener('input', f);
    title.addEventListener('change', f);

    var desc = (function() {
        if (this.document.description) {
            description.classList.remove('empty');
            return this.document.description;
        } else {
            description.classList.add('empty');
            return 'Description not set. Double-click to start editing.';
        }
    }).bind(this);

    description.innerHTML = marked(desc());

    var saveEditor = (function() {
        this._updateDocumentBy({
            description: editor.value
        });

        this._saveCurrentDocWithDelay();
    }).bind(this);

    editor.addEventListener('keydown', (function(e) {
        if (e.keyCode === 27) { // escape
            saveEditor();
            description.innerHTML = marked(desc());

            content.classList.remove('editing');
            close.e.classList.remove('animate');

            e.stopPropagation();
            e.preventDefault();
        }
    }).bind(this));

    editor.addEventListener('blur', (function() {
        if (content.classList.contains('editing')) {
            saveEditor();
        }
    }).bind(this));

    close.on('click', function() {
        saveEditor();
        description.innerHTML = marked(desc());

        content.classList.remove('editing');
        close.e.classList.remove('animate');
    }, this);

    description.addEventListener('dblclick', (function() {
        editor.value = this.document.description || '';

        content.classList.add('editing');
        close.e.offsetWidth; // jshint ignore:line
        close.e.classList.add('animate');

        editor.focus();

        editor.selectionStart = 0;
        editor.selectionEnd = 0;
    }).bind(this));

    var overlay = this._addOverlay();
    this._infoPopup = new ui.Popup(content, this.title);

    this._infoPopup.on('destroy', function() {
        if (content.classList.contains('editing')) {
            saveEditor();
        }

        this._infoPopup = null;
        document.body.removeChild(overlay);

        if (this._lastFocus) {
            this._lastFocus.focus();
        }
    }, this);
};

App.prototype._initTitle = function() {
    this.title = document.getElementById('document-title');
    ui.Popup.on(this.title, this._showInfoPopup.bind(this));
};

App.prototype._checkCompatibility = function() {
    var missing = [];

    var view = document.getElementById('view');

    if (!Renderer.getWebGLContext(view)) {
        missing.push({
            name: 'WebGL',
            description: 'It looks like WebGL is not supported in your browser, and this playground is all about WebGL!'
        });
    }

    // Check for IndexedDB
    if (typeof global.indexedDB === 'undefined') {
        missing.push({
            name: 'indexedDB',
            description: 'A suitable implementation of indexedDB could not be found. indexedDB is a local data storage which is used by the WebGL Playground to store documents.'
        });
    }

    if (typeof global.localStorage === 'undefined') {
        missing.push({
            name: 'localStorage',
            description: 'A suitable implementation of localStorage could not be found. localStorage is used by the WebGL Playground to track application states.'
        });
    }

    if (typeof global.history === 'undefined') {
        missing.push({
            name: 'history',
            description: 'A suitable implementation of history could not be found. history is used by the WebGL Playground to implement proper navigation in history while using the application.'
        });
    }

    if (missing.length !== 0) {
        var children = [];

        for (var i = 0; i < missing.length; i++) {
            var m = missing[i];

            children.push(ui.Widget.createUi('tr', {
                children: [
                    ui.Widget.createUi('td', { textContent: m.name }),
                    ui.Widget.createUi('td', { textContent: m.description })
                ]
            }));
        }

        var d = ui.Widget.createUi('div', {
            classes: 'compatibility',
            children: [
                ui.Widget.createUi('div', {
                    classes: 'title',
                    textContent: 'Sorry! The WebGL Playground does not support your browser'
                }),

                ui.Widget.createUi('table', {
                    children: children
                })
            ]
        });

        this.message('error', d, { canCancel: false });
        return false;
    } else {
        return true;
    }
};

App.prototype._initHistory = function() {
    if (!global.history) {
        return;
    }

    global.onpopstate = (function(e) {
        var st = e.state;

        if (st) {
            if (st.mode === 'document') {
                var f = (function(store, doc) {
                    if (doc) {
                        this.loadDocument(doc, { preventPushState: true });
                    }
                }).bind(this);

                if (st.id) {
                    this._store.byId(st.id, f);
                } else if (st.share) {
                    this._store.byShare(st.share, f);
                }
            } else {
                this._showGallery({
                    preventPushState: true
                });
            }
        } else {
            this._route((function(doc) {
                this.loadDocument(doc);
            }).bind(this), (function() {
                this._showGallery({
                    preventPushState: true
                });
            }).bind(this));
        }
    }).bind(this);
};

App.prototype.loadRemoteDocument = function(id, cb) {
    this._store.byShare(id, (function(_, doc) {
        if (doc !== null) {
            cb(doc);
        } else {
            utils.get('d/' + id + '.json', {
                success: (function(req, jdoc) {
                    var doc = Document.fromRemote(id, jdoc);

                    if (cb) {
                        cb(doc);
                    } else if (jdoc) {
                        this.loadDocument(doc);
                    }
                }).bind(this),

                error: (function(req, e) {
                    var msg = e ? e.message : req.responseText;
                    this.message('error', 'Failed to load document: ' + msg);
                }).bind(this)
            });
        }
    }).bind(this));
};

App.prototype._route = function(f, cb) {
    var m = document.location.pathname.match(/d\/([A-Za-z0-9]+)/);

    if (!m) {
        m = document.location.search.match(/\?d=([A-Za-z0-9]+)/);
    }

    if (m) {
        this.loadRemoteDocument(m[1], f);
    } else {
        cb();
    }
};

App.prototype._showIntro = function() {
    if (typeof global.Settings.hooks.intro !== 'function') {
        return;
    }

    var div = document.createElement('div');

    div.classList.add('intro');
    div.innerHTML = marked(global.Settings.hooks.intro());

    this.message('', div);
};

App.prototype._init = function() {
    if (!this._checkCompatibility()) {
        return;
    }

    this._store = new Store((function(store) {
        this._initHistory();

        store.appSettings((function(store, settings) {
            this.settings = utils.merge(defaultSettings, settings);
        }).bind(this));

        var f = (function(doc) {
            if (doc === null) {
                this._showGallery({
                    preventPushState: true
                });
            } else {
                var saved = localStorage.getItem('savedDocumentBeforeUnload');

                if (saved !== null && doc !== null) {
                    saved = JSON.parse(saved);

                    if (saved && typeof saved.id !== 'undefined' && saved.id === doc.id)
                    {
                        saved.modificationTime = new Date(saved.modificationTime);
                        saved.creationTime = new Date(saved.creationTime);

                        this.loadDocument(Document.deserialize(saved), {}, (function() {
                            this._saveCurrentDocWithDelay();
                        }).bind(this));

                        localStorage.setItem('savedDocumentBeforeUnload', null);

                        return;
                    }
                }

                this.loadDocument(doc);
            }
        }).bind(this);

        this._route(f, (function() {
            if (localStorage.getItem('lastMode') === 'document') {
                store.last((function(_, doc) {
                    f(doc);
                }).bind(this));
            } else {
                f(null);
            }
        }).bind(this));
    }).bind(this));

    this.main = document.getElementById('main');
    this.gallery = document.getElementById('gallery');
    this.content = document.getElementById('content');

    this._initProgramsBar();
    this._initCanvas();
    this._initEditors();
    this._initButtons();
    this._initPanels();
    this._initTitle();

    this._updateCanvasSize();

    window.onbeforeunload = (function() {
        if (this.mode === 'document' && this.document !== null) {
            this._updateEditors();
            localStorage.setItem('savedDocumentBeforeUnload', JSON.stringify(this._serializeDocument(this.document)));
        }
    }).bind(this);

    window.addEventListener('scroll', (function() {
        if (this._mode === 'gallery' && this._checkPopulateGallery) {
            this._checkPopulateGallery();
        }
    }).bind(this));
};

var app = new App();
module.exports = app;

// vi:ts=4:et
