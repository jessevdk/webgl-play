var Material = require('./material');
var Geometry = require('./geometry');
var math = require('./math');

/**
 * Basic model. A model useful high-level representation
 * of a transform, geometry and material which can be rendered.
 * Models can be organized hierarchically (see add, remove).
 *
 * @param ctx the context.
 * @param options options.
 * @constructor
 */
function Model(ctx, options) {
    /** The material (see Material). */
    this.material = new Material(ctx);

    /**
     * The parent (or null). Do not set this directly,
     * use add/remove instead.
     */
    this.parent = null;

    /**
     * The children. Do not set this directly, use add/remove instead.
     */
    this.children = [];

    /** The transform. */
    this.transform = math.transform.create();

    /** The full transform (i.e. to world coordinates). This will
     * be computed and cached as needed when rendering.
     */
    this.fullTransform = math.transform.create();

    /** The geometry (see Geometry). */
    this.geometry = null;
}

/**
 * Render the model in the given context. Rendering will use the current view
 * set in the context.
 *
 * @param ctx the context.
 */
Model.prototype.render = function(ctx) {
    if (this.material.visible === Material.INVISIBLE) {
        return;
    }

    var view = ctx.view();

    if (this.parent !== null) {
        this.fullTransform = math.transform.mul(this.parent.fullTransform, this.transform);
    } else {
        this.fullTransform = math.transform.clone(this.transform);
    }

    for (var i = 0; i < this.children.length; i++) {
        this.children[i].render(ctx);
    }

    if (this.material.visible === Material.ONLY_CHILDREN || this.geometry === null) {
        return;
    }

    var uniforms = {
        model: math.mat4.fromTransform(math.mat4.create(), this.fullTransform),
        view: null,
        modelView: null,
        projection: null,
        modelViewProjection: null
    };

    if (view) {
        uniforms.view = math.mat4.fromTransform(math.mat4.create(), view.transform.clone().invert());
        uniforms.modelView = math.mat4.mul(math.mat4.create(), uniforms.view, uniforms.model);
        uniforms.projection = view.projection();
        uniforms.modelViewProjection = math.mat4.mul(math.mat4.create(), uniforms.projection, uniforms.modelView);
    } else {
        uniforms.view = math.mat4.create();
        uniforms.modelView = uniforms.model;
        uniforms.projection = math.mat4.create();
        uniforms.modelViewProjection = uniforms.model;
    }

    var p = ctx.findProgram(this.material.program);

    if (p !== null) {
        var needsRebind = false;

        // Reconcile geometry attributes with program attributes
        for (var attrname in this.geometry.attributes) {
            var attr = this.geometry.attributes[attrname];

            if (!(attrname in p.attributes) || p.attributes[attrname] !== attr.id) {
                needsRebind = true;
                break;
            }
        }

        if (needsRebind) {
            var gl = ctx.gl;

            p.attributes = {};
            p.uniforms = {};

            for (var attrname in this.geometry.attributes) {
                var attr = this.geometry.attributes[attrname];
                gl.bindAttribLocation(p.program, attr.id, attrname);

                p.attributes[attrname] = attr.id;
            }

            gl.linkProgram(p.program);
        }
    }

    this.material.bind(ctx, uniforms);
    this.geometry.render(ctx);
}

/**
 * Remove a child model.
 *
 * @param child the model to remove.
 */
Model.prototype.remove = function(child) {
    if (child.parent === this) {
        child.parent = null;
    }

    var i = this.children.indexOf(child);

    if (i !== -1) {
        this.children.splice(i, 1);
    }
}

/**
 * Add a child model.
 *
 * @param child the model to add.
 */
Model.prototype.add = function(child) {
    if (child.parent === this) {
        return;
    }

    if (child.parent !== null) {
        child.parent.remove(child);
    }

    child.parent = this;
    this.children.push(child);
}

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

/**
 * A simple box model. Creates a simple box geometry, centered around [0, 0, 0] for
 * the given dimensions.
 *
 * @param ctx the context.
 * @param dx the X size of the box.
 * @param dy the Y size of the box.
 * @param dz the Z size of the box.
 * @param options optional options.
 * @constructor
 */
function Box(ctx, dx, dy, dz, options) {
    Model.call(this, ctx, options);

    dx /= 2;
    dy /= 2;
    dz /= 2;

    var vertices = new Float32Array([
        // Right plane
         dx, -dy,  dz,
         dx, -dy, -dz,
         dx,  dy, -dz,
         dx,  dy,  dz,

        // Left plane
        -dx, -dy, -dz,
        -dx, -dy,  dz,
        -dx,  dy,  dz,
        -dx,  dy, -dz,

        // Top plane
        -dx,  dy,  dz,
         dx,  dy,  dz,
         dx,  dy, -dz,
        -dx,  dy, -dz,

        // Bottom plane
        -dx, -dy, -dz,
         dx, -dy, -dz,
         dx, -dy,  dz,
        -dx, -dy,  dz,

        // Front plane
        -dx, -dy, dz,
         dx, -dy, dz,
         dx,  dy, dz,
        -dx,  dy, dz,

        // Back plane
         dx, -dy, -dz,
        -dx, -dy, -dz,
        -dx,  dy, -dz,
         dx,  dy, -dz,
    ]);

    var normals = new Float32Array([
        // Right plane
         1,  0,  0,
         1,  0,  0,
         1,  0,  0,
         1,  0,  0,

        // Left plane
        -1,  0,  0,
        -1,  0,  0,
        -1,  0,  0,
        -1,  0,  0,

        // Top plane
         0,  1,  0,
         0,  1,  0,
         0,  1,  0,
         0,  1,  0,

        // Bottom plane
         0, -1,  0,
         0, -1,  0,
         0, -1,  0,
         0, -1,  0,

        // Front plane
         0,  0,  1,
         0,  0,  1,
         0,  0,  1,
         0,  0,  1,

        // Back plane
         0,  0, -1,
         0,  0, -1,
         0,  0, -1,
         0,  0, -1,
    ]);

    var indices = new Uint16Array([
        // Right plane
         0,  1,  2,
         0,  2,  3,

        // Left plane
         4,  5,  6,
         4,  6,  7,

        // Top plane
         8,  9, 10,
         8, 10, 11,

        // Bottom plane
        12, 13, 14,
        12, 14, 15,

        // Front plane
        16, 17, 18,
        16, 18, 19,

        // Back plane
        20, 21, 22,
        20, 22, 23,
    ]);

    this.geometry = new Geometry(ctx, vertices, normals, indices);
}

Box.prototype = Object.create(Model.prototype);
Box.prototype.constructor = Box;

/**
 * A simple triangle model. Creates a single triangle geometry for
 * the given vertices.
 *
 * @param ctx the context.
 * @param p1 the position of the first vertex (math.vec3).
 * @param p2 the position of the second vertex (math.vec3).
 * @param p3 the position of the third vertex (math.vec3).
 * @param options optional options.
 * @constructor
 */
function Triangle(ctx, p1, p2, p3, options) {
    Model.call(this, ctx, options);

    var vertices = new Float32Array([
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
    ]);

    var normals = new Float32Array([
         0,  0,  1,
         0,  0,  1,
         0,  0,  1
    ]);

    var indices = new Uint16Array([
         0,  1,  2
    ]);

    this.geometry = new Geometry(ctx, vertices, normals, indices);
}

Triangle.prototype = Object.create(Model.prototype);
Triangle.prototype.constructor = Box;

exports.View = View;
exports.Box = Box;
exports.Triangle = Triangle;

// vi:ts=4:et
