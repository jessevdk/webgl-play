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

var utils = require('../utils/utils');

function Texture(ctx, options) {
    var gl = ctx.gl;

    options = utils.merge({
        target: gl.TEXTURE_2D,

        filter: {
            mag: gl.NEAREST,
            min: gl.NEAREST
        },

        wrap: {
            s: gl.CLAMP_TO_EDGE,
            t: gl.CLAMP_TO_EDGE
        }
    }, options);

    this.id = gl.createTexture();
    this.target = options.target;

    this.bind(ctx);
    gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, options.filter.mag);
    gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, options.filter.min);
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, options.wrap.s);
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, options.wrap.t);
    this.unbind(ctx);
}

Texture.prototype.data = function(ctx, width, height, data, options) {
    var gl = ctx.gl;

    if (width instanceof HTMLImageElement || width instanceof HTMLCanvasElement) {
        options = height;
        data = width;
    }

    options = utils.merge({
        internalFormat: gl.RGBA,
        format: gl.RGBA,
        type: gl.UNSIGNED_BYTE,
        level: 0
    }, options);

    this.bind(ctx);

    if (data instanceof HTMLImageElement || data instanceof HTMLCanvasElement) {
        gl.texImage2D(this.target,
                      options.level,
                      options.internalFormat,
                      options.format,
                      options.type,
                      data);
    } else {
        gl.texImage2D(this.target,
                      options.level,
                      options.internalFormat,
                      width,
                      height,
                      0,
                      options.format,
                      options.type,
                      data);
    }

    this.unbind(ctx);
};

Texture.prototype.bind = function(ctx, unit) {
    var gl = ctx.gl;

    if (!unit) {
        unit = 0;
    }

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(this.target, this.id);
};

Texture.prototype.unbind = function(ctx) {
    ctx.gl.bindTexture(this.target, null);
};

module.exports = Texture;

// vi:ts=4:et
