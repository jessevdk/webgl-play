require('./glsl-mode');
var glsl = require('../glsl/glsl');

function Editor(editor, type) {
    this.editor = editor;
    this.type = type;

    this.options = {
        check_timeout: 200
    };

    editor.addKeyMap({
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
    });

    if (type === glsl.source.VERTEX || type === glsl.source.FRAGMENT) {
        this.builtins = new glsl.builtins.Builtins(type);

        if (type === glsl.source.VERTEX) {
            this.editor.setOption('mode', 'glslv');
        } else {
            this.editor.setOption('mode', 'glslf');
        }

        this._init_glsl();
    } else {
        this.editor.setOption('mode', type);
    }
}

Editor.prototype._init_glsl = function() {
    this._change_timeout = 0;
    this._error_markers = [];
    this._errors = [];

    this.editor.on('change', this._on_change.bind(this));
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

    if (this.type === glsl.source.VERTEX || this.type === glsl.source.FRAGMENT) {
        if (this._change_timeout !== 0) {
            clearTimeout(this._change_timeout);
            this._change_timeout = 0;
        }

        this._on_change_timeout();
    }
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

    var p = new glsl.ast.Parser(this.value(), this.type);
    glsl.sst.Annotate(p);

    this._errors = p.errors();

    for (var i = 0; i < this._error_markers.length; i++) {
        this._error_markers[i].clear();
    }

    this._error_markers = [];

    if (this._errors.length == 0) {
        this.editor.display.wrapper.classList.remove('error');
    } else {
        this.editor.display.wrapper.classList.add('error');
    }

    var doc = this.editor.getDoc();

    for (var i = 0; i < this._errors.length; i++) {
        var e = this._errors[i];
        var l = e.location.start.line - 1;

        var m = doc.markText(this._make_loc(e.location.start),
                             this._make_loc(e.location.end), {
                                className: 'error',
                                title: e.message
                             });

        this._error_markers.push(m);
    }
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
