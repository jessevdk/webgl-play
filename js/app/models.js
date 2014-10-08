var Material = require('./material');
var Geometry = require('./geometry');
var math = require('./math');

function Model(ctx, opts) {
    this.material = new Material(ctx);

    this.parent = null;
    this.children = [];

    this.transform = math.transform.create();
    this.fullTransform = math.transform.create();

    this.geometry = null;
}

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
        uniforms.view = math.mat4.fromTransform(math.mat4.create(), view.transform.invert());
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

Model.prototype.remove = function(child) {
    if (child.parent === this) {
        child.parent = null;
    }

    var i = this.children.indexOf(child);

    if (i !== -1) {
        this.children.splice(i, 1);
    }
}

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

function View(ctx, projection, viewport, opts) {
    Model.call(this, ctx, opts);

    this._projection = projection;
    this._projection_set = false;

    this.viewport = viewport;
    this.color = null;

    this.depth = ctx.gl.LESS;
    this.blend = false;
    this.scissor = true;

    this.cull = {
        face: ctx.gl.BACK,
        direction: ctx.gl.CCW
    }

    this.updateViewport(ctx);
}

View.prototype = Object.create(Model.prototype);
View.prototype.constructor = View;

View.prototype.updateViewport = function(ctx) {
    if (!this.viewport) {
        this._viewport = [0, 0, ctx.gl.canvas.clientWidth, ctx.gl.canvas.clientHeight];
    } else {
        this._viewport = this.viewport;
    }
}

View.prototype.projection = function(projection) {
    if (typeof projection !== 'undefined') {
        this._projection = projection;
        this._projection_set = true;
    } else {
        return this._projection;
    }
}

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

View.orthographic = function(ctx, b, near, far) {
    if (!b) {
        b = [0, 1, 0, 1];
    }

    return new View(ctx, math.mat4.ortho(math.mat4.create(), b[0], b[1], b[2], b[3], near, far));
}

function Box(ctx, dx, dy, dz, opts) {
    Model.call(this, ctx, opts);

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

function Triangle(ctx, p1, p2, p3, opts) {
    Model.call(this, ctx, opts);

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
