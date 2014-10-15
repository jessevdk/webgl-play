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

    this.geometry = new RenderGroup(ctx, new Geometry(ctx, vertices, normals), indices);
}

Box.prototype = Object.create(Model.prototype);
Box.prototype.constructor = Box;

module.exports = Box;

// vi:ts=4:et
