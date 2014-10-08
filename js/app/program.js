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

    var log = gl.getShaderInfoLog(ret);

    if (log.length === 0) {
        log = null;
    } else {
        gl.deleteShader(ret);
        ret = 0;
    }

    return {
        id: ret,
        error: log
    };
}

Program.prototype.compile = function(gl) {
    var v = this._compile_shader(gl, gl.VERTEX_SHADER, this.vertex.data);
    var f = this._compile_shader(gl, gl.FRAGMENT_SHADER, this.fragment.data);
    var p = 0;

    var attrs = {
        'v_Position': 0,
        'v_Normal': 1,
        'v_TexCoord': 2
    };

    if (v.id === 0 || f.id === 0) {
        if (v.id !== 0) {
            gl.deleteShader(v.id);
            v.id = 0;
        }

        if (f.id !== 0) {
            gl.deleteShader(f.id);
            f.id = 0;
        }
    } else {
        p = gl.createProgram();

        gl.attachShader(p, v.id);
        gl.attachShader(p, f.id);

        for (attr in attrs) {
            gl.bindAttribLocation(p, attrs[attr], attr);
        }

        gl.linkProgram(p);

        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            throw new Error('could not link program');
        }
    }

    return {
        vertex: v,
        fragment: f,
        program: p,
        attributes: attrs
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
