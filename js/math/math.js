var glMatrix = require('../vendor/gl-matrix');

/**
 * A general 3d transform. This class represents a transformation from one
 * frame to another as a pair of a quaternion orientation and a vec3
 * position.
 *
 * @constructor
 * @param orientation the initial orientation.
 * @param position the initial position.
 */
function transform(orientation, position) {
    /** a quat representing the transforms orientation. */
    this.orientation = orientation;

    /** a vec3 representing the transforms position. */
    this.position = position;
}

transform.create = function() {
    return new transform(glMatrix.quat.create(), glMatrix.vec3.create());
}

transform.clone = function(a) {
    return a.clone();
}

/**
 * Clone the transform.
 */
transform.prototype.clone = function() {
    return new transform(glMatrix.quat.clone(this.orientation),
                         glMatrix.vec3.clone(this.position));
}

transform.copy = function(out, a) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    return out;
}

transform.multiply = function(out, a, b) {
    var apos = a.position;
    var aori = a.orientation;

    var bpos = b.position;
    var bori = b.orientation;

    glMatrix.vec3.add(out.position, apos, glMatrix.vec3.transformQuat(out.position, bpos, aori));
    glMatrix.quat.mul(out.orientation, aori, bori);

    return out;
}

transform.mul = transform.multiply;

/**
 * Multiply the transform by another transform. Note that this
 * modifies the receiving transform.
 *
 * @param other a transform to multiply with.
 */
transform.prototype.mul = function(other) {
    return transform.mul(this, this, other);
}

transform.rotateX = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateX(out.orientation, a.orientation, rad);

    return out;
}

/**
 * Rotate the transform around its local X axis. Note that this
 * modifies the receiving transform.
 *
 * @param rad the angle by which to rotate in radians.
 */
transform.prototype.rotateX = function(rad) {
    return transform.rotateX(this, this, rad);
}

transform.rotateY = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateY(out.orientation, a.orientation, rad);

    return out;
}

/**
 * Rotate the transform around its local Y axis. Note that this
 * modifies the receiving transform.
 *
 * @param rad the angle by which to rotate in radians.
 */
transform.prototype.rotateY = function(rad) {
    return transform.rotateY(this, this, rad);
}

transform.rotateZ = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateZ(out.orientation, a.orientation, rad);

    return out;
}

/**
 * Rotate the transform around its local Z axis. Note that this
 * modifies the receiving transform.
 *
 * @param rad the angle by which to rotate in radians.
 */
transform.prototype.rotateZ = function(rad) {
    return transform.rotateZ(this, this, rad);
}

transform.rotate = function(out, a, q) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.mul(out.orientation, a.orientation, q);

    return out;
}

/**
 * Rotate the transform by the given quaternion. Note that this
 * modifies the receiving transform.
 *
 * @param q the quaternion by which to rotate.
 */
transform.prototype.rotate = function(q) {
    return transform.rotate(this, this, q);
}

transform.translateX = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[0] += v;
    return out;
}

/**
 * Translate on X in the parent frame. If you want to translate
 * the transform in the local frame, use {@link module:math~transform#translateSide translateSide}.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar to translate by.
 * @see {@link module:math~transform#translateSide translateSide}.
 */
transform.prototype.translateX = function(v) {
    return transform.translateX(this, this, v);
}

transform.translateY = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[1] += v;
    return out;
}

/**
 * Translate on Y in the parent frame. If you want to translate
 * the transform in the local frame, use {@link translateUp}.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar to translate by.
 * @see {@link translateUp}.
 */
transform.prototype.translateY = function(v) {
    return transform.translateY(this, this, v);
}

transform.translateZ = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[2] += v;
    return out;
}

/**
 * Translate on Z in the parent frame. If you want to translate
 * the transform in the local frame, use {@link translateForward}.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar to translate by.
 * @see {@link translateForward}.
 */
transform.prototype.translateZ = function(v) {
    return transform.translateZ(this, this, v);
}

transform.translate = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.add(out.position, a.position, v);

    return out;
}

/**
 * Translate by the given vector. Note that this modifies the
 * receiving transform.
 *
 * @param v a vec3 to translate by.
 */
transform.prototype.translate = function(v) {
    return transform.translate(this, this, v);
}

