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
    this.fullTransform = math.transform.track(math.transform.create(), this, 'transform', function(out, tr) {
        return math.transform.copy(out, tr);
    });

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
Model.prototype.render = function(ctx, options) {
    if (this.material.visible === Material.INVISIBLE) {
        return;
    }

    var view = ctx.view();

    var fullTransform = this.fullTransform();

    for (var i = 0; i < this.children.length; i++) {
        this.children[i].render(ctx, options);
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
        uniforms.view = math.mat4.fromTransform(math.mat4.create(), view.originTransform());
        uniforms.modelView = math.mat4.mul(math.mat4.create(), uniforms.view, uniforms.model);
        uniforms.projection = view.projection();
        uniforms.modelViewProjection = math.mat4.mul(math.mat4.create(), uniforms.projection, uniforms.modelView);
    } else {
        uniforms.view = math.mat4.create();
        uniforms.modelView = uniforms.model;
        uniforms.projection = math.mat4.create();
        uniforms.modelViewProjection = uniforms.model;
    }

    if (options && options.uniforms) {
        for (var k in options.uniforms) {
            if (options.uniforms.hasOwnProperty(k)) {
                uniforms[k] = options.uniforms[k];
            }
        }
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
