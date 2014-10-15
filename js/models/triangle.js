var Model = require('./model');
var Geometry = require('./geometry');

/**
 * A simple triangle model. Creates a single triangle geometry for
 * the given vertices.
 *
 * @param ctx the context.
 * @param p1 the position of the first vertex (math.vec3).
 * @param p2 the position of the second vertex (math.vec3).
 * @param p3 the position of the third vertex (math.vec3).
 * @param options optional options.
 * @constructor
 */
function Triangle(ctx, p1, p2, p3, options) {
    Model.call(this, ctx, options);

    var vertices = new Float32Array([
        p1[0], p1[1], p1[2],
        p2[0], p2[1], p2[2],
        p3[0], p3[1], p3[2]
    ]);

    var normals = new Float32Array([
         0,  0,  1,
         0,  0,  1,
         0,  0,  1
    ]);

    var indices = new Uint16Array([
         0,  1,  2
    ]);

    this.geometry = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

Triangle.prototype = Object.create(Model.prototype);
Triangle.prototype.constructor = Triangle;

module.exports = Triangle;

// vi:ts=2:et
