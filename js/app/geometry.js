var utils = require('./utils');

function Geometry(ctx, vertices, normals, indices) {
    this._ibo = null;
    this._lastAttrId = 0;

    this.attributes = {};
    this._attribute_ids = {};

    this.update(ctx, vertices, normals, indices);
}

Geometry.prototype.update = function(ctx, vertices, normals, indices, options) {
    var gl = ctx.gl;

    var opts = utils.merge({
        binding: gl.STATIC_DRAW
    }, options);

    if (vertices) {
        this.addAttribute(ctx, 'v_Position', vertices, options);
    }

    if (normals) {
        this.addAttribute(ctx, 'v_Normal', normals, options);
    }

    if (this._ibo) {
        gl.deleteBuffer(this._ibo);
    }

    this._ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, opts.binding);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.length = indices.length;
}

Geometry.prototype.removeAttribute = function(ctx, name) {
    var gl = ctx.gl;

    if (!(name in this.attributes)) {
        return;
    }

    var attr = this.attributes[name];

    gl.deleteBuffer(attr.id);

    delete this._attribute_ids[attr.id];
    delete this.attributes[name];
}

Geometry.prototype.addAttribute = function(ctx, name, data, options) {
    var gl = ctx.gl;

    var opts = utils.merge({
        binding: gl.STATIC_DRAW,
        size: 3,
        type: gl.FLOAT,
        normalized: false,
        stride: 0
    }, options);

    if (name in this.attributes) {
        this.removeAttribute(ctx, name);
    }

    var i = 0;

    while (i in this._attribute_ids) {
        i++;
    }

    var attr = {
        data: data,
        id: i,
        vbo: gl.createBuffer(),
        enabled: true
    };

    gl.bindBuffer(gl.ARRAY_BUFFER, attr.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, opts.binding);
    gl.vertexAttribPointer(attr.id, opts.size, opts.type, opts.normalized, opts.stride, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.attributes[name] = attr;
    this._attribute_ids[attr.id] = true;
}

Geometry.prototype.bind = function(ctx) {
    var gl = ctx.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);

    for (var k in this.attributes) {
        var attr = this.attributes[k];

        if (attr.enabled) {
            gl.enableVertexAttribArray(attr.id);
        }
    }
}

Geometry.prototype.render = function(ctx) {
    var gl = ctx.gl;

    this.bind(ctx);
    gl.drawElements(gl.TRIANGLES, this.length, gl.UNSIGNED_SHORT, 0);
    this.unbind(ctx);
}

Geometry.prototype.unbind = function(ctx) {
    var gl = ctx.gl;

    for (var k in this.attributes) {
        var attr = this.attributes[k];

        if (attr.enabled) {
            gl.disableVertexAttribArray(attr.id);
        }
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

module.exports = Geometry;

// vi:ts=4:et
