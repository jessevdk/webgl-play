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
    this.description = '';

    this.modification_time = new Date();
    this.creation_time = new Date();
    this.active_editor = null;
    this.screenshot = null;

    this._active_program = this.programs[0];
    this._active_program._is_default = true;

    this._default_program = this._active_program;

    this._on_notify_title = this.register_signal('notify::title');
    this._on_notify_description = this.register_signal('notify::description');
    this._on_notify_before_active_program = this.register_signal('notify-before::active-program');
    this._on_notify_active_program = this.register_signal('notify::active-program');
    this._on_program_added = this.register_signal('program-added');
    this._on_program_removed = this.register_signal('program-removed');

    this._on_changed = this.register_signal('changed');
}

Document.prototype = Object.create(Signals.prototype);
Document.prototype.constructor = Document;

Document.prototype.default_program = function() {
    return this._default_program;
}

Document.prototype._changed = function(opts) {
    this.modification_time = new Date();
    this._on_changed(opts);
}

Document.prototype._on_program_notify_name = function() {
    this._changed({
        programs: true
    })
}

Document.prototype.add_program = function(program) {
    this.programs.push(program);
    this._on_program_added(program);

    program.on('notify::name', this._on_program_notify_name, this);

    this._changed({
        programs: true
    });
}

Document.prototype.remove_program = function(program) {
    var idx = this.programs.indexOf(program);

    if (idx >= 0 && !this.programs[idx].is_default()) {
        console.log(idx);
        if (this._active_program === program) {
            if (idx !== 0) {
                this.active_program(this.programs[idx - 1]);
            } else {
                this.active_program(this.programs[idx + 1]);
            }
        }

        this.programs.splice(idx, 1);
        this._on_program_removed(program);

        program.off('notify::name', this._on_program_notify_name, this);

        this._changed({
            programs: true
        });
    }
}

Document.prototype.active_program = function(program) {
    if (typeof program === 'undefined') {
        return this._active_program;
    }

    if (program !== this._active_program) {
        this._on_notify_before_active_program();
        this._active_program = program;
        this._on_notify_active_program();

        this._changed({
            active_program: true
        });
    }
}

Document.prototype.update = function(changes) {
    if ('vertex' in changes) {
        this._active_program.vertex = {
            data: changes.vertex.data,
            history: changes.vertex.history
        };
    }

    if ('fragment' in changes) {
        this._active_program.fragment = {
            data: changes.fragment.data,
            history: changes.fragment.history
        };
    }

    if ('js' in changes) {
        this.js = {
            data: changes.js.data,
            history: changes.js.history
        };
    }

    if ('title' in changes) {
        this.title = changes.title;
        this._on_notify_title();
    }

    if ('description' in changes) {
        this.description = changes.description;
        this._on_notify_description();
    }

    if ('active_editor' in changes) {
        this.active_editor = changes.active_editor;
    }

    if ('active_program' in changes) {
        for (var i = 0; i < this.programs.length; i++) {
            if (this.programs[i].name() === changes.active_program) {
                this.active_program(this.programs[i]);
                break;
            }
        }
    }

    if ('screenshot' in changes) {
        this.screenshot = changes.screenshot;
    }

    this._changed(changes);
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
        description: this.description,
        modification_time: this.modification_time,
        creation_time: this.creation_time,
        active_editor: this.active_editor
    }

    if (this.screenshot) {
        ret.screenshot = this.screenshot;
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

        if (prg.is_default()) {
            this._default_program = prg;
        }
    }

    if (ret.programs.length === 0) {
        ret.programs.push(Program.default());
    }

    if (ret._active_program === null) {
        ret._active_program = ret.programs[0];
    }

    if ('screenshot' in doc) {
        ret.screenshot = doc.screenshot;
    }

    ret.active_editor = doc.active_editor;

    ret.js = {
        data: doc.js.data,
        history: doc.js.history
    };

    ret.title = doc.title;
    ret.description = doc.description;
    ret.modification_time = doc.modification_time;
    ret.creation_time = doc.creation_time;

    return ret;
}

module.exports = Document;

// vi:ts=4:et
