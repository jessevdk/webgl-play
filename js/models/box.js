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

var Model = require('./model');
var Geometry = require('./geometry');
var RenderGroup = require('./rendergroup');

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
    Model.call(this, ctx, 'box', options);

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

    this.renderer = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

Box.prototype = Object.create(Model.prototype);
Box.prototype.constructor = Box;

module.exports = Box;

// vi:ts=4:et
