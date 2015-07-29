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

var Widget = require('./widget');
var utils = require('../utils/utils');

function MultiSwitch(settings) {
    this._value = null;

    settings = utils.merge({
        values: [0, 1]
    }, settings);

    var cols = [];
    var n = settings.values.length;
    var p = Math.floor(1 / n * 100);

    var i;

    for (i = 0; i < n; i++) {
        cols.push(this.create('col', {
            width: p + '%'
        }));
    }

    var tds = [];

    this._values = [];
    this._valueMap = {};

    for (i = 0; i < n; i++) {
        var val = settings.values[i];

        if (typeof val !== 'object') {
            val = {
                title: null,
                name: val,
                value: val,
                sensitive: true
            };
        } else {
            val = utils.merge({
                sensitive: true,
                title: null
            }, val);

            val.sensitive = !!val.sensitive;
        }

        val.td = this.create('td', {
            textContent: val.name
        });

        if (!val.sensitive) {
            val.td.classList.add('insensitive');
        } else if (typeof settings.value === 'undefined' && typeof settings.bind === 'undefined') {
            // Set initial value to the first sensitive value
            settings.value = val.value;
        }

        if (val.title) {
            val.td.title = val.title;
        }

        this._values.push(val);
        this._valueMap[val.value] = val;

        if (val.sensitive) {
            val.td.addEventListener('click', (function(val, e) {
                this.value(val.value);

                e.preventDefault();
                e.stopPropagation();
            }).bind(this, val));
        }

        tds.push(val.td);
    }

    this._active = null;

    Widget.call(this, 'multi-switch', this.create('table', {
        children: [
            this.create('colgroup', {
                children: cols
            }),

            this.create('tr', {
                children: tds
            })
        ]
    }), settings);
}

MultiSwitch.prototype = Object.create(Widget.prototype);
MultiSwitch.prototype.constructor = MultiSwitch;

MultiSwitch.prototype._transformValue = function(v) {
    var val = this._valueMap[v];

    if (val && !val.sensitive) {
        return this._value;
    }

    return val;
};

MultiSwitch.prototype._valueUpdated = function() {
    var val = this._valueMap[this._value];

    if (val) {
        if (this._active !== null) {
            this._active.classList.remove('active');
        }

        this._active = val.td;
        this._active.classList.add('active');
    }
};

module.exports = MultiSwitch;

// vi:ts=4:et
