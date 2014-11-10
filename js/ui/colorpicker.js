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
var Popup = require('./popup');
var utils = require('../utils/utils');
var MouseTracker = require('./mousetracker');
var math = require('../math/math');

function ColorPicker(settings) {
    var e = this.create('div', {
        children: this.create('div', {
            classes: 'color-background',
            children: this.create('div', {
                classes: 'color',
                children: this.create('div', {
                    classes: 'highlight'
                })
            })
        })
    });

    this._color = e.querySelector('.color');

    this._value = math.vec3(0, 0, 0);
    this._hsv = this._rgbToHsv(this._value);

    Widget.call(this, 'color-picker', e, utils.merge({
    }, settings));

    this._color.addEventListener('click', this._showPopup.bind(this));
}

ColorPicker.prototype = Object.create(Widget.prototype);
ColorPicker.prototype.constructor = ColorPicker;

ColorPicker.prototype._rgbToHsv = function(rgb, h) {
    var min = Math.min(rgb[0], rgb[1], rgb[2]);
    var max = Math.max(rgb[0], rgb[1], rgb[2]);

    var s;
    var v = max;

    var delta = max - min;

    if (delta !== 0) {
        if (max !== 0) {
            s = delta / max;
        } else {
            s = 0;
            h = -1;
        }

        if (rgb[0] === max) {
            h = (rgb[1] - rgb[2]) / delta;
        } else if (rgb[1] === max) {
            h = 2 + (rgb[2] - rgb[0]) / delta;
        } else {
            h = 4 + (rgb[0] - rgb[1]) / delta;
        }

        h *= 60;

        if (h < 0) {
            h += 360;
        }
    } else {
        if (typeof h === 'undefined') {
            h = 0;
        }

        s = 0;
    }

    if (rgb.length > 3) {
        return math.vec4(h, s, v, rgb[3]);
    } else {
        return math.vec3(h, s, v);
    }
}

ColorPicker.prototype._hsvToRgb = function(hsv) {
    var c = hsv[2] * hsv[1];
    var h = hsv[0] / 60;
    var x = c * (1 - Math.abs(h % 2 - 1));
    var rgb;

    if (h < 1) {
        rgb = [c, x, 0];
    } else if (h < 2) {
        rgb = [x, c, 0];
    } else if (h < 3) {
        rgb = [0, c, x];
    } else if (h < 4) {
        rgb = [0, x, c];
    } else if (h < 5) {
        rgb = [x, 0, c];
    } else {
        rgb = [c, 0, x];
    }

    var m = hsv[2] - c;

    if (hsv.length > 3) {
        return math.vec4(rgb[0] + m, rgb[1] + m, rgb[2] + m, hsv[3]);
    } else {
        return math.vec3(rgb[0] + m, rgb[1] + m, rgb[2] + m);
    }
}

