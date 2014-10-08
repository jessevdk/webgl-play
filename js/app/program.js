var fs = require('fs');

function Program(name, v, f) {
    this.vertex = {
        data: v,
        history: { done: [], undone: [] }
    };

    this.fragment = {
        data: f,
        history: { done: [], undone: [] }
    };

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
    var v = this._compile_shader(gl, gl.VERTEX_SHADER, this.vertex.data);
    var f = this._compile_shader(gl, gl.FRAGMENT_SHADER, this.fragment.data);

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
        vertex: {
            data: this.vertex.data,
            history: this.vertex.history
        },
        fragment: {
            data: this.fragment.data,
            history: this.fragment.history
        }
    };
}

Program.deserialize = function(program) {
    var ret = new Program();

    ret.vertex = {
        data: program.vertex.data,
        history: program.vertex.history
    };

    ret.fragment = {
        data: program.fragment.data,
        history: program.fragment.history
    };

    ret.name = program.name;

    return ret;
}

module.exports = Program;

// vi:ts=4:et
