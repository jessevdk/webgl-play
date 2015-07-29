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

function Panel(p) {
    Widget.call(this, 'panel', null, { wrap: p });

    if (this.e.classList.contains('vertical')) {
        this._orientation = Panel.Orientation.VERTICAL;
    } else {
        this._orientation = Panel.Orientation.HORIZONTAL;
    }

    var children = this.childElements();

    this.child1 = children[0];
    this.sep = children[1];
    this.child2 = children[2];

    this._onMousedown = this._onMousedownReal.bind(this);
    this._onMouseup = this._onMouseupReal.bind(this);
    this._onMousemove = this._onMousemoveReal.bind(this);

    this._onResized = this.registerSignal('resized');

    this.sep.addEventListener('mousedown', this._onMousedown);
}

Panel.prototype = Object.create(Widget.prototype);
Panel.prototype.constructor = Panel;

Panel.Orientation = {
    HORIZONTAL: 0,
    VERTICAL: 1
};

Panel.prototype.position = function(value) {
    if (typeof value === 'undefined') {
        if (this.child1.style.flexBasis) {
            return parseInt(this.child1.style.flexBasis);
        } else {
            return null;
        }
    }

    if (value !== null) {
        this.child1.style.flexBasis = value + 'px';
    }
};

Panel.prototype._onMousedownReal = function(e) {
    window.addEventListener('mousemove', this._onMousemove);
    window.addEventListener('mouseup', this._onMouseup);

    var p = this.pagePosition(this.sep);

    if (this._orientation == Panel.Orientation.VERTICAL) {
        this._doffset = e.pageY - p.y;
        document.body.style.cursor = 'ns-resize';
    } else {
        this._doffset = e.pageX - p.x;
        document.body.style.cursor = 'ew-resize';
    }

    e.preventDefault();
};

Panel.prototype._onMouseupReal = function(e) {
    window.removeEventListener('mousemove', this._onMousemove);
    window.removeEventListener('mouseup', this._onMouseup);

    document.body.style.cursor = '';

    e.preventDefault();
};

Panel.prototype._onMousemoveReal = function(e) {
    var d;

    var pagepos = this.pagePosition();

    if (this._orientation == Panel.Orientation.VERTICAL) {
        d = e.pageY - pagepos.y;
    } else {
        d = e.pageX - pagepos.x;
    }

    this.child1.style.flexBasis = (d - this._doffset) + 'px';

    this._onResized();

    e.preventDefault();
};

module.exports = Panel;

// vi:ts=4:et
