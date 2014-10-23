require('./glsl-mode');

var glsl = require('../glsl/glsl');
var esprima = require('../vendor/esprima');
var Signals = require('../signals/signals');

window.esprima = esprima;

function Editor(editor, ctx, type) {
    Signals.call(this);

    this.editor = editor;
    this.type = type;

    this._completionContext = {};

    this.options = {
        check_timeout: 300
    };

    var keymap = {
        Tab: function(cm) {
            var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
            cm.replaceSelection(spaces);
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
                    var n = cm.getOption("indentUnit");

                    // all spaces, remove up to N indentUnit
                    m = prefix.length % n;

                    if (m == 0) {
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
        this._preprocessor_options = glsl.preprocessor.Preprocessor.options_from_context(ctx.gl);

        this.builtins = glsl.builtins.Builtins.create_for_context(ctx.gl, type);

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

                this._hint();
            }).bind(this);

            keymap['Ctrl-Space'] = (function(cm) {
                this._hint();
            }).bind(this);

            var mode = this.editor.getMode();
            var indentOrig = mode.indent;

            mode.indent = function(state, textAfter) {
                var ret = indentOrig.call(this, state, textAfter);

                if (textAfter[0] === '.') {
                    ret += editor.getOption('indentUnit');
                }

                return ret;
            };
        }
    }

    this._change_timeout = 0;

    this._internal_errors = {
        markers: [],
        errors: []
    };

    this._external_errors = {
        markers: [],
        errors: []
    };

    this._error_message = null;

    this.editor.on('change', this._on_change.bind(this));
    this.editor.on('cursorActivity', this._on_cursor_activity.bind(this));

    editor.addKeyMap(keymap);

    this.parsed = null;
    this._on_notify_parsed = this.register_signal('notify::parsed');
}

Editor.prototype = Object.create(Signals.prototype);
Editor.prototype.constructor = Editor;

Editor.prototype._hint = function() {
    this.editor.showHint({
        completeSingle: false,
        context: this._completionContext,
    });
}

Editor.prototype.completionContext = function(context) {
    if (!context) {
        return this._completionContext;
    }

    this._completionContext = context;
}

Editor.prototype._on_cursor_activity = function() {
    var doc = this.editor.getDoc();
    var cursor = this.cursor();
    var marks = doc.findMarksAt(cursor);

    var errs = [];

    for (var i = 0; i < marks.length; i++) {
        var m = marks[i];

        if (m.className === 'error') {
            errs.push(m.error);
        }
    }

    if (this._error_message !== null && (errs.length === 0 || this._error_message.errors[0] !== errs[0])) {
        this._error_message.widget.parentElement.removeChild(this._error_message.widget);
        this._error_message = null;
    }

    if (this._error_message === null && errs.length > 0) {
        var c = document.createElement('div');
        c.classList.add('error-message-container');

        var w = document.createElement('ul');
        w.classList.add('error-message');

        c.appendChild(w);

        for (var i = 0; i < errs.length; i++) {
            var li = document.createElement('li');
            li.textContent = errs[i].formatted_message();

            w.appendChild(li);
        }

        this._error_message = {
            errors: errs,
            widget: c
        };

        this.editor.addWidget({line: cursor.line, ch: 0}, this._error_message.widget, false, 'above');
        c.style.left = '';    }
}

Editor.prototype.focus = function() {
    this.editor.focus();
}

Editor.prototype.cursor = function(v) {
    if (typeof v === 'undefined') {
        return this.editor.getCursor();
    }

    this.editor.setCursor(v);
}

Editor.prototype.value = function(v) {
    if (typeof v === 'undefined') {
        return this.editor.getValue();
    }

    this.editor.setValue(v);

    if (this._change_timeout !== 0) {
        clearTimeout(this._change_timeout);
        this._change_timeout = 0;
    }

    this._on_change_timeout();
}

Editor.prototype.history = function(v) {
    if (typeof v === 'undefined') {
        return this.editor.getHistory();
    }

    this.editor.setHistory(v);
}

Editor.prototype._make_loc = function(l) {
    return {line: l.line - 1, ch: l.column - 1};
}

Editor.prototype._on_change_timeout = function() {
    this._change_timeout = 0;

    if (this.type === glsl.source.VERTEX || this.type === glsl.source.FRAGMENT) {
        this._on_change_timeout_glsl();
    } else {
        this._on_change_timeout_js();
    }
}

Editor.prototype._on_change_timeout_js = function() {
    try {
        esprima.parse(this.value());
    } catch (e) {
        this.runtime_error({
            message: e.description,
            location: {
                line: e.lineNumber,
                column: e.column
            }
        });

        return;
    }

    this._process_errors(this._internal_errors, []);
}

Editor.prototype._on_change_timeout_glsl = function() {
    this.parsed = new glsl.ast.Parser(this.value(), this.type, {
        preprocessor: this._preprocessor_options
    });

    glsl.sst.Annotate(this.parsed, {
        builtins: this.builtins
    });

    this._process_errors(this._internal_errors, this.parsed.errors());
    this._on_notify_parsed();
}

Editor.prototype.runtime_error = function(error) {
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

        formatted_message: function() {
            return error.location.line + '.' + (tok.start + 1) + '-' + error.location.line + '.' + (tok.end + 1) + ': ' + error.message;
        }
    };

    this._process_errors(this._internal_errors, [err]);
}

Editor.prototype.external_errors = function(errors) {
    this._process_errors(this._external_errors, errors);
}

Editor.prototype._process_errors = function(ctx, errors) {
    var doc = this.editor.getDoc();

    ctx.errors = errors.slice(0);

    for (var i = 0; i < ctx.markers.length; i++) {
        ctx.markers[i].clear();
    }

    ctx.markers = [];

    if (this._internal_errors.errors.length === 0 && this._external_errors.errors.length === 0) {
        this.editor.display.wrapper.classList.remove('error');
    } else {
        this.editor.display.wrapper.classList.add('error');
    }

    for (var i = 0; i < errors.length; i++) {
        var e = errors[i];
        var l = e.location.start.line - 1;

        var m = doc.markText(this._make_loc(e.location.start),
                             this._make_loc(e.location.end), {
                                className: 'error',
                                title: e.message,
                                inclusiveLeft: false,
                                inclusiveRight: true
                             });

        m.error = e;
        ctx.markers.push(m);
    }

    this._on_cursor_activity();
}

Editor.prototype._on_change = function(c, o) {
    if (this._change_timeout !== 0) {
        clearTimeout(this._change_timeout);
        this._change_timeout = 0;
    }

    this._change_timeout = setTimeout(this._on_change_timeout.bind(this), this.options.check_timeout);
}

module.exports = Editor;

// vi:ts=4:et
