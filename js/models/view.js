var Model = require('./model');
var math = require('../math/math');

/**
 * A basic view. A View is a collection of transform (inherited from model),
 * a projection matrix and a viewport. Note that you can use View.perspective
 * and View.orthographic to create respectively a perspective projection
 * view or a orthographic projection view. If viewport is not given (or null),
 * then the viewport will automatically track the canvas dimensions.
 *
 * Additionally, a view specifies various gl states, such as whether to enable
 * depth testing, blending and face culling (see the view's properties).
 *
 * @param ctx the context.
 * @param projection the projection matrix (math.mat4).
 * @param viewport the viewport (math.vec4).
 * @param options optional options.
 * @constructor
 */
function View(ctx, projection, viewport, options) {
    Model.call(this, ctx, options);

    this._projection = projection;
    this._projection_set = false;

    /** The viewport, or unset to track the canvas dimensions. */
    this.viewport = viewport;

    /** The clear color, or null to disable clearing the color (defaults to null). */
    this.color = null;

    /** The depth function, or false to disable depth testing (defaults to gl.LESS). */
    this.depth = ctx.gl.LESS;

    /** The blend function ({sfactor:, dfactor:}), or false to disable blending (defaults to false). */
    this.blend = false;

    /** Whether to enable the scissor test matching the viewport (defaults to true). */
    this.scissor = true;

    /** Whether to cull faces ({face:, direction:}), or false to disable culling (defaults to {face: gl.BACK, direction: gl.CCW}). */
    this.cull = {
        face: ctx.gl.BACK,
        direction: ctx.gl.CCW
    }

    this.updateViewport(ctx);
}

View.prototype = Object.create(Model.prototype);
View.prototype.constructor = View;

/**
 * Update the viewport of the view. This is called automatically
 * when the canvas dimensions change. When no explicit viewport is
 * set, the viewport is automatically updated to cover the canvas.
 *
 * @param ctx the context.
 */
View.prototype.updateViewport = function(ctx) {
    if (!this.viewport) {
        this._viewport = [0, 0, ctx.gl.canvas.clientWidth, ctx.gl.canvas.clientHeight];
    } else {
        this._viewport = this.viewport;
    }
}

/**
 * Get/set the projection matrix.
 *
 * @param projection the projection matrix (math.mat4) to set.
 */
View.prototype.projection = function(projection) {
    if (typeof projection !== 'undefined') {
        this._projection = projection;
        this._projection_set = true;
    } else {
        return this._projection;
    }
}

/**
 * Binds the view to the given context. This sets the various gl
 * states corresponding to the view's settings. Note that this
 * is normally automatically called by setting the view in the
 * rendering context and should not be called by users.
 *
 * @param ctx the context.
 */
View.prototype.bind = function(ctx) {
    var c = this.color;
    var gl = ctx.gl;

    var vp = this._viewport;
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);

    if (this.scissor) {
        gl.scissor(vp[0], vp[1], vp[2], vp[3]);
        gl.enable(gl.SCISSOR_TEST);
    } else {
        gl.disable(gl.SCISSOR_TEST);
    }

    var cbit = 0;

    if (c) {
        gl.clearColor(c[0], c[1], c[2], c[3]);
        cbit |= gl.COLOR_BUFFER_BIT;
    }

    if (this.depth !== false) {
        cbit |= gl.DEPTH_BUFFER_BIT;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(this.depth);
    } else {
        gl.disable(gl.DEPTH_TEST);
    }

    if (this.blend) {
        gl.enable(gl.BLEND);
    } else {
        gl.disable(gl.BLEND);
    }

    if (this.cull) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(this.cull.face);
        gl.frontFace(this.cull.direction);
    } else {
        gl.disable(gl.CULL_FACE);
    }

    if (cbit !== 0) {
        gl.clear(cbit);
    }
}

View._make_perspective = function(fovy, aspect, near, far) {
    return math.mat4.perspective(math.mat4.create(), fovy / 180 * Math.PI, aspect, near, far);
}

/**
 * Create a view with a perspective projection. By default the viewport will be
 * set to track the canvas dimensions. The default viewport can be changed
 * by setting the .viewport property after construction. If aspect is null,
 * then the aspect ratio will be derived automatically from the canvas (and
 * updated as the canvas is being resized).
 *
 * @param ctx the context.
 * @param fovy the field of view (in degrees) in the Y direction.
 * @param aspect the view's aspect ratio, or null to track the canvas aspect ratio.
 * @param near the near clipping plane (> 0).
 * @param far the far clipping plane (> 0).
 */
View.perspective = function(ctx, fovy, aspect, near, far) {
    var ap = aspect;

    if (!aspect) {
        var w = ctx.gl.canvas.clientWidth;
        var h = ctx.gl.canvas.clientHeight;

        ap = w / h;
    }

    var ret = new View(ctx, View._make_perspective(fovy, ap, near, far));

    if (!aspect) {
        ret.updateViewport = function(ctx) {
            View.prototype.updateViewport.call(ret, ctx);

            if (ret._projection_set) {
                return;
            }

            var w = ctx.gl.canvas.clientWidth;
            var h = ctx.gl.canvas.clientHeight;

            var ap = w / h;

            ret._projection = View._make_perspective(fovy, ap, near, far);
        }
    }

    return ret;
}

/**
 * Create a view with an orthographic projection.
 *
 * @param ctx the context.
 * @param bounds the [left, right, top, bottom] (math.vec4) clipping planes.
 * @param near the near clipping plane.
 * @param far the far clipping plane.
 */
View.orthographic = function(ctx, bounds, near, far) {
    if (!bounds) {
        bounds = [0, 1, 0, 1];
    }

    var b = bounds;
    return new View(ctx, math.mat4.ortho(math.mat4.create(), b[0], b[1], b[2], b[3], near, far));
}

module.exports = View;

// vi:ts=4:et
