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

var math = require('../math/math');
var Texture = require('./texture');
var utils = require('../utils/utils');

/**
 * A basic material. A material contains a specification of the material
 * properties used to render a model. These material properties are transfered
 * to a glsl program as uniforms.
 *
 * @param uniforms initial material uniforms.
 *
 * @constructor
 */
function Material(uniforms) {
    /**
     * A map of uniform names to values. Any values set in this map,
     * with a corresponding uniform in the material program, are
     * automatically bound to the 'material' uniform when the material
     * is used. Use the various math.vec/mat types to map to the glsl
     * types.
     */
    this.uniforms = utils.merge({
        ambient: {
            color: math.vec4(1.0, 1.0, 1.0, 1.0),
            intensity: 0.1
        },

        diffuse: {
            color: math.vec4(0.8, 0.8, 0.8, 1.0),
            intensity: 0.8
        },

        specular: {
            color: math.vec4(1.0, 1.0, 1.0, 1.0),
            intensity: 0.5,
            hardness: 50.0
        }
    }, uniforms);

    this._texunit = 0;
    this._textures = {};

    /**
     * Sets the visibility of the material. The value should be one of
     * Material.VISIBLE, Material.INVISIBLE or Material.ONLY_CHILDREN.
     * Models with an invisible material are not rendered at all, while
     * models with a material visibility set to Material.ONLY_CHILDREN will
     * render only the models children (but not the model itself) (defaults
     * to Material.VISIBLE).
     */
    this.visible = true;

    /**
     * The name of the program to render, or null to use the default
     * program (defaults to null).
     */
    this.program = null;
}

Material._ignoreUniforms = {
    model: true,
    view: true,
    modelView: true,
    projection: true,
    modelViewProjection: true
};

Material._ignoreUniforms['material.ambient.color'] = true;
Material._ignoreUniforms['material.ambient.intensity'] = true;
Material._ignoreUniforms['material.diffuse.color'] = true;
Material._ignoreUniforms['material.diffuse.intensity'] = true;
Material._ignoreUniforms['material.specular.color'] = true;
Material._ignoreUniforms['material.specular.intensity'] = true;
Material._ignoreUniforms['material.specular.hardness'] = true;

Material.prototype._mixColor = function(mecol, color, prop) {
    mecol[prop] = math.vec4(mecol.color[0] * mecol.intensity * color[0],
                            mecol.color[1] * mecol.intensity * color[1],
                            mecol.color[2] * mecol.intensity * color[2],
                            mecol.color[3] * color[3]);
}

Material.prototype.mixColors = function(color, prop) {
    this._mixColor(this.uniforms.ambient, color, prop);
    this._mixColor(this.uniforms.diffuse, color, prop);
    this._mixColor(this.uniforms.specular, color, prop);
}

Material.prototype._setUniformTyped = function(ctx, u, v, name) {
    var l;

    if (v.typeLength) {
        l = v.typeLength;
    } else {
        l = v.length;
    }

    switch (Object.getPrototypeOf(v)) {
    case Float32Array.prototype:
        switch (l) {
        case 1:
            ctx.gl.uniform1fv(u, v);
            break;
        case 2:
            ctx.gl.uniform2fv(u, v);
            break;
        case 3:
            ctx.gl.uniform3fv(u, v);
            break;
        case 4:
            if (v.isMat) {
                ctx.gl.uniformMatrix2fv(u, false, v);
            } else {
                ctx.gl.uniform4fv(u, v);
            }
            break;
        case 9:
            ctx.gl.uniformMatrix3fv(u, false, v);
            break;
        case 16:
            ctx.gl.uniformMatrix4fv(u, false, v);
            break;
        default:
            throw new Error('cannot set uniform ' + name + ' = ' + v);
        }
        break;
    case Int32Array.prototype:
        switch (l) {
        case 1:
            ctx.gl.uniform1iv(u, v);
            break;
        case 2:
            ctx.gl.uniform2iv(u, v);
            break;
        case 3:
            ctx.gl.uniform3iv(u, v);
            break;
        case 4:
            ctx.gl.uniform4iv(u, v);
            break;
        default:
            throw new Error('cannot set uniform ' + name + ' = ' + v);
        }
        break;
    default:
        break;
    }
}

Material.prototype._setUniform = function(ctx, u, v, name) {
    if (typeof v === 'number') {
        ctx.gl.uniform1f(u, v);
        return;
    }

    if (typeof v === 'boolean') {
        ctx.gl.uniform1i(u, v);
        return;
    }

    switch (Object.getPrototypeOf(v)) {
    case Float32Array.prototype:
    case Int32Array.prototype:
        this._setUniformTyped(ctx, u, v, name);
        break;
    case Texture.prototype:
        var unit = this._texunit++;
        v.bind(ctx, unit);
        ctx.gl.uniform1i(u, unit);
        break;
    default:
        throw new Error('cannot set uniform ' + v);
    }
}

Material.prototype._setUniforms = function(ctx, p, uniforms, prefix, depth, seen) {
    if (!seen) {
        seen = [];
    }

    if (!depth) {
        depth = 0;
    }

    if (depth > 4) {
        throw new Error('maximum nested levels of uniforms exceeded (maximum is ' + depth + ')');
    }

    if (!p.uniforms) {
        p.uniforms = {};
    }

    for (var k in uniforms) {
        if (!uniforms.hasOwnProperty(k)) {
            continue;
        }

        var fname;

        if (prefix) {
            fname = prefix + '.' + k;
        } else {
            fname = k;
        }

        var v = uniforms[k];

        if (typeof v === 'object') {
            if (v === null || seen.indexOf(v) !== -1) {
                continue;
            }

            var proto = Object.getPrototypeOf(v);
            seen.push(v);

            if (proto !== Float32Array.prototype && proto !== Int32Array.prototype && proto !== Texture.prototype && proto !== Array.prototype) {
                this._setUniforms(ctx, p, v, fname, depth + 1, seen);
                continue;
            }
        }

        if (!(fname in p.uniforms)) {
            p.uniforms[fname] = ctx.gl.getUniformLocation(p.program, fname);

            if (p.uniforms[fname] === null && !Material._ignoreUniforms[fname]) {
                console.error('could not find uniform location for ' + p.name + '.' + fname);
            }
        }

        var u = p.uniforms[fname];

        if (u !== null) {
            this._setUniform(ctx, u, v, fname);
        }
    }
}

/**
 * Bind the material in the given context. This sets up the material
 * program as well as binding all the material uniforms. Additional
 * non-material uniforms can be provided (for example the modelViewProjection
 * matrix).
 *
 * Note that this is automatically called when rendering a model and
 * should usually not be called by the user.
 *
 * @param ctx the context.
 * @param uniforms a map of additional uniform values to set.
 */
Material.prototype.bind = function(ctx, uniforms) {
    var p = ctx.findProgram(this.program);

    if (p === null) {
        return;
    }

    if (ctx.program === null || ctx.program.program !== p.program) {
        ctx.gl.useProgram(p.program);
        ctx.program = p;
    }

    this._texunit = 0;
    this._textures = {};

    this._setUniforms(ctx, p, this.uniforms, 'material');
    this._setUniforms(ctx, p, uniforms);
}

/** Visible, renders the model normally. */
Material.VISIBLE = true;

/** Invisible, will not render the model. */
Material.INVISIBLE = false;

/** Only children, renders only the children, but not the model itself. */
Material.ONLY_CHILDREN = 2;

module.exports = Material;

// vi:ts=4:et