ColorPicker.prototype._showPopup = function() {
    var content = this.create('div', {
        classes: 'ui-color-picker-popup',
        children: [
            this.create('div', {
                classes: 'hue',
                children: this.create('div', {
                    classes: 'pick'
                })
            }),

            this.create('div', {
                classes: 'area',
                children: this.create('div', {
                    classes: 'pick'
                })
            }),

            this.create('div', {
                classes: 'alpha',
                children: this.create('div', {
                    classes: 'fg',
                    children: this.create('div', {
                        classes: 'pick'
                    })
                })
            })
        ]
    });

    var hsv = this._rgbToHsv(this._value);

    var svpick = content.querySelector('.area .pick');
    var hpick = content.querySelector('.hue .pick');
    var svarea = content.querySelector('.area');
    var harea = content.querySelector('.hue');

    var alphaArea = content.querySelector('.alpha');
    var alphaPick = content.querySelector('.alpha .pick');

    hpick.style.top = ((hsv[0] / 360) * 100) + '%';

    svpick.style.left = (hsv[1] * 100) + '%';
    svpick.style.top = ((1 - hsv[2]) * 100) + '%';

    var bg = this._hsvToRgb([hsv[0], 1, 1]);
    svarea.style.backgroundColor = this._rgbToHex(bg);

    var svTracker = new MouseTracker(svarea);

    var updateSv = function(sender, e) {
        this._updateSv(svarea, svpick, e);
    };

    svTracker.on('mousedown', updateSv, this);
    svTracker.on('mouseup', updateSv, this);
    svTracker.on('mousemove', updateSv, this);

    var hTracker = new MouseTracker(harea);

    var updateH = function(sender, e) {
        this._updateH(harea, hpick, svarea, e);
    };

    hTracker.on('mousedown', updateH, this);
    hTracker.on('mouseup', updateH, this);
    hTracker.on('mousemove', updateH, this);

    if (this._value.length > 3) {
        alphaPick.style.left = (this._value[3] * 100) + '%';

        var alphaTracker = new MouseTracker(alphaArea);

        var updateAlpha = function(sender, e) {
            this._updateAlpha(alphaArea, alphaPick, e);
        }

        alphaTracker.on('mousedown', updateAlpha, this);
        alphaTracker.on('mouseup', updateAlpha, this);
        alphaTracker.on('mousemove', updateAlpha, this);
    } else {
        alphaArea.classList.add('hidden');
    }

    var popup = new Popup(content, this.e);
}

ColorPicker.prototype._clip = function(v, a, b) {
    if (v < a) {
        return a;
    } else if (v > b) {
        return b;
    } else {
        return v;
    }
}

ColorPicker.prototype._updateAlpha = function(alphaArea, alphaPick, e) {
    var pos = this.pagePosition(alphaArea);
    var w = alphaArea.offsetWidth;

    pos.x += 1;

    var alpha = (this._clip(e.pageX, pos.x, pos.x + w) - pos.x) / w;
    alphaPick.style.left = (alpha * 100) + '%';

    this.value(math.vec4(this._value[0], this._value[1], this._value[2], alpha));
}

ColorPicker.prototype._updateSv = function(svarea, svpick, e) {
    var pos = this.pagePosition(svarea);

    pos.x += 1;
    pos.y += 1;

    var w = svarea.clientWidth;
    var h = svarea.clientHeight;

    var x = (this._clip(e.pageX, pos.x, pos.x + w) - pos.x) / w;
    var y = 1 - (this._clip(e.pageY, pos.y, pos.y + h) - pos.y) / h;

    svpick.style.left = (x * 100) + '%';
    svpick.style.top = ((1 - y) * 100) + '%';

    this._hsv[1] = x;
    this._hsv[2] = y;

    this.value(this._hsvToRgb(this._hsv));
}

ColorPicker.prototype._updateH = function(harea, hpick, svarea, e) {
    var pos = this.pagePosition(harea);
    var h = harea.offsetHeight;

    pos.y += 1;

    var y = this._clip(e.pageY, pos.y, pos.y + h);

    this._hsv[0] = ((y - pos.y) / h) * 360;

    hpick.style.top = ((this._hsv[0] / 360) * 100) + '%';

    var bg = this._hsvToRgb([this._hsv[0], 1, 1]);
    svarea.style.backgroundColor = this._rgbToHex(bg);

    this.value(this._hsvToRgb(this._hsv));
}

ColorPicker.prototype._toHex = function(v) {
    v *= 255;

    var h = '0123456789abcdef';
    return h[v >> 4] + h[v & 0x0f];
}

ColorPicker.prototype._rgbToHex = function(rgb) {
    var ret = '#';

    for (var i =0 ; i < 3; i++) {
        ret += this._toHex(rgb[i]);
    }

    return ret;
}

ColorPicker.prototype._valueUpdated = function() {
    this._color.style.backgroundColor = this._rgbToHex(this._value);

    if (this._value.length > 3) {
        this._color.style.opacity = this._value[3];
    }

    this._hsv = this._rgbToHsv(this._value, this._hsv[0]);
}

module.exports = ColorPicker;

// vi:ts=4:et
