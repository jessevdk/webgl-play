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
