var Editor = require('./editor');
var Document = require('./document');
var widgets = require('../widgets/widgets');
var glsl = require('../glsl/glsl');
var Store = require('./store');
var Renderer = require('./renderer');

require('./js-mode');

function App() {
    if (document.readyState === 'complete') {
        this._init();
    } else {
        document.addEventListener('DOMContentLoaded', this._init.bind(this));
    }
}

App.prototype.find = function(elems) {
    var ret = {};

    for (var k in elems) {
        ret[k] = document.querySelector(elems[k]);
    }

    return ret;
}

App.prototype.new_document = function() {
    var doc = new Document(this);

    this._load_doc(doc);
    this._save_current_doc();
}

App.prototype.load_document = function(doc) {
    if (doc === null) {
        this.new_document();
        return;
    }

    doc = Document.deserialize(doc);

    this._load_doc(doc);
}

App.prototype._extract_js_error_loc = function(e) {
    var lines = e.stack.split('\n');
    var ours = lines[1];

    // Chrome
    var anon = /, <anonymous>:([0-9]+):([0-9]+)\)$/;
    var m = lines[1].match(anon);

    if (m) {
        return {
            line: parseInt(m[1]) - 1,
            column: parseInt(m[2])
        }
    }

    // Firefox
    var func = /> Function:([0-9]+):([0-9]+)$/
    m = lines[0].match(func);

    if (func) {
        return {
            line: parseInt(m[1]),
            column: parseInt(m[2])
        }
    }

    return null;
}

App.prototype._update_renderer = function() {
    var ret = this.renderer.update(this.document);

    if (typeof ret === 'undefined') {
        var c = {
            c: this.renderer.context,
            Math: Math
        };

        if (this.renderer.program) {
            c.this = this.renderer.program;
        }

        this.js_editor.completionContext(c);
    } else {
        var e = null;

        if (ret.js.init !== null) {
            e = ret.js.init;
        } else if (ret.js.run !== null) {
            e = ret.js.run;
        }

        if (e !== null) {
            var message = e.message;
            var loc = this._extract_js_error_loc(e);

            this.js_editor.runtime_error({
                message: message,
                location: loc
            });
        }
    }
}

}

App.prototype._load_doc = function(doc) {
    this._loading = true;

    this.vertex_editor.value(doc.active_program.vertex.data);
    this.vertex_editor.history(doc.active_program.vertex.history);

    this.fragment_editor.value(doc.active_program.fragment.data);
    this.fragment_editor.history(doc.active_program.fragment.history);

    this.js_editor.value(doc.js.data);
    this.js_editor.history(doc.js.history);

    this.document = doc;

    if (doc.active_editor !== null) {
        var editor = null;

        switch (doc.active_editor.name) {
        case 'js':
            editor = this.js_editor;
            break;
        case 'vertex':
            editor = this.vertex_editor;
            break;
        case 'fragment':
            editor = this.fragment_editor;
            break;
        }

        if (editor !== null) {
            editor.focus();
            editor.cursor(doc.active_editor.cursor);
        }
    } else {
        this.canvas.focus();
    }

    this.title.value = doc.title;

    this._loading = false;
    this._update_renderer();
}

App.prototype._save_current_doc = function(cb) {
    var doc = this.document;

    this._store.save(doc.serialize(), function(store, retdoc) {
        if (retdoc !== null) {
            doc.id = retdoc.id;
        }

        if (typeof cb === 'function') {
            cb(retdoc !== null);
        }
    });
}

App.prototype._save_current_doc_with_delay = function(cb) {
    if (this._save_timeout !== 0) {
        clearTimeout(this._save_timeout);
        this._save_timeout = 0;
    }

    this._save_timeout = setTimeout((function() {
        this._save_timeout = 0;
        this._save_current_doc(cb);
    }).bind(this), 1000);
}

App.prototype._update_canvas_size = function() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
}

