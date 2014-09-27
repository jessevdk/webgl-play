function JsContext(gl) {
	this.gl = gl;
}

function Renderer(canvas) {
	this.canvas = canvas;
	this.context = new JsContext(this.canvas.getContext('webgl'));
}

Renderer.prototype.update = function(doc) {
}

module.exports = Renderer;

// vi:ts=4:et
