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
var Spinner = require('./spinner');
var Progress = require('./progress');
var Spinner = require('./spinner');
var utils = require('../utils/utils');

function FilesReader(files, settings) {
    var e = this.create('table');

    this._files = {};

    var countdown = files.length;

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var reader = new FileReader(f);

        var pos = f.name.lastIndexOf('/');
        var name;

        if (pos === -1) {
            name = f.name;
        } else {
            name = f.name.slice(pos + 1);
        }

        var prg = new Progress();

        var row = this.create('tr', {
            children: [
                this.create('td', {
                    classes: 'file',
                    textContent: name
                }),

                this.create('td', {
                    classes: 'progress',
                    children: prg.e
                }),

                this.create('td', {
                    classes: 'percentage',
                    textContent: '0%'
                })
            ]
        });

        var perc = row.querySelector('.percentage');

        prg.on('notify::value', (function(perc, p, v) {
            perc.textContent = Math.round(v * 100) + '%';
        }).bind(this, perc));

        e.appendChild(row);

        reader.onprogress = (function(prg, e) {
            var f = e.loaded / e.total;
            prg.value(f);
        }).bind(this, prg);

        reader.onloadend = (function(f, row, perc, e) {
            var ret = null;

            countdown--;

            if (e.loaded !== e.total) {
                row.classList.add('error');
                perc.textContent = '!';

                this._files[f.name].finished = true;
            } else {
                row.classList.add('ok');

                // Add spinner to indicate finishing up the load
                perc.textContent = '';

                var spinner = new Spinner();
                perc.appendChild(spinner.e);

                this._files[f.name].spinner = spinner;

                spinner.start();
                ret = e.target.result;
            }

            this._onLoaded(f, ret);

            if (countdown === 0) {
                this._onFinished();
            }
        }).bind(this, f, row, perc);

        this._files[f.name] = {
            file: f,
            row: row,
            percentage: perc,
            spinner: null,
            finished: false
        };

        reader.readAsText(f, 'utf-8');
    }

    Widget.call(this, 'files-reader', e, utils.merge({}, settings));

    this._onLoaded = this.registerSignal('loaded');
    this._onFinished = this.registerSignal('finished');
}

FilesReader.prototype = Object.create(Widget.prototype);
FilesReader.prototype.constructor = FilesReader;

FilesReader.prototype.finished = function(f, ok) {
    if (!(f.name in this._files)) {
        return;
    }

    var ff = this._files[f.name];

    if (!ff.finished) {
        ff.spinner.cancel();
        ff.percentage.removeChild(ff.spinner.e);

        if (ok) {
            ff.percentage.textContent = '✓';
        } else {
            ff.row.classList.remove('ok');
            ff.row.classList.remove('error');

            ff.percentage.textContent = '!';
        }

        ff.row.classList.add('finished');
        ff.finished = true;
    }
};

module.exports = FilesReader;

// vi:ts=4:et