transform.sideAxis = function(out, a) {
    var o = a.orientation,
        x = o[0], y = o[1], z = o[2], w = o[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,
        yy = y * y2,
        zz = z * z2,
        yx = y * x2,
        wz = w * z2,
        zx = z * x2,
        wy = w * y2;

    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;

    return out;
}

/**
 * Obtain the local orientation's side axis. This is the same
 * as the X column of the transform's orientation matrix.
 */
transform.prototype.sideAxis = function() {
    return transform.sideAxis(glMatrix.vec3.create(), this);
}

transform.upAxis = function(out, a) {
    var o = a.orientation,
        x = o[0], y = o[1], z = o[2], w = o[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,
        yx = y * x2,
        wz = w * z2,
        xx = x * x2,
        zz = z * z2,
        zy = z * y2,
        wx = w * x2;

    out[0] = yx - wz;
    out[1] = 1 - xx - zz;
    out[2] = zy + wx;

    return out;
}

/**
 * Obtain the local orientation's up axis. This is the same
 * as the Y column of the transform's orientation matrix.
 */
transform.prototype.upAxis = function() {
    return transform.upAxis(glMatrix.vec3.create(), this);
}

transform.forwardAxis = function(out, a) {
    var o = a.orientation,
        x = o[0], y = o[1], z = o[2], w = o[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,
        zx = z * x2,
        wy = w * y2,
        zy = z * y2,
        wx = w * x2,
        xx = x * x2,
        yy = y * y2;

    out[0] = zx + wy;
    out[1] = zy - wx;
    out[2] = 1 - xx - yy;

    return out;
}

/**
 * Obtain the local orientation's forward axis. This is the same
 * as the Z column of the transform's orientation matrix.
 */
transform.prototype.forwardAxis = function() {
    return transform.forwardAxis(glMatrix.vec3.create(), this);
}

transform.translateSide = function(out, a, v) {
    var axis = transform.sideAxis(glMatrix.vec3.create(), a);
    glMatrix.vec3.scale(axis, axis, v);

    return transform.translate(out, a, axis);
}

/**
 * Translate the transform along its local orientation side axis.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar to translate sideways by.
 */
transform.prototype.translateSide = function(v) {
    return transform.translateSide(this, this, v);
}

transform.translateUp = function(out, a, v) {
    var axis = transform.upAxis(glMatrix.vec3.create(), a);
    glMatrix.vec3.scale(axis, axis, v);

    return transform.translate(out, a, axis);
}

/**
 * Translate the transform along its local orientation up axis.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar to translate upwards by.
 */
transform.prototype.translateUp = function(v) {
    return transform.translateUp(this, this, v);
}

transform.translateForward = function(out, a, v) {
    var axis = transform.forwardAxis(glMatrix.vec3.create(), a);
    glMatrix.vec3.scale(axis, axis, v);

    return transform.translate(out, a, axis);
}

/**
 * Translate the transform along its local orientation forward axis.
 * Note that this modifies the receiving transform.
 *
 * @param v a scalar amount to translate forwards by
 */
transform.prototype.translateForward = function(v) {
    return transform.translateForward(this, this, v);
}

transform.invert = function(out, a) {
    glMatrix.quat.invert(out.orientation, a.orientation);
    glMatrix.vec3.negate(out.position, a.position);

    glMatrix.vec3.transformQuat(out.position, out.position, out.orientation);

    return out;
}

/**
 * Invert the transformation. Note that this modifies the receiving
 * transform.
 */
transform.prototype.invert = function() {
    return transform.invert(this, this);
}

transform.str = function(a) {
    return '{' + glMatrix.quat.str(a.orientation) + ', ' + glMatrix.vec3.str(a.position) + '}';
}

glMatrix.mat4.fromTransform = function(out, t) {
    return glMatrix.mat4.fromRotationTranslation(glMatrix.mat4.create(), t.orientation, t.position);
}

glMatrix.vec4.transformTransform = function(out, a, t) {
    glMatrix.vec3.transformTransform(out, a, t);

    var tr = t.position;

    out[0] += a[3] * tr[0];
    out[1] += a[3] * tr[1];
    out[2] += a[3] * tr[2];
    out[3] = a[4];

    return out;
}

glMatrix.vec3.transformTransform = function(out, a, t) {
    return glMatrix.vec3.add(out, glMatrix.vec3.transformQuat(out, t.orientation), t.position);
}

function wrapIsMat(orig) {
    return function() {
        var ret = orig.apply(this, arguments);
        ret.isMat = true;

        return ret;
    }
}

var mats = [glMatrix.mat2, glMatrix.mat3, glMatrix.mat4];

for (var i = 0; i < mats.length; i++) {
    mats[i].create = wrapIsMat(mats[i].create);
    mats[i].clone = wrapIsMat(mats[i].clone);
}

for (var k in glMatrix) {
    if (glMatrix.hasOwnProperty(k)) {
        var v = glMatrix[k];

        var f = function() {
            return glMatrix[k].fromValues.apply(this, arguments);
        };

        for (var j in v) {
            if (v.hasOwnProperty(j)) {
                f[j] = v[j];
            }
        }

        exports[k] = f;
    }
}

exports.transform = transform;

// vi:ts=4:et
