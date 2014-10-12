var math = require('./math');

/**
 * A basic material. A material contains a specification of the material
 * properties used to render a model. These material properties are transfered
 * to a glsl program as uniforms.
 *
 * @param ctx the context.
 * @constructor
 */
function Material(ctx) {
    /**
     * A map of uniform names to values. Any values set in this map,
     * with a corresponding uniform in the material program, are
     * automatically bound when the material is used. Use the
     * various math.vec/mat types to map to the glsl types.
     */
    this.uniforms = {
        color: math.vec4.fromValues(1, 0, 1, 0)
    };

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

Material.prototype._setUniform = function(ctx, u, v) {
    switch (Object.getPrototypeOf(v)) {
    case Float32Array.prototype:
        switch (v.length) {
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
            throw new Error('cannot set uniform ' + v);
        }
        break;
    case Int32Array.prototype:
        switch (v.length) {
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
            throw new Error('cannot set uniform ' + v);
        }
        break;
    default:
        throw new Error('cannot set uniform ' + v);
    }
}

Material.prototype._setUniforms = function(ctx, p, uniforms) {
    if (!p.uniforms) {
        p.uniforms = {};
    }

    for (var k in uniforms) {
        if (!(k in p.uniforms)) {
            p.uniforms[k] = ctx.gl.getUniformLocation(p.program, k);
        }

        var u = p.uniforms[k];

        if (u !== null) {
            this._setUniform(ctx, u, uniforms[k]);
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

    this._setUniforms(ctx, p, this.uniforms);
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
