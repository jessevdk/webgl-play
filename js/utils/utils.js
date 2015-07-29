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

var passObjects = [
    Int8Array.prototype,
    Uint8Array.prototype,
    Int16Array.prototype,
    Uint16Array.prototype,
    Int32Array.prototype,
    Uint32Array.prototype,
    Float32Array.prototype,
    Float64Array.prototype,
    Array.prototype
];

var Browser = {
    IsIE: (function() {
        return navigator.userAgent.indexOf('Trident/') !== -1 || navigator.userAgent.indexOf('MSIE') !== -1;
    })()
};

function merge() {
    var ret = {};

    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];

        if (typeof arg === 'undefined') {
            continue;
        }

        for (var k in arg) {
            if (arg.hasOwnProperty(k)) {
                if (typeof ret[k] === 'object' && typeof arg[k] === 'object' && passObjects.indexOf(Object.getPrototypeOf(arg[k])) === -1) {
                    ret[k] = merge(ret[k], arg[k]);
                } else {
                    ret[k] = arg[k];
                }
            }
        }
    }

    return ret;
}

var escapeDiv = document.createElement('div');
var escapeElement = document.createTextNode('');
escapeDiv.appendChild(escapeElement);

function htmlEscape(s) {
    escapeElement.data = s;
    return escapeDiv.innerHTML;
}

function api(url, method, data, options) {
    options = merge({
        success: function() {},
        error: function() {},
        backend: true,
        json: true
    }, options);

    var req = new XMLHttpRequest();

    req.onload = function(e) {
        var req = e.target;

        if (req.status === 200) {
            var ret;

            if (options.json) {
                try {
                    ret = JSON.parse(req.responseText);
                } catch (err) {
                    options.error(req, err);
                    return;
                }
            } else {
                ret = req.responseText;
            }

            options.success(req, ret);
        } else {
            options.error(req, null);
        }
    };

    req.onerror = function(e) {
        options.error(e.target, null);
    };

    if (options.backend) {
        url = global.Settings.backend.url(url);
    }

    req.open(method, url, true);

    if (options.json) {
        req.setRequestHeader('Content-Type', 'application/json');
    }

    if (typeof data !== 'undefined') {
        req.send(JSON.stringify(data));
    } else {
        req.send();
    }
}

function get(url, options) {
    return api(url, 'get', undefined, options);
}

function getQuery(url, query, options) {
    var first = true;

    for (var k in query) {
        if (first) {
            url += '?';
            first = false;
        } else {
            url += '&';
        }

        url += encodeURIComponent(k) + '=' + encodeURIComponent(query[k]);
    }

    return api(url, 'get', undefined, options);
}

function post(url, data, options) {
    return api(url, 'post', data, options);
}

exports.merge = merge;
exports.htmlEscape = htmlEscape;

exports.get = get;
exports.getQuery = getQuery;
exports.post = post;
exports.api = api;
exports.Browser = Browser;

// vi:ts=4:et
