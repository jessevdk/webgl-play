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

function Popup(child, on) {
    this._child = child;
    this._on = on;
    this._build();

    Widget.call(this, 'popup', null, { wrap: this._outer });

    this._on_window_mousedown = (function(e) {
        var ppos = this.page_position(this._outer);

        if (e.clientX < ppos.x || e.clientX > ppos.x + this._outer.offsetWidth ||
            e.clientY < ppos.y || e.clientY > ppos.y + this._outer.offsetHeight) {
            this.destroy();
        }
    }).bind(this);

    this._on_window_keydown = (function(e) {
        if (e.keyCode === 27) {
            this.destroy();
        }
    }).bind(this);

    window.addEventListener('mousedown', this._on_window_mousedown);
    window.addEventListener('keydown', this._on_window_keydown);

    this._on_destroy = this.register_signal('destroy');
}

Popup.prototype = Object.create(Widget.prototype);
Popup.prototype.constructor = Popup;

Popup.prototype.destroy = function() {
    document.body.removeChild(this._outer);

    window.removeEventListener('mousedown', this._on_window_mousedown);
    window.removeEventListener('keydown', this._on_window_keydown);

    this._on_destroy();
}

Popup.prototype._build = function() {
    var outer = document.createElement('div');
    outer.classList.add('ui-popup');

    document.body.appendChild(outer);

    var arrow = document.createElement('div');
    arrow.classList.add('arrow');

    outer.appendChild(arrow);

    var content = document.createElement('div');
    content.classList.add('content');
    content.appendChild(this._child);

    outer.appendChild(content);

    var epos = this.page_position(this._on);
    epos.width = this._on.offsetWidth;
    epos.height = this._on.offsetHeight;

    var medim = {
        width: outer.offsetWidth,
        height: outer.offsetHeight
    };

    var pagedim = {
        width: document.body.offsetWidth - 12,
        height: document.body.offsetHeight - 12
    };

    var pos = {
        x: epos.x + epos.width / 2 - medim.width / 2,
        y: epos.y + epos.height + 14
    };

    if (pos.x + medim.width > pagedim.width) {
        pos.x = pagedim.width - medim.width;
    }

    var apos = epos.x + epos.width / 2 - pos.x;

    if (apos < 24) {
        apos = 24;
    } else if (apos > medim.width - 24) {
        apos = medim.width - 24;
    }

    arrow.style.left = apos + 'px';

    if (pos.y + medim.height > pagedim.height) {
        pos.y = epos.y - medim.height - 14;
        arrow.classList.add('down');
    } else {
        arrow.classList.add('up');
    }

    outer.style.left = pos.x + 'px';
    outer.style.top = pos.y + 'px';

    this._outer = outer;
}

module.exports = Popup;

// vi:ts=4:et
