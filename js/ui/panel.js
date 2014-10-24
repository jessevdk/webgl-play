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
    Widget.call(this, p);

    if (this.e.classList.contains('vertical')) {
        this._orientation = Panel.Orientation.VERTICAL;
    } else {
        this._orientation = Panel.Orientation.HORIZONTAL;
    }

    var children = this.children();

    this.child1 = children[0];
    this.sep = children[1];
    this.child2 = children[2];

    this._on_mousedown = this._on_mousedown_real.bind(this);
    this._on_mouseup = this._on_mouseup_real.bind(this);
    this._on_mousemove = this._on_mousemove_real.bind(this);

    this._on_resized = this.register_signal('resized');

    this.sep.addEventListener('mousedown', this._on_mousedown);
}

Panel.prototype = Object.create(Widget.prototype);
Panel.prototype.constructor = Panel;

Panel.Orientation = {
    HORIZONTAL: 0,
    VERTICAL: 1
};

Panel.prototype._on_mousedown_real = function(e) {
    window.addEventListener('mousemove', this._on_mousemove);
    window.addEventListener('mouseup', this._on_mouseup);

    p = this.page_position(this.sep);

    if (this._orientation == Panel.Orientation.VERTICAL) {
        this._doffset = e.pageY - p.y;
        document.body.style.cursor = 'ns-resize';
    } else {
        this._doffset = e.pageX - p.x;
        document.body.style.cursor = 'ew-resize';
    }

    e.preventDefault();
}

Panel.prototype._on_mouseup_real = function(e) {
    window.removeEventListener('mousemove', this._on_mousemove);
    window.removeEventListener('mouseup', this._on_mouseup);

    document.body.style.cursor = '';

    e.preventDefault();
}

Panel.prototype._on_mousemove_real = function(e) {
    var d;

    pagepos = this.page_position();

    if (this._orientation == Panel.Orientation.VERTICAL) {
        d = e.pageY - pagepos.y;
    } else {
        d = e.pageX - pagepos.x;
    }

    this.child1.style.flexBasis = (d - this._doffset) + 'px';

    this._on_resized();

    e.preventDefault();
}

module.exports = Panel;

// vi:ts=4:et
