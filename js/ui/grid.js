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

function Grid(settings) {
    Widget.call(this, 'grid', this.create('table'), utils.merge({
        children: [],
        columns: 2
    }, settings));

    this._row = null;
    this._col = 0;
    this._spans = [];

    if (this._settings.children) {
        for (var i = 0; i < this._settings.children.length; i++) {
            this.add(this._settings.children[i]);
        }
    }
}

Grid.prototype = Object.create(Widget.prototype);
Grid.prototype.constructor = Grid;

Grid.prototype._reduceRowspan = function() {
    var i = 0;

    while (i < this._spans.length) {
        var rsp = this._spans[i];

        if (rsp.rowspan) {
            rsp.rowspan--;

            if (rsp.rowspan === 0) {
                this._spans.splice(i, 1);
                continue;
            } else {
                i++;
            }
        }

        if (this._col === rps.column) {
            this._col += rps.colspan;
        }
    }
}

Grid.prototype.add = function(child) {
    while (this._row === null || this._col >= this._settings.columns) {
        this._row = this.create('tr', {
            parent: this.e
        });

        this._col = 0;
        this._reduceRowspan();
    }

    this.create('td', {
        parent: this._row,
        children: child.e
    });

    this.children.push(child);

    if (typeof child._settings.colspan !== 'undefined' ||
        typeof child._settings.rowspan !== 'undefined') {
        var span = {
            colspan: child._settings.colspan || 1,
            rowspan: child._settings.rowspan || 1,
            column: this._col
        };

        this._col += span.colspan;

        for (var i = 0; i < this._spans; i++) {
            if (this._spans[i] > this._col) {
                this._spans[i].splice(i, 0, span);
                return;
            }
        }

        this._spans.push(span);
    } else {
        this._col++;
    }
}

module.exports = Grid;

// vi:ts=4:et
