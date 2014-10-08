var math = require('./math');

function Material(ctx) {
    this.uniforms = {
        color: math.vec4.fromValues(1, 0, 1, 0)
    };

    this.visible = true;
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

Material.INVISIBLE = false;
Material.VISIBLE = true;
Material.ONLY_CHILDREN = 2;

module.exports = Material;

// vi:ts=4:et
