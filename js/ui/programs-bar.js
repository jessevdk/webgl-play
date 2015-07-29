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

var Widget = require('./widget');
var Button = require('./button');
var Program = require('../app/program');

function ProgramsBar(e, app) {
    Widget.call(this, 'programs-bar', null, { wrap: e });

    this._document = null;
    this._showDelete = null;

    this.document(app.document);

    app.on('notify::document', function() {
        this.document(app.document);
    }, this);

    this._ul = e.querySelector('ul');

    this._newProgram = new Button({ wrap: e.querySelector('#new-program') });
    this._newProgram.on('click', this._onNewProgramClick, this);

    this._newProgramName = e.querySelector('#new-program-name');
    this._newProgramName.addEventListener('keypress', this._onNewProgramNameKeypress.bind(this));
}

ProgramsBar.prototype = Object.create(Widget.prototype);
ProgramsBar.prototype.constructor = Widget;

ProgramsBar.prototype._onNewProgramNameKeypress = function(e) {
    if (e.keyCode === 13) {
        this._onNewProgramClick(this._newProgram, e);
    }
};

ProgramsBar.prototype.document = function(document) {
    if (typeof document === 'undefined') {
        return this._document;
    }

    if (this._document === document) {
        return;
    }

    var i, p;

    if (this._document !== null) {
        this._document.off('notify::active-program', this._onActiveProgramChanged, this);
        this._document.off('program-added', this._onProgramAdded, this);
        this._document.off('program-removed', this._onProgramRemoved, this);

        for (i = 0; i < this._document.programs.length; i++) {
            p = this._document.programs[i];
            this._onProgramRemoved(this._document, p, true);
        }
    }

    this._document = document;

    if (this._document !== null) {
        this._document.on('notify::active-program', this._onActiveProgramChanged, this);
        this._document.on('program-added', this._onProgramAdded, this);
        this._document.on('program-removed', this._onProgramRemoved, this);

        for (i = 0; i < this._document.programs.length; i++) {
            p = this._document.programs[i];
            this._onProgramAdded(this._document, p);
        }

        this._onActiveProgramChanged();
    }
};

ProgramsBar.prototype._uniqueProgramName = function(name) {
    var names = {};

    var i;

    for (i = 0; i < this._document.programs.length; i++) {
        names[this._document.programs[i].name()] = true;
    }

    i = 0;
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
};

ProgramsBar.prototype._onNewProgramClick = function(button, e) {
    var name = this._newProgramName.value.trim();

    if (name.length === 0) {
        this._newProgramName.focus();
        return;
    }

    var prg = Program.default();
    var uname = this._uniqueProgramName(name);

    prg.name(uname);
    this._document.addProgram(prg);
    this._document.activeProgram(prg);

    this._newProgramName.value = '';

    e.preventDefault();
    e.stopPropagation();
};

ProgramsBar.prototype._findByName = function(name) {
    return this._ul.querySelector('[data-program-name=' + JSON.stringify(name) + ']');
};

ProgramsBar.prototype._insertProgramItem = function(program, item) {
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
};

ProgramsBar.prototype._displayName = function(program) {
    var name = program.name();

    if (program.isDefault()) {
        return '► ' + name;
    }

    return name;
};

ProgramsBar.prototype._onProgramNameChanged = function(program, prevname) {
    var item = this._findByName(prevname);

    if (item) {
        item.setAttribute('data-program-name', program.name());
        item.querySelector('span.name').textContent = this._displayName(program);

        this._ul.removeChild(item);
        this._insertProgramItem(program, item);
    }
};

ProgramsBar.prototype._onActiveProgramChanged = function() {
    var sel = this._ul.querySelector('li.selected');

    if (sel) {
        sel.classList.remove('selected');
    }

    var p = this._document.activeProgram();
    sel = this._findByName(p.name());

    if (sel) {
        sel.classList.add('selected');
    }

    if (this._showDelete !== null && this._showDelete.element !== sel) {
        this._onProgramToggleDelete(this._showDelete.element, this._showDelete.program);
    }
};

ProgramsBar.prototype._onProgramClick = function(program) {
    this._document.activeProgram(program);
};

ProgramsBar.prototype._onProgramToggleDelete = function(elem, program) {
    var del;

    if (elem.classList.contains('deleting')) {
        elem.classList.remove('deleting');

        del = elem.querySelector('div.delete');
        del.classList.remove('animate-in');

        this._showDelete = null;

        setTimeout(function() {
            elem.removeChild(del);
        }, 300);
    } else {
        elem.classList.add('deleting');

        del = document.createElement('div');
        del.classList.add('delete');
        del.setAttribute('title', 'Delete Program');

        var span = document.createElement('span');
        span.textContent = '✖';
        del.appendChild(span);

        elem.appendChild(del);

        // trigger re-layout
        del.offsetWidth; // jshint ignore:line
        del.classList.add('animate-in');

        del.addEventListener('click', (function(e) {
            this._document.removeProgram(program);
            e.preventDefault();
            e.stopPropagation();
        }).bind(this));

        this._showDelete = {
            element: elem,
            program: program
        };
    }
};

ProgramsBar.prototype._onProgramBeginEditName = function(elem, program) {
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
            program.name(this._uniqueProgramName(name));
        }
    }).bind(this));
};

ProgramsBar.prototype._onProgramErrorChanged = function(program) {
    var elem = this._findByName(program.name());

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
};

ProgramsBar.prototype._onProgramAdded = function(doc, program) {
    program.on('notify::name', this._onProgramNameChanged, this);
    program.on('notify::error', this._onProgramErrorChanged, this);

    var li = document.createElement('li');
    li.setAttribute('data-program-name', program.name());

    var span = document.createElement('span');
    span.classList.add('name');
    span.textContent = this._displayName(program);

    li.appendChild(span);

    li.addEventListener('click', (function(e) {
        this._onProgramClick(program);
        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    li.addEventListener('contextmenu', (function(e) {
        this._onProgramClick(program);

        if (!program.isDefault()) {
            this._onProgramToggleDelete(li, program);
        }

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    li.addEventListener('dblclick', (function(e) {
        this._onProgramBeginEditName(li, program);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    if (program === this._document.activeProgram()) {
        li.classList.add('selected');
    }

    this._insertProgramItem(program, li);
    this._onProgramErrorChanged(program);
};

ProgramsBar.prototype._onProgramRemoved = function(doc, program, changingDoc) {
    program.off('notify::name', this._onProgramNameChanged, this);
    program.off('notify::error', this._onProgramErrorChanged, this);

    var item = this._findByName(program.name());

    if (item) {
        if (!changingDoc) {
            item.classList.add('removed');

            if (this._showDelete !== null && this._showDelete.element === item) {
                this._onProgramToggleDelete(item, program);
            }

            setTimeout((function() {
                this._ul.removeChild(item);
            }).bind(this), 300);
        } else {
            if (this._showDelete !== null && this._showDelete.element === item) {
                this._showDelete = null;
            }

            this._ul.removeChild(item);
        }
    }
};

module.exports = ProgramsBar;

// vi:ts=4:et
