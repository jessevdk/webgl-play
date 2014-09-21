var fs = require('fs');
var Program = require('./program');

function Document() {
    this.programs = [Program.default()];
    this.js = fs.readFileSync(__dirname + '/default.js', 'utf-8');

    this.active_program = this.programs[0];
}

Document.prototype.serialize = function() {
    var programs = [];

    for (var i = 0; i < this.programs.length; i++) {
        var p = this.programs[i];
        programs.push(p.serialize());
    }

    return {
        version: 1,
        programs: programs,
        active_program: this.active_program.name,
        js: this.js
    }
}

module.exports = Document;

// vi:ts=4:et
