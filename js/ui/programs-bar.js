var Widget = require('./widget');
var Button = require('./button');
var Program = require('../app/program');

function ProgramsBar(e, app) {
    Widget.call(this, e);

    this._document = null;
    this._show_delete = null;

    this.document(app.document);

    app.on('notify::document', function() {
        this.document(app.document);
    }, this);

    this._ul = e.querySelector('ul');

    this._new_program = new Button(e.querySelector('#new-program'));
    this._new_program.on('click', this._on_new_program_click, this);

    this._new_program_name = e.querySelector('#new-program-name');
    this._new_program_name.addEventListener('keypress', this._on_new_program_name_keypress.bind(this));
}

ProgramsBar.prototype = Object.create(Widget.prototype);
ProgramsBar.prototype.constructor = Widget;

ProgramsBar.prototype._on_new_program_name_keypress = function(e) {
    if (e.keyCode === 13) {
        this._on_new_program_click(this._new_program, e);
    }
}

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
            this._on_program_removed(this._document, p, true);
        }
    }

    this._document = document;

    if (this._document !== null) {
        this._document.on('notify::active-program', this._on_active_program_changed, this);
        this._document.on('program-added', this._on_program_added, this);
        this._document.on('program-removed', this._on_program_removed, this);

        for (var i = 0; i < this._document.programs.length; i++) {
            var p = this._document.programs[i];
            this._on_program_added(this._document, p);
        }

        this._on_active_program_changed();
    }
}

ProgramsBar.prototype._unique_program_name = function(name) {
    var names = {};

    for (var i = 0; i < this._document.programs.length; i++) {
        names[this._document.programs[i].name()] = true;
    }

    var i = 0;
    var uname;

    while (true) {
        uname = name;

        if (i !== 0) {
            uname += ' ' + i;
        }

        if (!(uname in names)) {
            break;
        }

        i++;
    }

    return uname;
}

ProgramsBar.prototype._on_new_program_click = function(button, e) {
    var name = this._new_program_name.value.trim();

    if (name.length === 0) {
        this._new_program_name.focus();
        return;
    }

    var prg = Program.default();
    var uname = this._unique_program_name(name);

    prg.name(uname);
    this._document.add_program(prg);
    this._document.active_program(prg);

    this._new_program_name.value = '';

    e.preventDefault();
    e.stopPropagation();
}

ProgramsBar.prototype._find_by_name = function(name) {
    return this._ul.querySelector('[data-program-name=' + JSON.stringify(name) + ']');
}

ProgramsBar.prototype._insert_program_item = function(program, item) {
    var lis = this._ul.querySelectorAll('li');
    var found = null;

    for (var i = 0; i < lis.length; i++) {
        var attr = lis[i].getAttribute('data-program-name');
        if (!attr || program.name() < attr) {
            found = lis[i];
            break;
        }
    }

    this._ul.insertBefore(item, found);
}

ProgramsBar.prototype._display_name = function(program) {
    var name = program.name();

    if (program.is_default()) {
        return '► ' + name;
    }

    return name;
}

ProgramsBar.prototype._on_program_name_changed = function(program, prevname) {
    var item = this._find_by_name(prevname);

    if (item) {
        item.setAttribute('data-program-name', program.name());
        item.querySelector('span.name').textContent = this._display_name(program);

        this._ul.removeChild(item);
        this._insert_program_item(program, item);
    }
}

ProgramsBar.prototype._on_active_program_changed = function() {
    var sel = this._ul.querySelector('li.selected');

    if (sel) {
        sel.classList.remove('selected');
    }

    var p = this._document.active_program();
    sel = this._find_by_name(p.name());

    if (sel) {
        sel.classList.add('selected');
    }

    if (this._show_delete !== null && this._show_delete.element !== sel) {
        this._on_program_toggle_delete(this._show_delete.element, this._show_delete.program);
    }
}

ProgramsBar.prototype._on_program_click = function(program) {
    this._document.active_program(program);
}

