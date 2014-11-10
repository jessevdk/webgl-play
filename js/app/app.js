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
var Document = require('./document');
var ui = require('../ui/ui');
var glsl = require('../glsl/glsl');
var Store = require('./store');
var Renderer = require('./renderer');
var Signals = require('../signals/signals');
var marked = require('../vendor/marked');

require('./js-mode');

function App() {
    Signals.call(this);

    this.document = null;

    this._onDocumentChanged = this.registerSignal('notify::document');
    this._lastFocus = null;

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
}

App.prototype.newDocument = function() {
    var doc = new Document(this);

    this._loadDoc(doc);
    this._saveCurrentDoc();
}

App.prototype.loadDocument = function(doc) {
    if (doc === null) {
        this.newDocument();
        return;
    }

    if (!Document.prototype.isPrototypeOf(doc)) {
        doc = Document.deserialize(doc);
    }

    this._loadDoc(doc);
}

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
            }
        }

        // Firefox
        var func = /> Function:([0-9]+):([0-9]+)$/
        m = line.match(func);

        if (m) {
            return {
                line: parseInt(m[1]),
                column: parseInt(m[2])
            }
        }
    }

    return null;
}

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
}

App.prototype._updateRenderer = function() {
    var ret = this.renderer.update(this.document);

    if (typeof ret === 'undefined') {
        var c = {
            c: this.renderer.context,
            Math: Math
        };

        if (this.renderer.program) {
            c.this = this.renderer.program;
        }

        this.jsEditor.completionContext(c);

        for (var i = 0; i < this.document.programs.length; i++) {
            var p = this.document.programs[i];
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

        var progs = null;

        for (var i = 0; i < this.document.programs.length; i++) {
            var p = this.document.programs[i];
            var name = p.name();

            if (ret.programs !== null && name in ret.programs) {
                p.error(ret.programs[name]);
            } else {
                p.error(null);
            }
        }
    }
}

App.prototype._updateEditors = function() {
    var up = {};

    var names = ['vertex', 'fragment', 'js'];

    for (var i = 0; i < names.length; i++) {
        var editor = this[names[i] + '_editor'];

        up[names[i]] = {
            data: editor.value(),
            history: editor.history()
        };
    }

    this._updateDocumentBy(up);
}

App.prototype._onDocumentBeforeActiveProgramChanged = function() {
    this._updateEditors();
}

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
}

App.prototype._onDocumentTitleChanged = function() {
    this.title.textContent = this.document.title;
}

App.prototype._loadDocReal = function(doc) {
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

    this._onDocumentChanged();

    this.content.classList.add('loaded');
    this.content.classList.remove('loading');
}

App.prototype._loadDoc = function(doc) {
    this._loading = true;

    if (this.document !== null) {
        this.content.classList.remove('loaded');
        this.content.classList.add('loading');

        setTimeout((function() {
            this._loadDocReal(doc);
        }).bind(this), 200);
    } else {
        this._loadDocReal(doc);
    }
}

App.prototype._onDocumentHasChanged = function(doc, opts) {
    this._saveCurrentDocWithDelay((function() {
        if ('vertex' in opts || 'fragment' in opts || 'js' in opts || 'programs' in opts) {
            this._updateRenderer();
        }
    }).bind(this));
}

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
}

App.prototype._saveDoc = function(doc, cb) {
    this._store.save(this._serializeDocument(doc), function(store, retdoc) {
        if (retdoc !== null) {
            doc.id = retdoc.id;
        }

        if (typeof cb === 'function') {
            cb(retdoc !== null);
        }
    });
}

App.prototype._saveCurrentDoc = function(cb) {
    this._saveDoc(this.document, cb);
}

App.prototype._saveCurrentDocWithDelay = function(cb) {
    if (this._saveTimeout !== 0) {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = 0;
    }

    this._saveTimeout = setTimeout((function() {
        this._saveTimeout = 0;
        this._saveCurrentDoc(cb);
    }).bind(this), 500);
}

App.prototype._updateCanvasSize = function() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
}

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
}

App.prototype._updateDocumentBy = function(opts) {
    if (this._loading) {
        return;
    }

    this.document.update(opts);
}

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
}

