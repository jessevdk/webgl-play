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
var math = require('../math/math');

/**
 * A simple ico sphere. Creates a simple ico sphere geometry, centered around [0, 0, 0] for
 * the given radius and number of subdivisions.
 *
 * @param ctx the context.
 * @param radius the radius of the sphere.
 * @param subdivisions the number of subdivisions to generate the sphere (minimal 1).
 * @param options optional options.
 * @constructor
 */
function UvSphere(ctx, radius, segments, rings, options) {
    Model.call(this, ctx, 'uvsphere', options);

    var vertices = [];
    var indices = [];
    var normals = [];

    if (segments < 3) {
        segments = 3;
    }

    if (rings < 3) {
        rings = 3;
    }

    // Top
    vertices.push(0, radius, 0);
    normals.push(0, 1, 0);

    for (var r = 0; r < rings - 2; r++) {
        var a = Math.PI * ((r + 1) / (rings - 1));
        var y = Math.cos(a) * radius;
        var zr = Math.sin(a) * radius;

        for (var s = 0; s < segments; s++) {
            var b = 2 * Math.PI * (s / segments);

            var x = Math.sin(b) * zr;
            var z = Math.cos(b) * zr;

            var n = math.vec3.normalize$([x, y, z]);

            vertices.push(x, y, z)
            normals.push(n[0], n[1], n[2]);
        }
    }

    var n = (rings - 2) * segments + 2;

    // Bottom
    vertices.push(0, -radius, 0);
    normals.push(0, -1, 0);

    // Top cap
    var i = 1;

    while (i <= segments) {
        if (i != segments) {
            indices.push(i, i + 1, 0);
        } else {
            indices.push(i, 1, 0);
        }

        i++;
    }

    // Segmented rings in between
    for (var r = 1; r < rings - 2; r++) {
        for (var s = 1; s <= segments; s++) {
            if (s != segments) {
                indices.push(i, i + 1, i + 1 - segments,
                             i, i + 1 - segments, i - segments);
            } else {
                indices.push(i, i + 1 - segments, i + 1 - 2 * segments,
                             i, i + 1 - 2 * segments, i - segments);
            }

            i++;
        }
    }

    // Bottom cap
    i -= segments;

    while (i < n - 1) {
        if (i != n - 2) {
            indices.push(i, n - 1, i + 1);
        } else {
            indices.push(i, n - 1, n - 1 - segments);
        }

        i++;
    }

    this.renderer = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

UvSphere.prototype = Object.create(Model.prototype);
UvSphere.prototype.constructor = UvSphere;

module.exports = UvSphere;

// vi:ts=4:et
