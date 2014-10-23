function Texture(ctx, target) {
    var gl = ctx.gl;

    this.id = gl.createTexture();
    this.target = target || gl.TEXTURE_2D;

    this.bind(ctx);
    gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.unbind(ctx);
}

Texture.prototype.bind = function(ctx, unit) {
    var gl = ctx.gl;

    if (!unit) {
        unit = 0;
    }

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(this.target, this.id);
}

Texture.prototype.unbind = function(ctx) {
    ctx.gl.bindTexture(this.target, null);
}

module.exports = Texture;

// vi:ts=4:et
