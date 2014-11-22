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
    this._onNotifyName = this.registerSignal('notify::name');
    this._onNotifyError = this.registerSignal('notify::error');

    this._isDefault = false;
    this._error = null;
}

Program.prototype = Object.create(Signals.prototype);
Program.prototype.constructor = Program;

Program.default = function() {
    var v = fs.readFileSync(__dirname + '/default.glslv', 'utf-8');
    var f = fs.readFileSync(__dirname + '/default.glslf', 'utf-8');

    // Remove ending newline
    v = v.slice(0, v.length - 1);
    f = f.slice(0, f.length - 1);

    return new Program('Default', v, f);
}

Program.prototype.error = function(error) {
    if (typeof error === 'undefined') {
        return this._error;
    }

    this._error = error;
    this._onNotifyError();
}

Program.prototype.isDefault = function() {
    return this._isDefault;
}

Program.prototype.name = function(name) {
    if (typeof name === 'undefined') {
        return this._name;
    }

    if (this._name !== name) {
        var prev = this._name;

        this._name = name;
        this._onNotifyName(prev);
    }
}

Program.prototype._compileShader = function(gl, type, source) {
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

Program.prototype._definesToString = function(defines) {
    if (defines) {
        var ret = '';

        for (var k in defines) {
            ret += '#define ' + k + ' ' + defines[k] + '\n';
        }

        return ret;
    } else {
        return '';
    }
}

Program.prototype._sourceWithDefines = function(source, defines) {
    var m = source.match(/^\s*#version .*\n/);

    if (!m) {
        return defines + source;
    }

    var split = m.index + m[0].length;
    return source.slice(0, split) + defines + source.slice(split);
}

Program.prototype.compile = function(gl, defines) {
    var defs = this._definesToString(defines);

    var v = this._compileShader(gl, gl.VERTEX_SHADER, this._sourceWithDefines(this.vertex.data, defs));
    var f = this._compileShader(gl, gl.FRAGMENT_SHADER, this._sourceWithDefines(this.fragment.data, defs));
    var p = 0;

    var attrs = {
        'v_Position': 0,
        'v_Normal': 1,
        'v_TexCoord': 2
    };

    var error = null;

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
            error = 'linking: ' + gl.getProgramInfoLog(p);
        } else {
            gl.validateProgram(p);

            if (!gl.getProgramParameter(p, gl.VALIDATE_STATUS)) {
                error = 'validation: ' + gl.getProgramInfoLog(p);
            }
        }
    }

    return {
        vertex: v,
        fragment: f,
        program: p,
        attributes: attrs,
        isDefault: this._isDefault,
        error: error,
        name: this._name
    };
}

Program.fromRemote = function(p) {
    var ret = new Program();

    ret.vertex = {
        data: p.vertex,
        history: {done: [], undone: []}
    };

    ret.fragment = {
        data: p.fragment,
        history: {done: [], undone: []}
    };

    ret._name = p.name;
    ret._isDefault = p.isDefault || false;

    return ret;
}

Program.prototype.remote = function() {
    return {
        version: 1,
        name: this._name,
        vertex: this.vertex.data,
        fragment: this.fragment.data,
        isDefault: this._isDefault
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
        isDefault: this._isDefault
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
    ret._isDefault = program.isDefault;

    return ret;
}

module.exports = Program;

// vi:ts=4:et
