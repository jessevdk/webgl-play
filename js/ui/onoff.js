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

function OnOff(settings) {
    Widget.call(this, 'on-off', this.create('table', {
        children: [
            this.create('colgroup', {
                children: [
                    this.create('col', {
                        width: '50%'
                    }),
                    this.create('col', {
                        width: '50%'
                    })
                ]
            }),
            this.create('tr', {
                children: [
                    this.create('td', {
                        textContent: 'Off',
                        classes: 'off'
                    }),

                    this.create('td', {
                        textContent: 'On',
                        classes: 'on'
                    })
                ]
            })
        ]
    }), utils.merge({}, settings));

    this._active = false;
    this._bind = null;

    this._on = this.e.querySelector('.on');
    this._off = this.e.querySelector('.off');

    this._on.addEventListener('click', (function(e) {
        this.active(true);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    this._off.addEventListener('click', (function(e) {
        this.active(false);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this));

    this._on_notify_active = this.register_signal('notify::active');

    if (this._settings.bind) {
        if (typeof this._settings.bind === 'function') {
            this._bind = this._settings.bind;
        } else {
            var f = function(obj, prop, active) {
                if (typeof active === 'undefined') {
                    return obj[prop];
                }

                obj[prop] = active;
            };

            if (Array.prototype.isPrototypeOf(this._settings.bind)) {
                this._bind = f.bind(this, this._settings.bind[0], this._settings.bind[1]);
            } else {
                this._bind = f.bind(this, this._settings.bind.object, this._settings.bind.property);
            }
        }

        this.active(this._bind());
    }

    if (typeof this._settings.active !== 'undefined') {
        this.active(this._settings.active);
    }
}

OnOff.prototype = Object.create(Widget.prototype);
OnOff.prototype.constructor = OnOff;

OnOff.prototype.active = function(value) {
    if (typeof value === 'undefined') {
        return this._active;
    }

    value = !!value;

    if (this._active !== value) {
        this._active = value;

        if (value) {
            this.e.classList.add('active');
        } else {
            this.e.classList.remove('active');
        }

        this._on_notify_active();

        if (this._bind) {
            this._bind(value);
        }
    }
}

module.exports = OnOff;

// vi:ts=4:et
