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

require('./glsl-mode');

var glsl = require('../glsl/glsl');
var esprima = require('../vendor/esprima');
var Signals = require('../signals/signals');

window.esprima = esprima;

var CodeMirror = window.CodeMirror;

function Editor(editor, ctx, type) {
    Signals.call(this);

    this.editor = editor;
    this.type = type;

    this._completionContext = {};

    this.options = {
        checkTimeout: 300,
        historySize: 100
    };

    var keymap = {
        Tab: function(cm) {
            var start = cm.getCursor('from');
            var end = cm.getCursor('to');

            for (var i = start.line; i <= end.line; i++) {
                cm.indentLine(i);
            }
        },

        Backspace: function(cm) {
            var doc = cm.getDoc();
            var cur = doc.getCursor();

            if (!doc.somethingSelected() && cur.ch !== 0) {
                var line = doc.getLine(cur.line);

                var prefix = line.slice(0, cur.ch);

                for (var i = prefix.length - 1; i >= 0; i--) {
                    if (prefix[i] !== ' ') {
                        return CodeMirror.Pass;
                    }
                }

                var m = 0;

                if (cur.ch == line.length) {
                    m = line.length;
                } else {
                    var n = cm.getOption('indentUnit');

                    // all spaces, remove up to N indentUnit
                    m = prefix.length % n;

                    if (m === 0) {
                        m = n;
                    }
                }

                doc.replaceRange('', {line: cur.line, ch: cur.ch - m}, cur);

                if (cur.ch == line.length) {
                    CodeMirror.commands.delCharBefore(cm);
                    cur.line -= 1;
                }

                cm.indentLine(cur.line, null, true);

                return;
            }

            if (cur.ch === 0 && cur.line !== 0) {
                CodeMirror.commands.delCharBefore(cm);
                cm.indentLine(cur.line - 1, null, true);
                return;
            }

            return CodeMirror.Pass;
        },

        Enter: function(cm) {
            var doc = cm.getDoc();

            if (doc.somethingSelected()) {
                doc.replaceSelection('');
            }

            var cur = doc.getCursor();
            var line = doc.getLine(cur.line);

            for (var i = 0; i < line.length; i++) {
                if (line[i] != ' ') {
                    return CodeMirror.Pass;
                }
            }

            doc.replaceRange('', {line: cur.line, ch: 0}, {line: cur.line, ch: line.length});
            return CodeMirror.Pass;
        }
    };

    var ios = /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent);
    var mac = ios || /Mac/.test(navigator.platform);

    if (mac) {
        keymap['Cmd-Left'] = 'goLineLeftSmart';
    }

    if (type === glsl.source.VERTEX || type === glsl.source.FRAGMENT) {
        this._preprocessorOptions = glsl.preprocessor.Preprocessor.optionsFromContext(ctx.gl);

        this.builtins = glsl.builtins.Builtins.createForContext(ctx.gl, type);

        if (type === glsl.source.VERTEX) {
            this.editor.setOption('mode', 'glslv');
        } else {
            this.editor.setOption('mode', 'glslf');
        }
    } else {
        this.editor.setOption('mode', type);

        if (type === 'javascript') {
            keymap['.'] = (function(cm) {
                cm.replaceSelection('.');
                cm.indentLine(cm.getCursor().line);

                try {
                    this._hint();
                } catch (e) {
                    console.error(e);
                }
            }).bind(this);

            keymap['Ctrl-Space'] = (function() {
                try {
                    this._hint();
                } catch (e) {
                    console.error(e);
                }
            }).bind(this);

            var mode = this.editor.getMode();
            var indentOrig = mode.indent;

            mode.indent = function(state, textAfter) {
                var ret = indentOrig.call(this, state, textAfter);

                if (textAfter.length > 0 && textAfter[0] === '.') {
                    ret += editor.getOption('indentUnit');
                }

                return ret;
            };
        }
    }

    this._changeTimeout = 0;

    this._internalErrors = {
        markers: [],
        errors: []
    };

    this._externalErrors = {
        markers: [],
        errors: []
    };

    this._errorMessage = null;

    this.editor.on('change', this._onChange.bind(this));
    this.editor.on('cursorActivity', this._onCursorActivity.bind(this));

    editor.addKeyMap(keymap);

    this.parsed = null;
    this._onNotifyParsed = this.registerSignal('notify::parsed');
}

Editor.prototype = Object.create(Signals.prototype);
Editor.prototype.constructor = Editor;

Editor.prototype._hint = function() {
    this.editor.showHint({
        completeSingle: false,
        context: this._completionContext,
    });
};

Editor.prototype.completionContext = function(context) {
    if (!context) {
        return this._completionContext;
    }

    this._completionContext = context;
};

