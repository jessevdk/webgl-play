var Editor = require('./editor');
var Document = require('./document');
var widgets = require('../widgets/widgets');
var glsl = require('../glsl/glsl');

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
	var doc = new Document(this);

	this._load_doc(doc);
}

App.prototype._load_doc = function(doc) {
	this.vertex_editor.value(doc.active_program.vertex);
	this.fragment_editor.value(doc.active_program.fragment);
	this.js_editor.value(doc.js);
}

App.prototype._init_panels = function() {
	var panels = document.querySelectorAll('.panel');

	this.panels = {};

	for (var i = 0; i < panels.length; i++) {
		var p = panels[i];

		this.panels[p.id] = new widgets.Panel(p);
	}

	this.panels['panel-main'].on('resized', (function() {
		this.vertex_editor.editor.refresh();
		this.fragment_editor.editor.refresh();
		this.js_editor.editor.refresh();
	}).bind(this));

	this.panels['panel-program'].on('resized', (function() {
		this.vertex_editor.editor.refresh();
		this.fragment_editor.editor.refresh();
	}).bind(this));

	this.panels['panel-js'].on('resized', (function() {
		this.js_editor.editor.refresh();
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

	this.vertex_editor = new Editor(this.vertex_editor, glsl.source.VERTEX);
	this.fragment_editor = new Editor(this.fragment_editor, glsl.source.FRAGMENT);

	this.js_editor = new Editor(this.js_editor, 'javascript');

	this._init_panels();

	this.new_document();
};

var app = new App();
module.exports = app;
