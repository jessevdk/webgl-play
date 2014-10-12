var fs = require('fs');
var Program = require('./program');
var Signals = require('../signals/signals');

function Document() {
    Signals.call(this);

    this.id = null;

    this.programs = [Program.default()];

    this.js = {
        data: fs.readFileSync(__dirname + '/default.js', 'utf-8').trimRight('\n'),
        history: { done: [], undone: [] }
    };

    this.title = 'Untitled';
    this.modification_time = new Date();
    this.creation_time = new Date();
    this.active_editor = null;

    this._active_program = this.programs[0];

    this._on_notify_title = this.register_signal('notify::title');
    this._on_notify_active_program = this.register_signal('notify::active-program');
    this._on_program_added = this.register_signal('program-added');
    this._on_program_removed = this.register_signal('program-removed');
}

Document.prototype = Object.create(Signals.prototype);
Document.prototype.constructor = Document;

Document.prototype.add_program = function(program) {
    this.programs.push(program);
    this._on_program_added(program);
}

Document.prototype.remove_program = function(program) {
    var idx = this.programs.indexOf(program);

    if (idx > 0) {
        if (this._active_program === program) {
            this.active_program(this.programs[idx - 1]);
        }

        this.programs.remove(idx);
        this._on_program_removed(program);
    }
}

Document.prototype.active_program = function(program) {
    if (typeof program === 'undefined') {
        return this._active_program;
    }

    if (program !== this._active_program) {
        this._active_program = program;
        this._on_notify_active_program();
    }
}

Document.prototype.update = function(buffers) {
    if ('vertex' in buffers) {
        this._active_program.vertex = {
            data: buffers.vertex.data,
            history: buffers.vertex.history
        };
    }

    if ('fragment' in buffers) {
        this._active_program.fragment = {
            data: buffers.fragment.data,
            history: buffers.fragment.history
        };
    }

    if ('js' in buffers) {
        this.js = {
            data: buffers.js.data,
            history: buffers.js.history
        };
    }

    if ('title' in buffers) {
        this.title = buffers.title;
        this._on_notify_title();
    }

    if ('active_program' in buffers) {
        for (var i = 0; i < this.programs.length; i++) {
            if (this.programs[i].name() === buffers.active_program) {
                this.active_program(this.programs[i]);
                break;
            }
        }
    }

    if ('active_editor' in buffers) {
        this.active_editor = buffers.active_editor;
    }

    this.modification_time = new Date();
}

Document.prototype.serialize = function() {
    var programs = [];

    for (var i = 0; i < this.programs.length; i++) {
        var p = this.programs[i];
        programs.push(p.serialize());
    }

    var ret = {
        version: 1,
        programs: programs,
        active_program: this._active_program.name(),
        js: {
            data: this.js.data,
            history: this.js.history,
        },
        title: this.title,
        modification_time: this.modification_time,
        creation_time: this.creation_time,
        active_editor: this.active_editor
    }

    if (this.id !== null) {
        ret.id = this.id;
    }

    return ret;
}

Document.deserialize = function(doc) {
    var ret = new Document();

    ret.programs = [];
    ret._active_program = null;

    if ('id' in doc) {
        ret.id = doc.id;
    }

    for (var i = 0; i < doc.programs.length; i++) {
        var prg = Program.deserialize(doc.programs[i]);
        ret.programs.push(prg);

        if (prg.name() === doc.active_program) {
            ret._active_program = prg;
        }
    }

    if (ret.programs.length === 0) {
        ret.programs.push(Program.default());
    }

    if (ret._active_program === null) {
        ret._active_program = ret.programs[0];
    }

    ret.active_editor = doc.active_editor;

    ret.js = {
        data: doc.js.data,
        history: doc.js.history
    };

    ret.title = doc.title;
    ret.modification_time = doc.modification_time;
    ret.creation_time = doc.creation_time;

    return ret;
}

module.exports = Document;

// vi:ts=4:et
