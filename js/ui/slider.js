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

function Slider(settings) {
    var e = this.create('div', {
        children: [
            this.create('div', {
                classes: 'trough',
                children: [
                    this.create('div', {
                        classes: 'bob'
                    })
                ]
            })
        ]
    });

    this._bob = e.querySelector('.bob');
    this._trough = e.querySelector('.trough');

    Widget.call(this, 'slider', e, utils.merge({
        min: 0,
        max: 1
    }, settings));

    this._bob.addEventListener('mousedown', this._onBobMousedown.bind(this));
    this._trough.addEventListener('click', this._onTroughClick.bind(this));

    this._trough.addEventListener('wheel', this._onTroughWheel.bind(this));
}

Slider.prototype = Object.create(Widget.prototype);
Slider.prototype.constructor = Slider;

Slider.prototype._onTroughWheel = function(e) {
    var delta = (e.deltaX + e.deltaY) / this._trough.offsetWidth;

    delta *= (this._settings.max - this._settings.min);

    this.value(this.value() + delta);

    e.preventDefault();
    e.stopPropagation();
};

Slider.prototype._updateFromPageX = function(x) {
    var pos = this.pagePosition(this._trough);
    var f = (x - pos.x) / this._trough.offsetWidth;

    this.value(f * (this._settings.max - this._settings.min) + this._settings.min);
};

Slider.prototype._onTroughClick = function(e) {
    this._updateFromPageX(e.pageX);
};

Slider.prototype._onBobMousedown = function(e) {
    this._onBobMousemove = (function(e) {
        this._updateFromPageX(e.pageX);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this);

    this._onBobMouseup = (function(e) {
        window.removeEventListener('mousemove', this._onBobMousemove);
        window.removeEventListener('mouseup', this._onBobMouseup);

        e.preventDefault();
        e.stopPropagation();
    }).bind(this);

    window.addEventListener('mousemove', this._onBobMousemove);
    window.addEventListener('mouseup', this._onBobMouseup);

    e.preventDefault();
    e.stopPropagation();
};

Slider.prototype._clip = function(v) {
    if (v < this._settings.min) {
        return this._settings.min;
    } else if (v > this._settings.max) {
        return this._settings.max;
    }

    return v;
};

Slider.prototype._valueTransform = function(v) {
    return this._clip(v);
};

Slider.prototype._valueUpdated = function() {
    this._bob.style.left = ((this._value - this._settings.min) / (this._settings.max - this._settings.min) * 100) + '%';

    this._bob.title = this._value;
};

module.exports = Slider;

// vi:ts=4:et
