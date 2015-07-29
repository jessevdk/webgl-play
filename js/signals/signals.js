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

function Signals() {
    this._events = {};
    this._emitter = {};
}

Signals.prototype._signal = function(cbs, args) {
    for (var i = 0; i < cbs.length; i++) {
        var cb = cbs[i];
        cb.cb.apply(cb.this ? cb.this : this, args);
    }
};

Signals.prototype.registerSignal = function(ev) {
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
};

Signals.prototype.on = function(ev, cb, _this) {
    if (!(ev in this._events)) {
        this._events[ev] = [{cb: cb, this: _this}];
    } else {
        this._events[ev].push({cb: cb, this: _this});
    }
};

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
};

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
};

module.exports = Signals;

// vi:ts=4:et
