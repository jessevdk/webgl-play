function Widget(e) {
	this.e = e;

	this._events = {};
	this._emitter = {};
}

Widget.prototype.children = function(e) {
	if (typeof e === 'undefined') {
		e = this.e;
	}

	var ret = [];

	for (var i = 0; i < e.childNodes.length; i++) {
		var c = e.childNodes[i];

		if (c.nodeType == document.ELEMENT_NODE) {
			ret.push(c);
		}
	}

	return ret;
}

Widget.prototype.register_signal = function(ev) {
	if (!(ev in this._events)) {
		this._events[ev] = [];
	}

	var cbs = this._events[ev];

	this._emitter[ev] = function() {
		for (var i = 0; i < cbs.length; i++) {
			cbs[i].apply(this, arguments);
		}
	}

	return this._emitter[ev];
}

Widget.prototype.on = function(ev, cb) {
	if (!(ev in this._events)) {
		this._events[ev] = [cb];
	} else {
		this._events[ev].push(cb);
	}
}

Widget.prototype.emit = function(ev) {
	if (ev in this._emitter) {
		this._emitter[ev].apply(this, arguments.slice(1));
 	} else {
		if (ev in this._events) {
			var cbs = this._events[ev];

			for (var i = 0; i < cbs.length; i++) {
				cbs[i].apply(this, arguments.slice(1));
			}
		}
	}
}

Widget.prototype.off = function(ev, cb) {
	if (ev in this._events) {
		var pos = this._events[ev].indexOf(cb);

		if (pos != -1) {
			this._events[ev].splice(pos, 1);
		}
	}
}

Widget.prototype.page_position = function(e) {
	if (typeof e === 'undefined') {
		e = this.e;
	}

	var ret = {x: 0, y: 0};

	do {
		ret.x += e.offsetLeft;
		ret.y += e.offsetTop;

		e = e.offsetParent;
	} while (e !== null);

	return ret;
}

module.exports = Widget;
