var glMatrix = require('../vendor/gl-matrix');

function transform(orientation, position) {
    this.orientation = orientation;
    this.position = position;
}

transform.create = function() {
    return new transform(glMatrix.quat.create(), glMatrix.vec3.create());
}

transform.clone = function(a) {
    return a.clone();
}

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

transform.prototype.$multiply = function(b) {
    return transform.multiply(this, this, b);
}

transform.prototype.multiply = function(b) {
    return transform.multiply(transform.create(), this, b);
}

transform.prototype.$mul = transform.prototype.$multiply;
transform.prototype.mul = transform.prototype.multiply;

transform.rotateX = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateX(out.orientation, a.orientation, rad);

    return out;
}

transform.prototype.$rotateX = function(rad) {
    return transform.rotateX(this, this, rad);
}

transform.prototype.rotateX = function(rad) {
    return transform.rotateX(transform.create(), this, rad);
}

transform.rotateY = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateY(out.orientation, a.orientation, rad);

    return out;
}

transform.prototype.$rotateY = function(rad) {
    return transform.rotateY(this, this, rad);
}

transform.prototype.rotateY = function(rad) {
    return transform.rotateY(transform.create(), this, rad);
}

transform.rotateZ = function(out, a, rad) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.rotateZ(out.orientation, a.orientation, rad);

    return out;
}

transform.prototype.$rotateZ = function(rad) {
    return transform.rotateZ(this, this, rad);
}

transform.prototype.rotateZ = function(rad) {
    return transform.rotateZ(transform.create(), this, rad);
}

transform.rotate = function(out, a, q) {
    glMatrix.vec3.copy(out.position, a.position);
    glMatrix.quat.mul(out.orientation, a.orientation, q);

    return out;
}

transform.prototype.$rotate = function(q) {
    return transform.rotate(this, this, q);
}

transform.prototype.rotate = function(q) {
    return transform.rotate(transform.create(), this, q);
}

transform.translateX = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[0] += v;
    return out;
}

transform.prototype.$translateX = function(v) {
    return transform.translateX(this, this, v);
}

transform.prototype.translateX = function(v) {
    return transform.translateX(transform.create(), this, v);
}

transform.translateY = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[1] += v;
    return out;
}

transform.prototype.$translateY = function(v) {
    return transform.translateY(this, this, v);
}

transform.prototype.translateY = function(v) {
    return transform.translateY(transform.create(), this, v);
}

transform.translateZ = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.copy(out.position, a.position);

    out.position[2] += v;
    return out;
}

transform.prototype.$translateZ = function(v) {
    return transform.translateZ(this, this, v);
}

transform.prototype.translateZ = function(v) {
    return transform.translateZ(transform.create(), this, v);
}

transform.translate = function(out, a, v) {
    glMatrix.quat.copy(out.orientation, a.orientation);
    glMatrix.vec3.add(out.position, a.position, v);

    return out;
}

transform.prototype.$translate = function(v) {
    return transform.translate(this, this, v);
}

transform.prototype.translate = function(v) {
    return transform.translate(transform.create(), this, v);
}

transform.invert = function(out, a) {
    glMatrix.quat.invert(out.orientation, a.orientation);
    glMatrix.vec3.negate(out.position, a.position);

    glMatrix.vec3.transformQuat(out.position, out.position, out.orientation);

    return out;
}

transform.prototype.$invert = function(v) {
    return transform.invert(this, this);
}

transform.prototype.invert = function() {
    return transform.invert(transform.create(), this);
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
