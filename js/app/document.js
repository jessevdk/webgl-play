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

    this.modificationTime = new Date();
    this.creationTime = new Date();
    this.activeEditor = null;
    this.screenshot = null;
    this.state = {};
    this.share = null;
    this.license = null;
    this.author = null;

    this._activeProgram = this.programs[0];
    this._activeProgram._isDefault = true;

    this._defaultProgram = this._activeProgram;

    this._onNotifyTitle = this.registerSignal('notify::title');
    this._onNotifyDescription = this.registerSignal('notify::description');
    this._onNotifyBeforeActiveProgram = this.registerSignal('notify-before::active-program');
    this._onNotifyActiveProgram = this.registerSignal('notify::active-program');
    this._onProgramAdded = this.registerSignal('program-added');
    this._onProgramRemoved = this.registerSignal('program-removed');

    this._onChanged = this.registerSignal('changed');
}

Document.prototype = Object.create(Signals.prototype);
Document.prototype.constructor = Document;

Document.prototype.defaultProgram = function() {
    return this._defaultProgram;
}

Document.prototype._changed = function(opts) {
    this.modificationTime = new Date();
    this._onChanged(opts);
}

Document.prototype._onProgramNotifyName = function() {
    this._changed({
        programs: true
    })
}

Document.prototype.addProgram = function(program) {
    this.programs.push(program);
    this._onProgramAdded(program);

    program.on('notify::name', this._onProgramNotifyName, this);

    this._changed({
        programs: true
    });
}

Document.prototype.removeProgram = function(program) {
    var idx = this.programs.indexOf(program);

    if (idx >= 0 && !this.programs[idx].isDefault()) {
        console.log(idx);
        if (this._activeProgram === program) {
            if (idx !== 0) {
                this.activeProgram(this.programs[idx - 1]);
            } else {
                this.activeProgram(this.programs[idx + 1]);
            }
        }

        this.programs.splice(idx, 1);
        this._onProgramRemoved(program);

        program.off('notify::name', this._onProgramNotifyName, this);

        this._changed({
            programs: true
        });
    }
}

Document.prototype.activeProgram = function(program) {
    if (typeof program === 'undefined') {
        return this._activeProgram;
    }

    if (program !== this._activeProgram) {
        this._onNotifyBeforeActiveProgram();
        this._activeProgram = program;
        this._onNotifyActiveProgram();

        this._changed({
            activeProgram: true
        });
    }
}

Document.prototype.update = function(changes) {
    if ('vertex' in changes) {
        this._activeProgram.vertex = {
            data: changes.vertex.data,
            history: changes.vertex.history
        };
    }

    if ('fragment' in changes) {
        this._activeProgram.fragment = {
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
        this._onNotifyTitle();
    }

    if ('description' in changes) {
        this.description = changes.description;
        this._onNotifyDescription();
    }

    if ('activeProgram' in changes) {
        for (var i = 0; i < this.programs.length; i++) {
            if (this.programs[i].name() === changes.activeProgram) {
                this.activeProgram(this.programs[i]);
                break;
            }
        }
    }

    // Simple properties
    var props = ['activeEditor', 'screenshot', 'share', 'license', 'author'];

    for (var i = 0; i < props.length; i++) {
        var p = props[i];

        if (p in changes) {
            this[p] = changes[p];
        }
    }

    this._changed(changes);
}

Document.fromRemote = function(share, doc) {
    var ret = new Document();

    ret.share = share;
    ret.programs = [];
    ret._defaultProgram = null;

    for (var i = 0; i < doc.programs.length; i++) {
        var prg = Program.fromRemote(doc.programs[i]);
        ret.programs.push(prg);

        if (prg.isDefault()) {
            ret._defaultProgram = prg;
        }
    }

    if (ret.programs.length === 0) {
        ret.programs.push(Program.default());
    }

    ret._activeProgram = ret.programs[0];

    if (!ret._defaultProgram) {
        ret._defaultProgram = ret.programs[0];
        ret.programs[0]._isDefault = true;
    }

    ret.js = {
        data: doc.javascript,
        history: {done: [], undone: []}
    };

    // Simple properties
    var props = ['title', 'description', 'license', 'author'];

    for (var i = 0; i < props.length; i++) {
        var p = props[i];
        ret[p] = doc[p];
    }

    ret.modificationTime = new Date();
    ret.creationTime = new Date(doc.creationTime);

    ret.state = {};

    return ret;
}

Document.prototype.remote = function() {
    var programs = [];

    for (var i = 0; i < this.programs.length; i++) {
        programs.push(this.programs[i].remote());
    }

    return {
        version: 1,
        title: this.title,
        description: this.description,
        programs: programs,
        javascript: this.js.data,
        creationTime: this.creationTime,
        license: this.license,
        author: this.author
    };
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
        activeProgram: this._activeProgram.name(),
        js: {
            data: this.js.data,
            history: this.js.history,
        },
        title: this.title,
        description: this.description,
        modificationTime: this.modificationTime,
        creationTime: this.creationTime,
        activeEditor: this.activeEditor,
        screenshot: this.screenshot,
        share: this.share,
        license: this.license,
        author: this.author
    }

    if (this.id !== null) {
        ret.id = this.id;
    }

    return ret;
}

Document.deserialize = function(doc) {
    var ret = new Document();

    ret.programs = [];
    ret._activeProgram = null;
    ret._defaultProgram = null;

    if ('id' in doc) {
        ret.id = doc.id;
    }

    for (var i = 0; i < doc.programs.length; i++) {
        var prg = Program.deserialize(doc.programs[i]);
        ret.programs.push(prg);

        if (prg.name() === doc.activeProgram) {
            ret._activeProgram = prg;
        }

        if (prg.isDefault()) {
            ret._defaultProgram = prg;
        }
    }

    if (ret.programs.length === 0) {
        ret.programs.push(Program.default());
    }

    if (!ret._defaultProgram) {
        ret._defaultProgram = ret.programs[0];
        ret.programs[0]._isDefault = true;
    }

    if (ret._activeProgram === null) {
        ret._activeProgram = ret.programs[0];
    }

    var props = ['title', 'description', 'modificationTime', 'creationTime', 'state', 'screenshot', 'share', 'license', 'author', 'activeEditor'];

    for (var i = 0; i < props.length; i++) {
        var p = props[i];

        if (p in doc) {
            ret[p] = doc[p];
        }
    }

    ret.js = {
        data: doc.js.data,
        history: doc.js.history
    };

    if (typeof ret.state === 'undefined') {
        ret.state = {};
    }

    return ret;
}

module.exports = Document;

// vi:ts=4:et