ProgramsBar.prototype._on_program_toggle_delete = function(elem, program) {
    var name = elem.querySelector('span.name');

    if (elem.classList.contains('deleting')) {
        elem.classList.remove('deleting');

        var del = elem.querySelector('div.delete');
        del.classList.remove('animate-in');

        this._show_delete = null;

        setTimeout(function() {
            elem.removeChild(del);
        }, 300);
    } else {
        elem.classList.add('deleting');

        var del = document.createElement('div');
        del.classList.add('delete');
        del.setAttribute('title', 'Delete Program');

        var span = document.createElement('span');
        span.textContent = '✖';
        del.appendChild(span);

        elem.appendChild(del);

        // trigger re-layout
        del.offsetWidth;
        del.classList.add('animate-in');

        del.addEventListener('click', (function(e) {
            this._document.remove_program(program);
            e.preventDefault();
            e.stopPropagation();
        }).bind(this));

        this._show_delete = {
            element: elem,
            program: program
        };
    }
}

ProgramsBar.prototype._on_program_begin_edit_name = function(elem, program) {
    if (elem.classList.contains('editing')) {
        return;
    }

    elem.classList.add('editing');
    var inp = document.createElement('input');
    inp.setAttribute('type', 'text');
    inp.value = program.name();

    elem.appendChild(inp);
    inp.select(0, program.name().length);

    inp.addEventListener('keydown', (function(e) {
        switch (e.keyCode) {
        case 27:
            // Escape, cancel
            if (inp.value === program.name()) {
                inp.blur();
            } else {
                inp.value = program.name();
                inp.select(0, inp.value.length);
            }
            break;
        case 13:
            // Enter, accept
            inp.blur();
            break;
        default:
            return;
        }

        e.stopPropagation();
        e.preventDefault();
    }).bind(this));

    inp.addEventListener('blur', (function() {
        elem.classList.remove('editing');
        elem.removeChild(inp);

        var name = inp.value.trim();

        if (name.length !== 0 && program.name() !== name) {
            // Make unique
            program.name(this._unique_program_name(name));
        }
    }).bind(this));
}

ProgramsBar.prototype._on_program_error_changed = function(program) {
    var elem = this._find_by_name(program.name());

    if (elem) {
        var e = program.error();

        if (e) {
            elem.classList.add('error');

            var errors = [];

            if (e.vertex !== null) {
                errors.push(e.vertex);
            }

            if (e.fragment !== null) {
                errors.push(e.fragment);
            }

            if (e.program !== null) {
                errors.push(e.program);
            }

            elem.setAttribute('title', errors.join('\n'));
        } else {
            elem.classList.remove('error');
            elem.setAttribute('title', '');
        }
    }
}

ProgramsBar.prototype._on_program_added = function(doc, program) {
    program.on('notify::name', this._on_program_name_changed, this);
    program.on('notify::error', this._on_program_error_changed, this);

    var li = document.createElement('li');
    li.setAttribute('data-program-name', program.name());

    var span = document.createElement('span');
    span.classList.add('name');
    span.textContent = this._display_name(program);

    li.appendChild(span);

    li.addEventListener('click', (function(e) {
        this._on_program_click(program);
        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    li.addEventListener('contextmenu', (function(e) {
        this._on_program_click(program);

        if (!program.is_default()) {
            this._on_program_toggle_delete(li, program);
        }

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    li.addEventListener('dblclick', (function(e) {
        this._on_program_begin_edit_name(li, program);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    if (program === this._document.active_program()) {
        li.classList.add('selected');
    }

    this._insert_program_item(program, li);
    this._on_program_error_changed(program);
}

ProgramsBar.prototype._on_program_removed = function(doc, program, changing_doc) {
    program.off('notify::name', this._on_program_name_changed, this);
    program.off('notify::error', this._on_program_error_changed, this);

    var item = this._find_by_name(program.name());

    if (item) {
        if (!changing_doc) {
            item.classList.add('removed');

            if (this._show_delete !== null && this._show_delete.element === item) {
                this._on_program_toggle_delete(elem, program);
            }

            setTimeout((function() {
                this._ul.removeChild(item);
            }).bind(this), 300);
        } else {
            if (this._show_delete !== null && this._show_delete.element === item) {
                this._show_delete = null;
            }

            this._ul.removeChild(item);
        }
    }
}

module.exports = ProgramsBar;

// vi:ts=4:et
