var Material = require('./material');
var math = require('../math/math');

/**
 * Basic model. A model useful high-level representation
 * of a transform, geometry and material which can be rendered.
 * Models can be organized hierarchically (see add, remove).
 *
 * @param ctx the context.
 * @param name the name of the model.
 * @param options options.
 * @constructor
 */
function Model(ctx, name, options) {
    /** The name. */
    this.name = name;

    var mat;

    if (options && options.material) {
        mat = options.material;
    } else {
        mat = new Material();
    }

    /** The material (see Material). */
    this.material = mat;

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
    this.fullTransform = (function() {
        return this.transform;
    }).bind(this);

    /** The geometry to render. This is usually a RenderGroup or
      * RenderGroups, but may be anything with a .renderParts()
      * function, returning an array of elements containing:
      * 1) a .geometry field containing a Geometry.
      * 2) a .render(ctx) function.
      */
    this.renderer = null;
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

    var fullTransform = this.fullTransform();

    for (var i = 0; i < this.children.length; i++) {
        this.children[i].render(ctx);
    }

    if (this.material.visible === Material.ONLY_CHILDREN || this.renderer === null) {
        return;
    }

    var uniforms = {
        model: math.mat4.fromTransform(math.mat4.create(), fullTransform),
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
    var parts = this.renderer.renderParts();

    var prevGeometry = null;

    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        var geometry = part.geometry;
        var needsRebind = false;

        if (p !== null) {
            // Reconcile geometry attributes with program attributes
            for (var attrname in geometry.attributes) {
                var attr = geometry.attributes[attrname];

                if (!(attrname in p.attributes) || p.attributes[attrname] !== attr.id) {
                    needsRebind = true;
                    break;
                }
            }

            if (needsRebind) {
                var gl = ctx.gl;

                p.attributes = {};
                p.uniforms = {};

                for (var attrname in geometry.attributes) {
                    var attr = geometry.attributes[attrname];
                    gl.bindAttribLocation(p.program, attr.id, attrname);

                    p.attributes[attrname] = attr.id;
                }

                gl.linkProgram(p.program);
            }
        }

        if (geometry !== prevGeometry) {
            geometry.bind(ctx);
            prevGeometry = geometry;
        }

        if (needsRebind || i === 0) {
            this.material.bind(ctx, uniforms);
        }

        part.render(ctx);
    }

    if (prevGeometry !== null) {
        prevGeometry.unbind(ctx);
    }
}

/**
 * Remove a child model.
 *
 * @param child the model to remove.
 */
Model.prototype.remove = function(child) {
    if (child.parent === this) {
        child.parent = null;

        child.fullTransform = (function() {
            return this.transform;
        }).bind(child);
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

    child.fullTransform = math.transform.track(math.transform.create(), this, 'fullTransform', function(out, tr) {
        return child.transform.preMul(tr());
    });
}

module.exports = Model;

var objloader = require('./objloader');
Model.load = objloader.load;

// vi:ts=4:et
