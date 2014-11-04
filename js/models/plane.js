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
 * A simple plane model. Creates a simple plane geometry, centered around [0, 0, 0] for
 * the given dimensions.
 *
 * @param ctx the context.
 * @param dx the X size of the plane.
 * @param dz the Z size of the plane.
 * @param options optional options.
 * @constructor
 */
function Plane(ctx, dx, dz, options) {
    Model.call(this, ctx, 'plane', options);

    dx /= 2;
    dz /= 2;

    var vertices = [
        -dx, 0,  dz,
         dx, 0,  dz,
         dx, 0, -dz,
        -dx, 0, -dz
    ];

    var normals = [
         0,  1,  0,
         0,  1,  0,
         0,  1,  0,
         0,  1,  0
    ];

    var indices = [
         0,  1,  2,
         0,  2,  3
    ];

    if (options.doubleSided) {
        vertices.push(-dx, 0, -dz,
                       dx, 0, -dz,
                       dx, 0,  dz,
                      -dx, 0,  dz);

        normals.push(0, -1, 0,
                     0, -1, 0,
                     0, -1, 0,
                     0, -1, 0);

        indices.push(4, 5, 6,
                     4, 6, 7);
    }

    this.renderer = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

Plane.prototype = Object.create(Model.prototype);
Plane.prototype.constructor = Plane;

module.exports = Plane;

// vi:ts=4:et
