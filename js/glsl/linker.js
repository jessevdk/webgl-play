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

'use strict';

var glsl = {
    source: require('./source')
};

function Error(type, loc, message) {
    glsl.source.Error.call(this, loc, message);

    this.shaderType = type;
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

exports.Error = Error;

function Linker(vertex, fragment) {
    this.vertex = vertex;
    this.fragment = fragment;

    this._errors = {
        vertex: [],
        fragment: []
    };
}

Linker.prototype._typesEqual = function(a, b) {
    if (a.isPrimitive !== b.isPrimitive ||
        a.isArray !== b.isArray ||
        a.isComposite !== b.isComposite) {

        return false;
    }

    if (a.isPrimitive) {
        return a.name === b.name;
    }

    if (a.isComposite) {
        var afields = {};
        var ret = {
            a: [],
            b: []
        };

        for (var i = 0; i < a.fields.length; i++) {
            afields[a.fields[i].name] = a.fields[i];
        }

        for (var i = 0; i < b.fields.length; i++) {
            var fb = b.fields[i];
            var fa = afields[fb.name];

            if (!fa) {
                ret.b.push({
                    location: fb.decl.location(),
                    message: 'field ' + fb.name +  ' in ' + b.name + ' missing in ' + a.name
                });
            } else {
                var d = this._typesEqual(fa.type, fb.type);

                if (d === false) {
                    var msg = 'type of field ' + fb.name + ' in vertex shader (' + fa.type.name + ') does not match type in fragment shader (' + fb.type.name + ')';

                    ret.a.push({
                        location: fa.decl.location(),
                        message: msg
                    });

                    ret.b.push({
                        location: fb.decl.location(),
                        message: msg
                    });
                } else if (d !== true) {
                    ret.a = ret.a.concat(d.a);
                    ret.b = ret.b.concat(d.b);
                }

                delete afields[fb.name];
            }
        }

        for (var k in afields) {
            var fa = afields[k];

            ret.a.push({
                location: fa.decl.location(),
                message: 'field ' + fa.name +  ' in ' + a.name + ' missing in ' + b.name
            });
        }

        if (ret.a.length !== 0 || ret.b.length !== 0) {
            return ret;
        }

        return true;
    }

    return false;
}

Linker.prototype._checkMatchingTypes = function(vv, fv, tpname) {
    var eq = this._typesEqual(vv.t.type, fv.t.type);

    if (eq === false) {
        var msg = 'type of ' + tpname + ' ' + fv.name.text + ' in vertex shader (' + vv.type.token.text + ') does not match type in fragment shader (' + fv.type.token.text + ')';

        this._vertexError(vv.location(), msg);
        this._fragmentError(fv.location(), msg);
    } else if (eq !== true) {
        for (var ei = 0; ei < eq.a.length; ei++) {
            var e = eq.a[ei];
            this._vertexError(e.location, e.message);
        }

        for (var ei = 0; ei < eq.b.length; ei++) {
            var e = eq.b[ei];
            this._fragmentError(e.location, e.message);
        }
    }
}

Linker.prototype._checkUniforms = function() {
    for (var i = 0; i < this.fragment.uniforms.length; i++) {
        var fv = this.fragment.uniforms[i];
        var vv = this.vertex.uniformMap[fv.name.text];

        if (vv) {
            this._checkMatchingTypes(vv, fv, 'uniform');
        }
    }
}

Linker.prototype._checkVaryings = function() {
    for (var i = 0; i < this.fragment.varyings.length; i++) {
        var fv = this.fragment.varyings[i];
        var vv = this.vertex.varyingMap[fv.name.text];

        if (vv) {
            this._checkMatchingTypes(vv, fv, 'varying');
        }

        // Check if all varyings used at least once by the fragment
        // shared, are declared in the vertex shader
        if (!vv && fv.t.users.length !== 0) {
            var msg = 'the varying variable ' + fv.name.text + ' (' + fv.type.token.text + ') is used in the fragment shader, but never declared in the vertex shader';

            for (var u = 0; u < fv.t.users.length; u++) {
                this._fragmentError(fv.t.users[u].location(), msg);
            }
        }
    }
}

Linker.prototype._fragmentError = function(loc, message) {
    this._error(glsl.source.FRAGMENT, loc, message);
};

Linker.prototype._vertexError = function(loc, message) {
    this._error(glsl.source.VERTEX, loc, message);
};

Linker.prototype._error = function(type, loc, message) {
    var e = new Error(type, loc, message);

    if (type === glsl.source.VERTEX) {
        this._errors.vertex.push(e);
    } else {
        this._errors.fragment.push(e);
    }
};

Linker.prototype.errors = function() {
    return this._errors;
}

Linker.prototype.link = function() {
    this._errors = {
        vertex: [],
        fragment: []
    };

    this._checkVaryings();
    this._checkUniforms();

    return this.errors();
}

exports.Linker = Linker;
exports.Error = Error;

// vi:ts=4:et
