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
 * A simple quad model. Creates a single quad geometry for
 * the given vertices.
 *
 * @param ctx the context.
 * @param p1 the position of the first vertex (math.vec3).
 * @param p2 the position of the second vertex (math.vec3).
 * @param p3 the position of the third vertex (math.vec3).
 * @param p4 the position of the fourth vertex (math.vec3).
 * @param options optional options.
 * @constructor
 */
function Quad(ctx, p1, p2, p3, p4, options) {
    Model.call(this, ctx, 'quad', options);

    var vertices = new Float32Array([
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2],
        p4[0], p4[1], p4[2]
    ]);

    var normals = new Float32Array([
         0,  0,  1,
         0,  0,  1,
         0,  0,  1,
         0,  0,  1
    ]);

    var indices = new Uint16Array([
         0,  1,  2,
         0,  2,  3
    ]);

    this.renderer = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

Quad.prototype = Object.create(Model.prototype);
Quad.prototype.constructor = Quad;

module.exports = Quad;

// vi:ts=2:et
