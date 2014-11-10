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

    this._onWindowMousedown = (function(e) {
        var ppos = this.pagePosition(this._outer);

        if (e.clientX < ppos.x || e.clientX > ppos.x + this._outer.offsetWidth ||
            e.clientY < ppos.y || e.clientY > ppos.y + this._outer.offsetHeight) {
            this.destroy();
        }
    }).bind(this);

    this._onWindowKeydown = (function(e) {
        if (e.keyCode === 27) {
            this.destroy();
        }
    }).bind(this);

    window.addEventListener('mousedown', this._onWindowMousedown);
    window.addEventListener('keydown', this._onWindowKeydown);

    this._onDestroy = this.registerSignal('destroy');
}

Popup.on = function(on, cb) {
    var popup = null;

    on.addEventListener('mousedown', function() {
        if (!popup) {
            var f;

            f = function(e) {
                on.removeEventListener('mouseup', f);

                var r = function(p) {
                    popup = p;

                    if (p) {
                        popup = p;
                        popup.on('destroy', function() {
                            popup = null;
                        });
                    }
                };

                r(cb(r));
            };

            on.addEventListener('mouseup', f);
        }
    });
}

Popup.prototype = Object.create(Widget.prototype);
Popup.prototype.constructor = Popup;

Popup.prototype.destroy = function() {
    document.body.removeChild(this._outer);

    window.removeEventListener('mousedown', this._onWindowMousedown);
    window.removeEventListener('keydown', this._onWindowKeydown);

    this._onDestroy();
}

Popup.prototype.content = function(c) {
    if (typeof c === 'undefined') {
        return this._child;
    }

    this._content.removeChild(this._child);

    this._child = c;
    this._content.appendChild(this._child);
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

    this._content = content;

    outer.appendChild(content);

    var epos = this.pagePosition(this._on);
    epos.width = this._on.offsetWidth;
    epos.height = this._on.offsetHeight;

    var medim = {
        width: outer.offsetWidth,
        height: outer.offsetHeight
    };

    var pagedim = {
        width: document.body.offsetWidth,
        height: document.body.offsetHeight
    };

    var pos = {
        x: epos.x + epos.width / 2 - medim.width / 2,
        y: epos.y + epos.height + 14
    };

    if (pos.x + medim.width > pagedim.width - 12) {
        pos.x = pagedim.width - medim.width - 12;
    }

    var apos = epos.x + epos.width / 2 - pos.x;

    if (apos < 24) {
        apos = 24;
    } else if (apos > medim.width - 24) {
        apos = medim.width - 24;
    }

    arrow.style.right = (medim.width - apos) + 'px';

    if (pos.y + medim.height > pagedim.height && epos.y - medim.height - 14 >= 0) {
        pos.y = epos.y - medim.height - 14;
        arrow.classList.add('down');
    } else {
        arrow.classList.add('up');
    }

    outer.style.right = (pagedim.width - (pos.x + medim.width)) + 'px';
    outer.style.top = pos.y + 'px';

    this._outer = outer;
}

module.exports = Popup;

// vi:ts=4:et
