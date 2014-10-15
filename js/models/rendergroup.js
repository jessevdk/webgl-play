var utils = require('../utils/utils');

/**
 * Render an object from a geometry buffer. A RendeGroup is a wrapper
 * around an element array buffer, containing element indices into
 * an existing Geometry.
 *
 * @param ctx the context.
 * @param geometry a Geometry.
 * @param indices the indices in the geometry to render.
 * @param options optional options, defaults to <binding:gl.STATIC_DRAW, type:gl.TRIANGLES>.
 */
function RenderGroup(ctx, geometry, indices, options) {
    this._ibo = null;
    this._geometry = null;

    this.update(ctx, geometry, indices, options);
}

/**
 * Update the render group.
 *
 * @param ctx the context.
 * @param geometry a Geometry.
 * @param indices the indices in the geometry to render.
 * @param options optional options, defaults to <binding:gl.STATIC_DRAW, type:gl.TRIANGLES>.
 */
RenderGroup.prototype.update = function(ctx, geometry, indices, options) {
    var gl = ctx.gl;

    this.geometry = geometry;
    this.indices = indices;

    var opts = utils.merge({
        binding: gl.STATIC_DRAW,
        type: gl.TRIANGLES
    }, options);

    this.type = opts.type;

    if (this._ibo) {
        gl.deleteBuffer(this._ibo);
    }

    this._ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, opts.binding);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.length = indices.length;
}

/**
 * Bind the render group in the given context.
 *
 * @param ctx the context.
 */
RenderGroup.prototype.bind = function(ctx) {
    var gl = ctx.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
}

/**
 * Unbind the render group from the given context.
 *
 * @param ctx the context.
 */
RenderGroup.prototype.unbind = function(ctx) {
    var gl = ctx.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

/**
 * Render the render group.
 *
 * @param ctx the context.
 * @param nobind (optional) disable binding the geometry.
 */
RenderGroup.prototype.render = function(ctx, nobind) {
    var gl = ctx.gl;

    if (this.length === 0) {
        return;
    }

    if (!nobind) {
        this.geometry.bind(ctx);
    }

    this.bind(ctx);

    ctx._renderedSomething = true;
    gl.drawElements(this.type, this.length, gl.UNSIGNED_SHORT, 0);

    this.unbind(ctx);

    if (!nobind) {
        this.geometry.unbind(ctx);
    }
}

module.exports = RenderGroup;

// vi:ts=4:et