App.prototype._init_panels = function() {
    var panels = document.querySelectorAll('.panel');

    this.panels = {};

    for (var i = 0; i < panels.length; i++) {
        var p = panels[i];

        this.panels[p.id] = new widgets.Panel(p);
    }

    this.panels['panel-programs'].on('resized', (function() {
        this.vertex_editor.editor.refresh();
        this.fragment_editor.editor.refresh();
        this.js_editor.editor.refresh();
        this._update_canvas_size();
    }).bind(this));

    this.panels['panel-main'].on('resized', (function() {
        this.vertex_editor.editor.refresh();
        this.fragment_editor.editor.refresh();
        this.js_editor.editor.refresh();
        this._update_canvas_size();
    }).bind(this));

    this.panels['panel-program'].on('resized', (function() {
        this.vertex_editor.editor.refresh();
        this.fragment_editor.editor.refresh();
    }).bind(this));

    this.panels['panel-js'].on('resized', (function() {
        this.js_editor.editor.refresh();
        this._update_canvas_size();
    }).bind(this));
}

App.prototype._update_document_by = function(opts) {
    if (this._loading) {
        return;
    }

    this.document.update(opts);
    this._save_current_doc_with_delay((function() {
        if ('vertex' in opts || 'fragment' in opts || 'js' in opts) {
            this._update_renderer();
        }
    }).bind(this));
}

App.prototype._update_document = function(name, editor) {
    if (this._loading) {
        return;
    }

    var up = {};

    up[name] = {
        data: editor.value(),
        history: editor.history()
    };

    this._update_document_by(up);
}

App.prototype._on_doc_title_change = function() {
    this._update_document_by({title: this.title.value});
}

App.prototype._init_canvas = function() {
    this.canvas = document.getElementById('view');

    var t = this.canvas.parentElement.querySelector('.editor-title');

    this.canvas.addEventListener('focus', (function(title) {
        t.classList.add('hidden');
        this._update_document_by({active_editor: null});
    }).bind(this, t));

    this.canvas.addEventListener('blur', (function(title) {
        t.classList.remove('hidden');
    }).bind(this, t));

    window.addEventListener('resize', (function(e) {
        this._update_canvas_size();
    }).bind(this));

    this.renderer = new Renderer(this.canvas);

    this._update_canvas_size();
}

App.prototype._init_editors = function() {
    var elems = this.find({
        vertex_editor: '#vertex-editor',
        fragment_editor: '#fragment-editor',
        js_editor: '#js-editor'
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

            this._update_document_by({
                active_editor: {
                    name: n,
                    cursor: this[k].cursor()
                }
            });
        }).bind(this, t, k));

        this[k].on('blur', (function(title) {
            title.classList.remove('hidden');
        }).bind(this, t));
    }

    var ctx = this.renderer.context;

    this.vertex_editor = new Editor(this.vertex_editor, ctx, glsl.source.VERTEX);
    this.fragment_editor = new Editor(this.fragment_editor, ctx, glsl.source.FRAGMENT);
    this.js_editor = new Editor(this.js_editor, ctx, 'javascript');

    var editors = {
        'vertex': this.vertex_editor,
        'fragment': this.fragment_editor,
        'js': this.js_editor
    };

    for (var n in editors) {
        editors[n].editor.on('changes', (function(n) {
            this._update_document(n, editors[n]);
        }).bind(this, n));

        editors[n].editor.on('cursorActivity', (function(n) {
            this._update_document_by({
                active_editor: {
                    name: n,
                    cursor: editors[n].cursor()
                }
            });
        }).bind(this, n));
    }
}

App.prototype._init_title = function() {
    this.title = document.getElementById('doc-title');

    this.title.addEventListener('change', this._on_doc_title_change.bind(this));
    this.title.addEventListener('input', this._on_doc_title_change.bind(this));
}

App.prototype._init_buttons = function() {
    var buttons = ['share', 'snapshot', 'new'];

    this.buttons = {};

    for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];

        var button = document.getElementById('button-' + b);

        button.addEventListener('click', this['_on_button_' + b + '_click'].bind(this));

        this.buttons[b] = button;
    }
}

App.prototype._on_button_share_click = function() {

}

App.prototype._on_button_snapshot_click = function() {

}

App.prototype._on_button_new_click = function() {
    this._save_current_doc((function(saved) {
        if (saved) {
            this.new_document();
        }
    }).bind(this));
}

App.prototype._init = function() {
    this._store = new Store((function(store) {
        store.last((function(_, doc) {
            this.load_document(doc);
        }).bind(this));
    }).bind(this));

    this._init_canvas();
    this._init_editors();
    this._init_title();
    this._init_buttons();
    this._init_panels();
};

var app = new App();
module.exports = app;

// vi:ts=4:et
