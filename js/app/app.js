require('./glsl-mode');

var widgets = require('../widgets/widgets');

function App() {
	document.addEventListener('DOMContentLoaded', this._init.bind(this));
}

App.prototype.find = function(elems) {
	var ret = {};

	for (var k in elems) {
		ret[k] = document.querySelector(elems[k]);
	}

	return ret;
}

App.prototype.new_document = function() {
	var v = [
		'#version 100',
		'',
		'void main() {',
		'}'
	];

	this.vertex_editor.setValue(v.join('\n'));

	var f = [
		'#version 100',
		'',
		'void main() {',
		'}'
	];

	this.fragment_editor.setValue(v.join('\n'));
}

App.prototype._init_panels = function() {
	var panels = document.querySelectorAll('.panel');

	this.panels = {};

	for (var i = 0; i < panels.length; i++) {
		var p = panels[i];

		this.panels[p.id] = new widgets.Panel(p);
	}

	this.panels['panel-main'].on('resized', (function() {
		this.vertex_editor.refresh();
		this.fragment_editor.refresh();
		this.js_editor.refresh();
	}).bind(this));

	this.panels['panel-program'].on('resized', (function() {
		this.vertex_editor.refresh();
		this.fragment_editor.refresh();
	}).bind(this));

	this.panels['panel-js'].on('resized', (function() {
		this.js_editor.refresh();
	}).bind(this));
}

App.prototype._init = function() {
	var elems = this.find({
		vertex_editor: '#vertex-editor',
		fragment_editor: '#fragment-editor',
		js_editor: '#js-editor'
	});

	var opts = {
		theme: 'default webgl-play',
		indentUnit: 4,
		lineNumbers: true
	};

	for (var k in elems) {
		this[k] = CodeMirror(elems[k], opts);

		var p = elems[k].parentElement;
		var t = p.querySelector('.editor-title');

		this[k].on('focus', (function(title) {
			title.classList.add('hidden');
		}).bind(this, t));

		this[k].on('blur', (function(title) {
			title.classList.remove('hidden');
		}).bind(this, t));
	}

	this.vertex_editor.setOption('mode', 'glsl');
	this.fragment_editor.setOption('mode', 'glsl');
	this.js_editor.setOption('mode', 'javascript');

	this._init_panels();

	this.new_document();
};

var app = new App();
module.exports = app;
