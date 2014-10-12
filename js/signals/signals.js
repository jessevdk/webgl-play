function Signals() {
    this._events = {};
    this._emitter = {};
}

Signals.prototype._signal = function(cbs, args) {
    for (var i = 0; i < cbs.length; i++) {
        var cb = cbs[i];
        cb.cb.apply(cb.this ? cb.this : this, args);
    }
}

Signals.prototype.register_signal = function(ev) {
    if (!(ev in this._events)) {
        this._events[ev] = [];
    }

    var cbs = this._events[ev];

    this._emitter[ev] = (function() {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(this);

        this._signal(cbs, args);
    }).bind(this);

    return this._emitter[ev];
}

Signals.prototype.on = function(ev, cb, _this) {
    if (!(ev in this._events)) {
        this._events[ev] = [{cb: cb, this: _this}];
    } else {
        this._events[ev].push({cb: cb, this: _this});
    }
}

Signals.prototype.emit = function(ev) {
    var args = Array.prototype.slice.call(arguments, 1);

    if (ev in this._emitter) {
        this._emitter[ev].apply(this, args);
     } else {
        if (ev in this._events) {
            args.unshift(this);

            this._signal(this._events[ev], args);
        }
    }
}

Signals.prototype.off = function(ev, cb, _this) {
    if (ev in this._events) {
        var evs = this._events[ev];

        for (var i = 0; i < evs.length; i++) {
            if (evs[i].cb === cb && evs[i].this === _this) {
                evs.splice(i, 1);
                break;
            }
        }

        if (evs.length === 0) {
            delete this._events[ev];
        }
    }
}

module.exports = Signals;

// vi:ts=4:et
