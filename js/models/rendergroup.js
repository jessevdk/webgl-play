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
        type: gl.TRIANGLES,
        aabbox: null
    }, options);

    this.type = opts.type;
    this.aabbox = opts.aabbox;

    if (this._ibo) {
        gl.deleteBuffer(this._ibo);
    }

    if (indices && (typeof indices !== 'object' || Object.getPrototypeOf(indices) !== Uint16Array.prototype)) {
        indices = new Uint16Array(indices);
    }

    this._ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, opts.binding);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.length = indices.length;
}

/**
 * Get all render parts of the render group. Note that this just returns
 * an array with a single element, this.
 */
RenderGroup.prototype.renderParts = function() {
    if (this.length === 0) {
        return [];
    }

    return [this];
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
 */
RenderGroup.prototype.render = function(ctx) {
    var gl = ctx.gl;

    this.bind(ctx);

    ctx._renderedSomething = true;
    gl.drawElements(this.type, this.length, gl.UNSIGNED_SHORT, 0);

    this.unbind(ctx);
}

module.exports = RenderGroup;

// vi:ts=4:et
