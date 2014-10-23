'use strict';

var glsl = {
    source: require('./source')
};

function Error(type, loc, message) {
    glsl.source.Error.call(this, loc, message);

    this.shader_type = type;
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

Linker.prototype._types_equal = function(a, b) {
    if (a.is_primitive !== b.is_primitive ||
        a.is_array !== b.is_array ||
        a.is_composite !== b.is_composite) {

        return false;
    }

    if (a.is_primitive) {
        return a.name === b.name;
    }

    if (a.is_composite) {
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
                var d = this._types_equal(fa.type, fb.type);

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

Linker.prototype._check_matching_types = function(vv, fv, tpname) {
    var eq = this._types_equal(vv.t.type, fv.t.type);

    if (eq === false) {
        var msg = 'type of ' + tpname + ' ' + fv.name.text + ' in vertex shader (' + vv.type.token.text + ') does not match type in fragment shader (' + fv.type.token.text + ')';

        this._vertex_error(vv.location(), msg);
        this._fragment_error(fv.location(), msg);
    } else if (eq !== true) {
        for (var ei = 0; ei < eq.a.length; ei++) {
            var e = eq.a[ei];
            this._vertex_error(e.location, e.message);
        }

        for (var ei = 0; ei < eq.b.length; ei++) {
            var e = eq.b[ei];
            this._fragment_error(e.location, e.message);
        }
    }
}

Linker.prototype._check_uniforms = function() {
    for (var i = 0; i < this.fragment.uniforms.length; i++) {
        var fv = this.fragment.uniforms[i];
        var vv = this.vertex.uniform_map[fv.name.text];

        if (vv) {
            this._check_matching_types(vv, fv, 'uniform');
        }
    }
}

Linker.prototype._check_varyings = function() {
    for (var i = 0; i < this.fragment.varyings.length; i++) {
        var fv = this.fragment.varyings[i];
        var vv = this.vertex.varying_map[fv.name.text];

        if (vv) {
            this._check_matching_types(vv, fv, 'varying');
        }

        // Check if all varyings used at least once by the fragment
        // shared, are declared in the vertex shader
        if (!vv && fv.t.users.length !== 0) {
            var msg = 'the varying variable ' + fv.name.text + ' (' + fv.type.token.text + ') is used in the fragment shader, but never declared in the vertex shader';

            for (var u = 0; u < fv.t.users.length; u++) {
                this._fragment_error(fv.t.users[u].location(), msg);
            }
        }
    }
}

Linker.prototype._fragment_error = function(loc, message) {
    this._error(glsl.source.FRAGMENT, loc, message);
};

Linker.prototype._vertex_error = function(loc, message) {
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

    this._check_varyings();
    this._check_uniforms();

    return this.errors();
}

exports.Linker = Linker;
exports.Error = Error;

// vi:ts=4:et
