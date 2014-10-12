var Widget = require('./widget');

function ProgramsBar(e, app) {
    Widget.call(this, e);

    this._document = null;

    this.document(app.document);
    app.on('notify::document', function() {
        this.document(app.document);
    }, this);

    this._ul = e.querySelector('ul');

    this._new_program = e.querySelector('#new-program');

    this._new_program.addEventListener('mousedown', this._on_new_program_ignore.bind(this));
    this._new_program.addEventListener('dblclick', this._on_new_program_ignore.bind(this));
    this._new_program.addEventListener('click', this._on_new_program_click.bind(this));
}

ProgramsBar.prototype = Object.create(Widget.prototype);
ProgramsBar.prototype.constructor = Widget;

ProgramsBar.prototype.document = function(document) {
    if (typeof document === 'undefined') {
        return this._document;
    }

    if (this._document === document) {
        return;
    }

    if (this._document !== null) {
        this._document.off('notify::active-program', this._on_active_program_changed, this);
        this._document.off('program-added', this._on_program_added, this);
        this._document.off('program-removed', this._on_program_removed, this);

        for (var i = 0; i < this._document.programs.length; i++) {
            var p = this._document.programs[i];

            p.off('notify::name', this._on_program_name_changed);
        }
    }

    this._document = document;

    if (this._document !== null) {
        this._document.on('notify::active-program', this._on_active_program_changed, this);
        this._document.on('program-added', this._on_program_added, this);
        this._document.on('program-removed', this._on_program_removed, this);

        for (var i = 0; i < this._document.programs.length; i++) {
            var p = this._document.programs[i];
            this._on_program_added(p);
        }

        this._on_active_program_changed();
    }
}

ProgramsBar.prototype._on_new_program_ignore = function(e) {
    e.preventDefault();
}

ProgramsBar.prototype._on_new_program_click = function(e) {
    e.preventDefault();
}

ProgramsBar.prototype._find_by_name = function(name) {
    return this._ul.querySelector('[data-program-name=' + JSON.stringify(name) + ']');
}

ProgramsBar.prototype._insert_program_item = function(program, item) {
    var lis = this._ul.querySelectorAll('li');
    var found = null;

    for (var i = 0; i < lis.length; i++) {
        if (program.name() < lis[i].getAttribute('data-program-name')) {
            found = lis[i];
        }
    }

    this._ul.insertBefore(item, found);
}

ProgramsBar.prototype._on_program_name_changed = function(program, prevname) {
    var item = this._find_by_name(prevname);

    if (item) {
        item.setAttribute('data-program-name', program.name());
        item.textContent = program.name();

        this._ul.removeChild(item);
        this._insert_program_item(program, item);
    }
}

ProgramsBar.prototype._on_active_program_changed = function() {
    var sel = this._ul.querySelector('li.selected');

    if (sel) {
        sel.classList.remove('selected');
    }

    var p = this._document.active_program;
    sel = this._find_by_name(p.name());

    if (sel) {
        sel.classList.add('selected');
    }
}

ProgramsBar.prototype._on_program_added = function(program) {
    program.on('notify::name', this._on_program_name_changed, this);

    var li = document.createElement('li');
    li.setAttribute('data-program-name', program.name());
    li.textContent = program.name();

    if (program === this._document.active_program) {
        li.classList.add('selected');
    }

    this._insert_program_item(program, li);
}

ProgramsBar.prototype._on_program_removed = function(program) {
    program.off('notify::name', this._on_program_name_changed, this);

    var item = this._find_by_name(program.name());

    if (item) {
        this._ul.removeChild(item);
    }
}

module.exports = ProgramsBar;

// vi:ts=4:et
