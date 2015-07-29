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

var utils = require('../utils/utils');

/**
 * A representation of a geometry. A geometry contains a number
 * of vertex buffer objects specifying attributes such as vertices,
 * normals, etc. The vertices and normals provided to the constructor
 * are a convenience equivalent to calling addAttribute manually
 * respectively with the attribute names 'v_Position' and 'v_Normal'.
 *
 * Additional attributes can be added to a geometry after construction
 * using addAttribute. As a convenience, update can be used to update
 * vertices and normals instead of calling addAttribute manually.
 *
 * Note that a Geometry only consists of a number of attribute
 * buffers, but does not specify how to render objects contained
 * within these buffers (e.g. a single buffer may contain multiple
 * objects). See RenderGroup and RenderGroups for information on
 * how to index a Geometry for rendering.
 *
 * @param ctx the context.
 * @param vertices a Float32Array of vertices, or null.
 * @param normals a Float32Array of normals, or null.
 * @param options optional options <binding:> (defaults to <binding: gl.STATIC_DRAW>).
 * @constructor
 */
function Geometry(ctx, vertices, normals) {
    this._lastAttrId = 0;

    this.attributes = {};
    this._attributeIds = {};

    this.update(ctx, vertices, normals);
}

/**
 * Update the geometry. This is a convenience around calling
 * addAttribute manually with respectively the names
 * 'v_Position' (for the vertices) and 'v_Normal' (for the normals).
 *
 * @param ctx the context.
 * @param vertices a Float32Array of vertices, or null.
 * @param normals a Float32Array of normals, or null.
 * @param options optional options <binding:> (defaults to <binding: gl.STATIC_DRAW>).
 */
Geometry.prototype.update = function(ctx, vertices, normals, options) {
    var gl = ctx.gl;

    var opts = utils.merge({
        binding: gl.STATIC_DRAW
    }, options);

    if (vertices) {
        this.addAttribute(ctx, 'v_Position', vertices, opts);
    }

    if (normals) {
        this.addAttribute(ctx, 'v_Normal', normals, opts);
    }
};

/**
 * Remove an attribute buffer.
 *
 * @param name the name of the attribute to remove.
 */
Geometry.prototype.removeAttribute = function(ctx, name) {
    var gl = ctx.gl;

    if (!(name in this.attributes)) {
        return;
    }

    var attr = this.attributes[name];

    gl.deleteBuffer(attr.id);

    delete this._attributeIds[attr.id];
    delete this.attributes[name];
};

/**
 * Add an attribute buffer. If an attribute buffer with the given
 * name already exists, then this existing buffer is first removed.
 *
 * @param name the name of the attribute to remove.
 * @param data the attribute data.
 * @param options attribute options. Valid options map to
 * parameters required for gl.bufferData and gl.vertexAttribPointer
 * and include binding, size, type, normalized and stride.
 */
Geometry.prototype.addAttribute = function(ctx, name, data, options) {
    var gl = ctx.gl;

    var opts = utils.merge({
        binding: gl.STATIC_DRAW,
        size: 3,
        type: gl.FLOAT,
        normalized: false,
        stride: 0
    }, options);

    if (name in this.attributes) {
        this.removeAttribute(ctx, name);
    }

    var i = 0;

    while (i in this._attributeIds) {
        i++;
    }

    if (opts.type === gl.FLOAT && data !== null && (typeof data !== 'object' || Object.getPrototypeOf(data) !== Float32Array.prototype)) {
        data = new Float32Array(data);
    }

    var attr = {
        data: data,
        id: i,
        vbo: gl.createBuffer(),
        size: opts.size,
        type: opts.type,
        normalized: opts.normalized,
        stride: opts.stride,
        enabled: true
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, attr.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, opts.binding);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.attributes[name] = attr;
    this._attributeIds[attr.id] = true;
};

/**
 * Bind the geometry in the current context.
 *
 * @param ctx the context.
 */
Geometry.prototype.bind = function(ctx) {
    var gl = ctx.gl;

    for (var k in this.attributes) {
        var attr = this.attributes[k];

        gl.bindBuffer(gl.ARRAY_BUFFER, attr.vbo);
        gl.vertexAttribPointer(attr.id, attr.size, attr.type, attr.normalized, attr.stride, 0);

        if (attr.enabled) {
            gl.enableVertexAttribArray(attr.id);
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
};

/**
 * Unbind the geometry from the current context.
 *
 * @param ctx the context.
 */
Geometry.prototype.unbind = function(ctx) {
    var gl = ctx.gl;

    for (var k in this.attributes) {
        var attr = this.attributes[k];

        if (attr.enabled) {
            gl.disableVertexAttribArray(attr.id);
        }
    }
};

module.exports = Geometry;

// vi:ts=4:et
