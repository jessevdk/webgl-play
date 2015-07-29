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
function IcoSphere(ctx, radius, subdivisions, options) {
    Model.call(this, ctx, 'icosphere', options);

    // golden ratio, phi
    var x = 1;
    var y = 0.5 * (1 + Math.sqrt(5));

    var l = radius / Math.sqrt(x * x + y * y);

    x *= l;
    y *= l;

    var vertices = [-x,  y, 0,
                     x,  y, 0,
                    -x, -y, 0,
                     x, -y, 0,

                     0, -x,  y,
                     0,  x,  y,
                     0, -x, -y,
                     0,  x, -y,

                     y,  0, -x,
                     y,  0,  x,
                    -y,  0, -x,
                    -y,  0,  x];

    var normals = [];
    var i;

    for (i = 0; i < vertices.length; i++) {
        normals.push(vertices[i] / radius);
    }

    var indices = [
         0, 11,  5,
         0,  5,  1,
         0,  1,  7,
         0,  7, 10,
         0, 10, 11,

         1,  5,  9,
         5, 11,  4,
        11, 10,  2,
        10,  7,  6,
         7,  1,  8,

         3,  9,  4,
         3,  4,  2,
         3,  2,  6,
         3,  6,  8,
         3,  8,  9,

         4,  9,  5,
         2,  4, 11,
         6,  2, 10,
         8,  6,  7,
         9,  8,  1
    ];

    subdivisions = (subdivisions || 1);

    for (var s = 1; s < subdivisions; s++) {
        var nindices = [];

        var split = {};

        // for each face
        for (i = 0; i < indices.length; i += 3) {
            var i0 = this._splitEdge(vertices, normals, indices[i], indices[i + 1], split, radius);
            var i1 = this._splitEdge(vertices, normals, indices[i + 1], indices[i + 2], split, radius);
            var i2 = this._splitEdge(vertices, normals, indices[i + 2], indices[i], split, radius);

            nindices.push(indices[i], i0, i2,
                          i0, indices[i + 1], i1,
                          i0, i1, i2,
                          i2, i1, indices[i + 2]);
        }

        indices = nindices;
    }

    this.renderer = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

IcoSphere.prototype = Object.create(Model.prototype);
IcoSphere.prototype.constructor = IcoSphere;

IcoSphere.prototype._splitEdge = function(vertices, normals, i1, i2, split, radius) {
    var splitKey;

    if (i1 < i2) {
        splitKey = i1 + '-' + i2;
    } else {
        splitKey = i2 + '-' + i1;
    }

    var pt = split[splitKey];

    if (pt) {
        return pt;
    }

    var i = vertices.length / 3;
    split[splitKey] = i;

    var i1s = i1 * 3;
    var i1e = i1s + 3;
    var i2s = i2 * 3;
    var i2e = i2s + 3;

    var m = math.vec3.add$(vertices.slice(i1s, i1e), vertices.slice(i2s, i2e));
    var l = radius / math.vec3.len(m);

    vertices.push(m[0] * l, m[1] * l, m[2] * l);

    var n = math.vec3.normalize$(math.vec3.add$(normals.slice(i1s, i1e), normals.slice(i2s, i2e)));
    normals.push(n[0], n[1], n[2]);

    return i;
};

module.exports = IcoSphere;

// vi:ts=4:et
