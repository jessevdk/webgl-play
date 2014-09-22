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
        this.editor.setOption('mode', 'glsl');

        this._init_glsl();
    } else {
        this.editor.setOption('mode', type);
    }
}

Editor.prototype._init_glsl = function() {
    this._change_timeout = 0;
    this._error_markers = [];
    this._error_widgets = [];
    this._errors = [];

    this.editor.on('change', this._on_change.bind(this));
}

Editor.prototype.value = function(v) {
    if (typeof v === 'undefined') {
        return this.editor.getValue();
    }

    this.editor.setValue(v);
}

Editor.prototype._make_loc = function(l) {
    return {line: l.line - 1, ch: l.column - 1};
}

Editor.prototype._on_change_timeout = function() {
    this._change_timeout = 0;

    var p = new glsl.ast.Parser(this.value(), this.type);
    glsl.sst.Annotate(p);

    var errs = p.errors();

    for (var i = 0; i < this._error_markers.length; i++) {
        this._error_markers[i].clear();
    }

    for (var i = 0; i < this._error_widgets.length; i++) {
        this._error_widgets[i].clear();
    }

    this._error_markers = [];
    this._error_widgets = [];
    this._errors = errs;

    if (errs.length == 0) {
        this.editor.display.wrapper.classList.remove('error');
    } else {
        this.editor.display.wrapper.classList.add('error');
    }

    var doc = this.editor.getDoc();

    for (var i = 0; i < errs.length; i++) {
        var e = errs[i];

        var m = doc.markText(this._make_loc(e.location.start),
                             this._make_loc(e.location.end), {
                                className: 'error',
                                title: e.message
                             });

        this._error_markers.push(m);
    }

    this._error_widgets_timeout = setTimeout(this._on_error_widgets_timeout.bind(this), 600);
}

Editor.prototype._on_error_widgets_timeout = function() {
    var perline = {};

    this._error_widgets_timeout = 0;

    for (var i = 0; i < this._errors.length; i++) {
        var e = this._errors[i];

        if (e.location.start.line in perline) {
            perline[e.location.start.line].push(e);
        } else {
            perline[e.location.start.line] = [e];
        }
    }

    for (var l in perline) {
        var errs = perline[l];

        errs.sort(function(a, b) {
            var ac = a.location.start.column;
            var bc = b.location.start.column;
            return ac < bc ? -1 : (ac > bc ? 1 : 0);
        });

        var ul = document.createElement('ul');
        ul.classList.add('error-message')

        for (var i = 0; i < errs.length; i++) {
            var e = errs[i];

            var li = document.createElement('li');
            li.innerText = e.formatted_message();

            ul.appendChild(li);
        }

        var w = this.editor.addLineWidget(l - 1, ul, {
            above: true,
        });

        this._error_widgets.push(w);
    }
}

Editor.prototype._on_change = function(c, o) {
    if (this._change_timeout !== 0) {
        clearTimeout(this._change_timeout);
        this._change_timeout = 0;
    }

    if (this._error_widgets_timeout !== 0) {
        clearTimeout(this._error_widgets_timeout);
        this._error_widgets_timeout = 0;
    }

    this._change_timeout = setTimeout(this._on_change_timeout.bind(this), this.options.check_timeout);
}

module.exports = Editor;

// vi:ts=4:et
