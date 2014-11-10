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

function Spinner(settings) {
    settings = utils.merge({
        nframes: 31
    }, settings);

    Widget.call(this, 'spinner', this.create('div'), settings);

    this._animateId = 0;
    this._animateStart = null;
    this._framePeriod = 1 / (this._settings.nframes + 1);
}

Spinner.prototype = Object.create(Widget.prototype);
Spinner.prototype.constructor = Spinner;

Spinner.prototype.start = function() {
    this._animateId = requestAnimationFrame(this._animate.bind(this));
}

Spinner.prototype.cancel = function() {
    if (this._animateId != 0) {
        cancelAnimationFrame(this._animateId);

        this._animateId = 0;
        this._animateStart = null;

        // Set back to initial
        this.e.style.backgroundPositionX = '';
        this.e.style.backgroundPositionY = '';
    }
}

Spinner.prototype._animate = function(stamp) {
    if (!this.e.parentNode || (document.compareDocumentPosition(this.e) & document.DOCUMENT_POSITION_CONTAINED_BY) === 0) {
        this.cancel();
        return;
    }

    if (this._animateStart == null) {
        this._animateStart = stamp;
    }

    // In seconds
    var elapsed = (stamp - this._animateStart) / 1000.0;
    var frame = Math.floor(elapsed / this._framePeriod % this._settings.nframes);

    // Skip first frame, which is empty
    frame += 1;

    var fx = Math.floor(frame % 8);
    var fy = Math.floor(frame / 8);

    this.e.style.backgroundPositionX = (-100 * fx) + '%';
    this.e.style.backgroundPositionY = (-100 * fy) + '%';

    this.start();
}

module.exports = Spinner;

/* vi:ts=4:et */
