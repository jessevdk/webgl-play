var fs = require('fs');
var Signals = require('../signals/signals');

function Program(name, v, f) {
    Signals.call(this);

    this.vertex = {
        data: v,
        history: { done: [], undone: [] }
    };

    this.fragment = {
        data: f,
        history: { done: [], undone: [] }
    };

    this._name = name;
    this._on_notify_name = this.register_signal('notify::name');
    this._on_notify_error = this.register_signal('notify::error');

    this._is_default = false;
    this._error = null;
}

Program.prototype = Object.create(Signals.prototype);
Program.prototype.constructor = Program;

Program.default = function() {
    var v = fs.readFileSync(__dirname + '/default.glslv', 'utf-8').trimRight('\n');
    var f = fs.readFileSync(__dirname + '/default.glslf', 'utf-8').trimRight('\n');

    return new Program('Default', v, f);
}

Program.prototype.error = function(error) {
    if (typeof error === 'undefined') {
        return this._error;
    }

    this._error = error;
    this._on_notify_error();
}

Program.prototype.is_default = function() {
    return this._is_default;
}

Program.prototype.name = function(name) {
    if (typeof name === 'undefined') {
        return this._name;
    }

    if (this._name !== name) {
        var prev = this._name;

        this._name = name;
        this._on_notify_name(prev);
    }
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
        attributes: attrs,
        is_default: this._is_default
    };
}

Program.prototype.serialize = function() {
    return {
        version: 1,
        name: this._name,
        vertex: {
            data: this.vertex.data,
            history: this.vertex.history
        },
        fragment: {
            data: this.fragment.data,
            history: this.fragment.history
        },
        is_default: this._is_default
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

    ret._name = program.name;
    ret._is_default = program.is_default;

    return ret;
}

module.exports = Program;

// vi:ts=4:et
