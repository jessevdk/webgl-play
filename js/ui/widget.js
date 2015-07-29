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

var Signals = require('../signals/signals');

function Widget(clsname, e, settings) {
    Signals.call(this);

    if (settings.wrap) {
        this.e = settings.wrap;
    } else {
        this.e = e;
    }

    if (settings.title) {
        this.e.title = settings.title;
    }

    this.e.classList.add('ui-widget');

    if (clsname) {
        this.e.classList.add('ui-' + clsname);
    }

    this._sensitive = true;
    this._settings = settings;

    this.children = [];

    var notify = this.registerSignal('notify::value');

    this._onNotifyValue = (function() {
        notify(this._value);
    }).bind(this);

    this._onNotifySensitive = this.registerSignal('notify::sensitive');

    if (this._settings.bind) {
        var binding;

        if (typeof this._settings.bind === 'function') {
            binding = this._settings.bind;
        } else {
            var f = function(obj, prop, sender, value) {
                if (typeof value === 'undefined') {
                    return obj[prop];
                }

                obj[prop] = value;
            };

            if (Array.prototype.isPrototypeOf(this._settings.bind)) {
                binding = f.bind(this, this._settings.bind[0], this._settings.bind[1]);
            } else {
                binding = f.bind(this, this._settings.bind.object, this._settings.bind.property);
            }
        }

        this.on('notify::value', binding);
        this.value(binding());
    }

    if (typeof this._settings.value !== 'undefined') {
        this.value(this._settings.value);
    }

    if (typeof this._settings.sensitive !== 'undefined') {
        this.sensitive(this._settings.sensitive);
    }
}

Widget.prototype = Object.create(Signals.prototype);
Widget.prototype.constructor = Widget;

Widget.prototype.sensitive = function(value) {
    if (typeof value === 'undefined') {
        return this._sensitive;
    }

    value = !!value;

    if (value !== this._sensitive) {
        this._sensitive = value;

        if (value) {
            this.e.classList.remove('insensitive');
        } else {
            this.e.classList.add('insensitive');
        }

        this._onNotifySensitive();
    }
};

Widget.prototype._valueTransform = function(v) {
    return v;
};

Widget.prototype._valueUpdated = function() {
};

Widget.prototype.value = function(value) {
    if (typeof value === 'undefined') {
        return this._value;
    }

    value = this._valueTransform(value);

    if (this._value !== value) {
        this._value = value;

        this._valueUpdated();
        this._onNotifyValue();
    }
};

Widget.createUi = function(name, attributes) {
    var ret = document.createElement(name);

    if (!attributes) {
        attributes = {};
    }

    var i;

    for (var a in attributes) {
        var v = attributes[a];

        if (a === 'classes') {
            if (typeof v === 'string') {
                ret.classList.add(v);
            } else {
                for (i = 0; i < v.length; i++) {
                    ret.classList.add(v[i]);
                }
            }
        } else if (a === 'parent') {
            v.appendChild(ret);
        } else if (a === 'children') {
            if (typeof v === 'object' && Array.prototype.isPrototypeOf(v)) {
                for (i = 0; i < v.length; i++) {
                    ret.appendChild(v[i]);
                }
            } else {
                ret.appendChild(v);
            }
        } else {
            if (a in ret) {
                ret[a] = v;
            } else {
                ret.setAttribute(a, v);
            }
        }
    }

    return ret;
};

Widget.prototype.create = function(name, attributes) {
    return Widget.createUi(name, attributes);
};

Widget.prototype.childElements = function(e) {
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
};

Widget.prototype.pagePosition = function(e) {
    if (typeof e === 'undefined') {
        e = this.e;
    }

    var ret = {x: 0, y: 0};

    if (typeof e.getBoundingClientRect === 'function') {
        var rect = e.getBoundingClientRect();

        return {
            x: rect.left + document.body.scrollLeft,
            y: rect.top + document.body.scrollTop
        };
    } else {

        do {
            ret.x += e.offsetLeft;
            ret.y += e.offsetTop;

            e = e.offsetParent;
        } while (e !== null);
    }

    return ret;
};

module.exports = Widget;

// vi:ts=4:et
