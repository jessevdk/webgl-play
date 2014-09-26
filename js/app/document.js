var fs = require('fs');
var Program = require('./program');

function Document() {
    this.id = null;

    this.programs = [Program.default()];

    this.js = fs.readFileSync(__dirname + '/default.js', 'utf-8').trimRight('\n');
    this.js_history = { done: [], undone: [] };

    this.title = 'Untitled';
    this.modification_time = new Date();
    this.creation_time = new Date();
    this.active_editor = null;

    this.active_program = this.programs[0];
}

Document.prototype.update = function(buffers) {
    if ('vertex' in buffers) {
        this.active_program.vertex = buffers.vertex.data;
        this.active_program.vertex_history = buffers.vertex.history;
    }

    if ('fragment' in buffers) {
        this.active_program.fragment = buffers.fragment;
        this.active_program.fragment_history = buffers.fragment_history;
    }

    if ('js' in buffers) {
        this.js = buffers.js.data;
        this.js_history = buffers.js.history;
    }

    if ('title' in buffers) {
        this.title = buffers.title;
    }

    if ('active_program' in buffers) {
        for (var i = 0; i < this.programs.length; i++) {
            if (this.programs[i].name === buffers.active_program) {
                this.active_program = this.programs[i];
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
        active_program: this.active_program.name,
        js: this.js,
        js_history: this.js_history,
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
    ret.active_program = null;

    if ('id' in doc) {
        ret.id = doc.id;
    }

    for (var i = 0; i < doc.programs.length; i++) {
        var prg = Program.deserialize(doc.programs[i]);
        ret.programs.push(prg);

        if (prg.name === doc.active_program) {
            ret.active_program = prg;
        }
    }

    if (ret.programs.length === 0) {
        ret.programs.push(Program.default());
    }

    if (ret.active_program === null) {
        ret.active_program = ret.programs[0];
    }

    ret.active_editor = doc.active_editor;

    ret.js = doc.js;
    ret.js_history = doc.js_history;

    ret.title = doc.title;
    ret.modification_time = doc.modification_time;
    ret.creation_time = doc.creation_time;

    return ret;
}

module.exports = Document;

// vi:ts=4:et