Editor.prototype._onCursorActivity = function() {
    var doc = this.editor.getDoc();
    var cursor = this.cursor();
    var marks = doc.findMarksAt(cursor);

    var errs = [], i;

    for (i = 0; i < marks.length; i++) {
        var m = marks[i];

        if (m.className === 'error') {
            errs.push(m.error);
        }
    }

    if (this._errorMessage !== null && (errs.length === 0 || this._errorMessage.errors[0] !== errs[0])) {
        this._errorMessage.widget.parentElement.removeChild(this._errorMessage.widget);
        this._errorMessage = null;
    }

    if (this._errorMessage === null && errs.length > 0) {
        var c = document.createElement('div');
        c.classList.add('error-message-container');

        var w = document.createElement('ul');
        w.classList.add('error-message');

        c.appendChild(w);

        for (i = 0; i < errs.length; i++) {
            var li = document.createElement('li');
            li.textContent = errs[i].formattedMessage();

            w.appendChild(li);
        }

        this._errorMessage = {
            errors: errs,
            widget: c
        };

        this.editor.addWidget({line: cursor.line, ch: 0}, this._errorMessage.widget, false, 'above');
        c.style.left = '';    }
};

Editor.prototype.focus = function() {
    this.editor.focus();
};

Editor.prototype.cursor = function(v) {
    if (typeof v === 'undefined') {
        return this.editor.getCursor();
    }

    this.editor.setCursor(v);
};

Editor.prototype.value = function(v) {
    var stripper = /[ \t]+$/gm;

    if (typeof v === 'undefined') {
        return this.editor.getValue().replace(stripper, '');
    }

    this.editor.setValue(v.replace(stripper, ''));

    if (this._changeTimeout !== 0) {
        clearTimeout(this._changeTimeout);
        this._changeTimeout = 0;
    }

    this._onChangeTimeout();
};

Editor.prototype.history = function(v) {
    if (typeof v === 'undefined') {
        var hist = this.editor.getHistory();

        var ret = {
            done: [],
            undone: []
        };

        if (hist.undone.length > this.options.historySize) {
            ret.undone = hist.undone.slice(0, this.options.historySize);
        } else {
            ret.undone = hist.undone;
        }

        if (ret.undone.length < this.options.historySize) {
            var rem = this.options.historySize - ret.undone.length;

            if (hist.done.length > rem) {
                ret.done = hist.done.slice(0, rem);
            } else {
                ret.done = hist.done;
            }
        }


        return ret;
    }

    this.editor.setHistory(v);
};

Editor.prototype._makeLoc = function(l) {
    return {line: l.line - 1, ch: l.column - 1};
};

Editor.prototype._onChangeTimeout = function() {
    this._changeTimeout = 0;

    if (this.type === glsl.source.VERTEX || this.type === glsl.source.FRAGMENT) {
        this._onChangeTimeoutGlsl();
    } else {
        this._onChangeTimeoutJs();
    }
};

Editor.prototype._onChangeTimeoutJs = function() {
    try {
        esprima.parse(this.value());
    } catch (e) {
        this.runtimeError({
            message: e.description,
            location: {
                line: e.lineNumber,
                column: e.column
            }
        });

        return;
    }

    this._processErrors(this._internalErrors, []);
};

Editor.prototype._onChangeTimeoutGlsl = function() {
    this.parsed = new glsl.ast.Parser(this.value(), this.type, {
        preprocessor: this._preprocessorOptions
    });

    glsl.sst.Annotate(this.parsed, {
        builtins: this.builtins
    });

    this._processErrors(this._internalErrors, this.parsed.errors());
    this._onNotifyParsed();
};

Editor.prototype.runtimeError = function(error) {
    var tok = this.editor.getTokenAt(CodeMirror.Pos(error.location.line - 1, error.location.column));

    var err = {
        location: {
            start: {
                line: error.location.line,
                column: tok.start + 1
            },
            end: {
                line: error.location.line,
                column: tok.end + 1
            }
        },

        message: error.message,

        formattedMessage: function() {
            return error.location.line + '.' + (tok.start + 1) + '-' + error.location.line + '.' + (tok.end + 1) + ': ' + error.message;
        }
    };

    this._processErrors(this._internalErrors, [err]);
};

Editor.prototype.externalErrors = function(errors) {
    this._processErrors(this._externalErrors, errors);
};

Editor.prototype._processErrors = function(ctx, errors) {
    var doc = this.editor.getDoc();

    ctx.errors = errors.slice(0);

    var i;

    for (i = 0; i < ctx.markers.length; i++) {
        ctx.markers[i].clear();
    }

    ctx.markers = [];

    if (this._internalErrors.errors.length === 0 && this._externalErrors.errors.length === 0) {
        this.editor.display.wrapper.classList.remove('error');
    } else {
        this.editor.display.wrapper.classList.add('error');
    }

    for (i = 0; i < errors.length; i++) {
        var e = errors[i];
        var m = doc.markText(this._makeLoc(e.location.start),
                             this._makeLoc(e.location.end), {
                                className: 'error',
                                title: e.message,
                                inclusiveLeft: false,
                                inclusiveRight: true
                             });

        m.error = e;
        ctx.markers.push(m);
    }

    this._onCursorActivity();
};

Editor.prototype._onChange = function() {
    if (this._changeTimeout !== 0) {
        clearTimeout(this._changeTimeout);
        this._changeTimeout = 0;
    }

    this._changeTimeout = setTimeout(this._onChangeTimeout.bind(this), this.options.checkTimeout);
};

module.exports = Editor;

// vi:ts=4:et
