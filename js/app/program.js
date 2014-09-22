var fs = require('fs');

function Program(name, v, f) {
    this.vertex = v;
    this.fragment = f;
    this.name = name;
}

Program.default = function() {
    var v = fs.readFileSync(__dirname + '/default.glslv', 'utf-8').trimRight('\n');
    var f = fs.readFileSync(__dirname + '/default.glslf', 'utf-8').trimRight('\n');

    return new Program('default', v, f);
}

Program.prototype.serialize = function() {
    return {
        version: 1,
        name: this.name,
        vertex: this.vertex,
        fragment: this.fragment
    };
}

module.exports = Program;

// vi:ts=4:et