App.prototype._initCanvas = function() {
    this.canvas = document.getElementById('view');

    var t = this.canvas.parentElement.querySelector('.editor-title');

    this.canvas.addEventListener('focus', (function(title) {
        t.classList.add('hidden');
        this._updateDocumentBy({activeEditor: null});

        this._lastFocus = this.canvas;
    }).bind(this, t));

    this.canvas.addEventListener('blur', (function(title) {
        t.classList.remove('hidden');
    }).bind(this, t));

    window.addEventListener('resize', (function(e) {
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
}

App.prototype._initEditors = function() {
    var elems = this.find({
        vertexEditor: '#vertex-editor',
        fragmentEditor: '#fragment-editor',
        jsEditor: '#js-editor'
    });

    var opts = {
        theme: 'default webgl-play',
        indentUnit: 4,
        lineNumbers: true,
        rulers: [78]
    };

    for (var k in elems) {
        this[k] = CodeMirror(elems[k], opts);

        var p = elems[k].parentElement;
        var t = p.querySelector('.editor-title');

        this[k].on('focus', (function(title, k) {
            var n = k.slice(0, k.indexOf('_'));

            title.classList.add('hidden');

            this._updateDocumentBy({
                activeEditor: {
                    name: n,
                    cursor: this[k].cursor()
                }
            });

            this._lastFocus = elems[k];
        }).bind(this, t, k));

        this[k].on('blur', (function(title) {
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
}

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
}

App.prototype.message = function(type, m) {
    var div = document.createElement('div');
    this._message = div;

    div.classList.add('message');
    div.classList.add(type);

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
        window.removeEventListener('keydown', this._messageKeydown);
        window.removeEventListener('mousedown', this._messageMousedown);

        document.body.removeChild(overlay);
        document.body.removeChild(div);
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
}

App.prototype._onButtonShareClick = function() {
    var req = new XMLHttpRequest();
    var doc = this.document;

    req.onload = (function(ev) {
        var req = ev.target;

        if (req.status === 200) {
            var ret = JSON.parse(req.responseText);

            if (this.document === doc) {
                this._updateDocumentBy({
                    share: ret.hash
                });

                var l = document.location;
                var url = l.protocol + '//' + l.host + '/d/' + ret.hash;

                window.history.replaceState({}, '', url);

                var e = document.createElement('div');

                var s = document.createElement('span');
                s.textContent = 'Shared document at ';
                e.appendChild(s);

                s = document.createElement('span');
                s.textContent = url;
                e.appendChild(s);

                this.message('ok', e);

                var selection = window.getSelection();
                var range = document.createRange();
                range.selectNodeContents(s);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else {
            this.message('error', 'Failed to upload document: ' + req.responseText);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        this.message('error', 'Failed to upload document');
    }).bind(this);

    req.open('post', '/d/new', true);
    req.send(JSON.stringify(this.document.remote()));
}

App.prototype._onButtonExportClick = function() {
    var saveas = require('../vendor/FileSaver');

    var blob = new Blob([JSON.stringify(this.document.remote(), undefined, 2)], {type: 'application/json;charset=utf-8'});
    saveas(blob, this.document.title + '.json');
}

App.prototype._initProgramsBar = function() {
    this.programsBar = new ui.ProgramsBar(document.getElementById('programs-sidebar'), this);
}

App.prototype._showOpenglPopup = function(cb) {
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

    var popup = new ui.Popup(content, this.buttons.opengl.e);
    cb(popup);
}

App.prototype._initButtons = function() {
    var buttons = ['new', 'copy', 'export', 'models', 'open', 'opengl', 'help', 'share', 'publish'];

    this.buttons = {};

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

    ui.Popup.on(this.buttons.open.e, this._showOpenPopup.bind(this));
    ui.Popup.on(this.buttons.models.e, this._showModelsPopup.bind(this));
    ui.Popup.on(this.buttons.opengl.e, this._showOpenglPopup.bind(this));
}

App.prototype._onButtonCopyClick = function() {
    var title = 'Copy of ' + this.document.title;

    var doc = Document.deserialize(this._serializeDocument(this.document));

    doc.id = null;
    doc.title = title;

    this._loadDoc(doc);
}

App.prototype._relDate = function(date) {
    var now = new Date();
    var t = (now - date) / 1000;

    var MINUTE = 60;
    var HOUR = MINUTE * 60;
    var DAY = HOUR * 24;
    var WEEK = DAY * 7;

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
}

App.prototype._showModelsPopup = function(cb) {
    var popup;

    this._store.models((function(store, ret) {
        var W = ui.Widget.createUi;
        var content = W('div', { classes: 'models' });

        var li = W('li', {
            classes: 'import',
            innerHTML: 'Import&nbsp;from&nbsp;file',
            title: 'Import a model from a local file'
        });

        li.addEventListener('click', (function() {
            var inp = W('input', { type: 'file', multiple: 'multiple' });

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

                var remover = this.message('files', W('div', {
                    classes: 'files',
                    children: [
                        W('div', {
                            classes: 'title',
                            textContent: msg
                        }),

                        reader.e,

                        W('div', {
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

            var li = W('li', {
                children: [
                    W('div', {
                        classes: 'screenshot-container',
                        children: W('img', sc)
                    }),

                    W('div', {
                        classes: 'filename',
                        textContent: ret[i].filename
                    }),

                    W('div', {
                        classes: 'modification-time',
                        textContent: 'Added ' + this._relDate(ret[i].creationTime)
                    }),

                    W('div', {
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
}

App.prototype._showOpenPopup = function(cb) {
    var popup;

    this._store.all((function(store, ret) {
        var W = ui.Widget.createUi;
        var content = W('ul', { classes: 'documents' });

        var li = W('li', {
            classes: 'import',
            innerHTML: 'Import&nbsp;from&nbsp;file',
            title: 'Import a previously exported document'
        });

        li.addEventListener('click', (function() {
            var inp = W('input', { type: 'file', multiple: 'multiple' });

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

                var remover = this.message('files', W('div', {
                    classes: 'files',
                    children: [
                        W('div', {
                            classes: 'title',
                            textContent: msg
                        }),

                        reader.e,

                        W('div', {
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
                            this._loadDoc(docs[i]);
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
            var li = W('li', {
                children: [
                    W('div', {
                        classes: 'screenshot-container',
                        children: W('img', {
                            classes: 'screenshot',
                            src: ret[i].screenshot
                        })
                    }),

                    W('div', {
                        classes: 'title',
                        textContent: ret[i].title
                    }),

                    W('div', {
                        classes: 'modification-time',
                        textContent: 'Last modified ' + this._relDate(ret[i].modificationTime)
                    }),

                    W('div', {
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
                this._loadDoc(Document.deserialize(doc));
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

                            if (this.document.id === doc.id) {
                                this.document.id = null;
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
}

App.prototype._onButtonNewClick = function() {
    this._saveCurrentDoc((function(saved) {
        if (saved) {
            this.newDocument();
        }
    }).bind(this));
}

App.prototype._addOverlay = function() {
    var overlay = document.createElement('div');
    overlay.classList.add('overlay');

    document.body.appendChild(overlay);
    overlay.offsetWidth;
    overlay.classList.add('animate');

    return overlay;
}

App.prototype._showInfoPopup = function() {
    var content = document.createElement('div');
    content.classList.add('info-popup');

    var title = document.createElement('input');
    title.setAttribute('type', 'text');

    title.classList.add('title');
    title.value = this.document.title;
    content.appendChild(title);

    var f = (function() {
        this._updateDocumentBy({
            title: title.value
        });

        this._saveCurrentDocWithDelay();
    }).bind(this);

    title.addEventListener('input', f);
    title.addEventListener('change', f);

    var description = document.createElement('div');
    description.classList.add('description');

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
    content.appendChild(description);

    var close = new ui.Button();

    close.e.classList.add('close');
    close.e.textContent = 'Close Editor';

    content.appendChild(close.e);

    var editor = document.createElement('textarea');

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

    editor.addEventListener('blur', (function(e) {
        if (content.classList.contains('editing')) {
            saveEditor();
        }
    }).bind(this));

    content.appendChild(editor);

    close.on('click', function() {
        saveEditor();
        description.innerHTML = marked(desc());

        content.classList.remove('editing');
        close.e.classList.remove('animate');
    }, this);

    description.addEventListener('dblclick', (function() {
        editor.value = this.document.description || '';

        content.classList.add('editing');
        close.e.offsetWidth;
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
}

App.prototype._initTitle = function() {
    this.title = document.getElementById('document-title');
    ui.Popup.on(this.title, this._showInfoPopup.bind(this));
}

App.prototype._init = function() {
    this._store = new Store((function(store) {
        var m = document.location.pathname.match(/d\/([A-Za-z0-9]+)/);

        var f = (function(doc) {
            var saved = localStorage.getItem('savedDocumentBeforeUnload');

            if (saved !== null && doc !== null) {
                saved = JSON.parse(saved);

                if (saved && typeof saved.id !== 'undefined' && saved.id === doc.id)
                {
                    saved.modificationTime = new Date(saved.modificationTime);
                    saved.creationTime = new Date(saved.creationTime);

                    this._loadDoc(Document.deserialize(saved));
                    this._saveCurrentDocWithDelay();

                    localStorage.setItem('savedDocumentBeforeUnload', null);

                    return;
                }
            }

            this.loadDocument(doc);
        }).bind(this);

        if (m) {
            store.byShare(m[1], (function(_, doc) {
                if (doc !== null) {
                    f(doc);
                } else {
                    // We don't have it, request it remotely
                    var req = new XMLHttpRequest();

                    req.onload = (function(e) {
                        var req = e.target;

                        if (req.status === 200) {
                            var jdoc;

                            try {
                                jdoc = JSON.parse(req.responseText);
                            } catch (e) {
                                this.message('error', 'Failed parse document: ' + e.message);
                                return;
                            }

                            f(Document.fromRemote(m[1], jdoc));
                        } else {
                            this.message('error', 'Failed to load document: ' + req.textContent);
                        }

                    }).bind(this);

                    req.onerror = (function(e) {
                        this.message('error', 'Failed to load document ' + m[1]);
                    }).bind(this);

                    req.open('get', global.Settings.backend('d/' + m[1] + '.json'), true);
                    req.send();
                }
            }).bind(this));
        } else {
            store.last((function(_, doc) {
                f(doc);
            }).bind(this));
        }
    }).bind(this));

    this.content = document.getElementById('content');

    this._initProgramsBar();
    this._initCanvas();
    this._initEditors();
    this._initButtons();
    this._initPanels();
    this._initTitle();

    this._updateCanvasSize();

    window.onbeforeunload = (function(e) {
        this._updateEditors();
        localStorage.setItem('savedDocumentBeforeUnload', JSON.stringify(this._serializeDocument(this.document)));
    }).bind(this);
};

var app = new App();
module.exports = app;

// vi:ts=4:et
