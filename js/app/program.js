var fs = require('fs');

function Program(name, v, f) {
    this.vertex = v;
    this.vertex_history = { done: [], undone: [] };

    this.fragment = f;
    this.fragment_history = { done: [], undone: [] };

    this.name = name;
}

Program.default = function() {
    var v = fs.readFileSync(__dirname + '/default.glslv', 'utf-8').trimRight('\n');
    var f = fs.readFileSync(__dirname + '/default.glslf', 'utf-8').trimRight('\n');

    return new Program('default', v, f);
}

Program.prototype._compile_shader = function(gl, type, source) {
    var ret = gl.createShader(type);

    gl.shaderSource(ret, source);
    gl.compileShader(ret);

    return ret;
}

Program.prototype.compile = function(gl) {
    var v = this._compile_shader(gl, gl.VERTEX_SHADER, this.vertex);
    var f = this._compile_shader(gl, gl.FRAGMENT_SHADER, this.fragment);

    var p = gl.createProgram();

    gl.attachShader(p, v);
    gl.attachShader(p, f);

    gl.linkProgram(p);

    return {
        vertex: v,
        fragment: f,
        program: p
    }
}

Program.prototype.serialize = function() {
    return {
        version: 1,
        name: this.name,
        vertex: this.vertex,
        vertex_history: this.vertex_history,
        fragment: this.fragment,
        fragment_history: this.fragment_history,
    };
}

Program.deserialize = function(program) {
    var ret = new Program();

    ret.vertex = program.vertex;
    ret.vertex_history = program.vertex_history;

    ret.fragment = program.fragment;
    ret.fragment_history = program.fragment_editor;

    ret.name = program.name;

    return ret;
}

module.exports = Program;

// vi:ts=4:et
