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

var utils = require('../utils/utils');
var Model = require('./model');
var Geometry = require('./geometry');
var RenderGroup = require('./rendergroup');
var RenderGroups = require('./rendergroups');
var Store = require('../app/store');

var objectCache = {};

var fs = require('fs');

function WavefrontParser() {
    if (utils.Browser.IsIE) {
        this._worker = new Worker(global.Settings.frontend.url('assets/js/models/wavefrontparser.js'));
    } else {
        var code = new Blob([fs.readFileSync(__dirname + '/wavefrontparser.js', 'utf-8')],
                            { type: 'application/javascript '});

        this._worker = new Worker(URL.createObjectURL(code));
    }

    this._worker.addEventListener('message', this._onWorkerMessage.bind(this));

    this._id = 0;
    this._callbacks = {};
}

WavefrontParser.prototype._onWorkerMessage = function(message) {
    var cb = this._callbacks[message.data.id];

    if (cb) {
        delete this._callbacks[message.data.id];
        cb(message.data.result);
    }
};

WavefrontParser.prototype.parse = function(data, options, cb) {
    var id = this._id++;
    this._callbacks[id] = cb;

    this._worker.postMessage({
        data: data,
        options: options,
        id: id
    });
};

var wavefrontParser = new WavefrontParser();

function createModel(ctx, ret, objects, options) {
    for (var i = 0; i < objects.length; i++) {
        var o = objects[i];
        var m = new Model(ctx, o.name, options);

        m.renderer = new RenderGroups({
            aabbox: o.aabbox
        });

        for (var k = 0; k < o.buffers.length; k++) {
            var buffer = o.buffers[k];

            var geom = new Geometry(ctx,
                                    new Float32Array(buffer.attributes.vertices),
                                    new Float32Array(buffer.attributes.normals));

            for (var gi = 0; gi < buffer.groups.length; gi++) {
                var g = buffer.groups[gi];

                m.renderer.add(new RenderGroup(ctx, geom, new Uint16Array(g.indices), {
                    aabbox: g.aabbox
                }));
            }
        }

        if (m.renderer.groups.length === 1) {
            m.renderer = m.renderer.groups[0];
        }

        ret.add(m);
    }

    return ret;
}

function cacheKey(filename, options) {
    return filename + '::' + JSON.stringify({
        autosmooth: options.autosmooth,
        shareVertices: options.shareVertices
    });
}

function parseOrCachedObj(ctx, date, filename, ret, body, fromCache, options) {
    var key = cacheKey(filename, options);

    // Try local/session cache first
    var cached = objectCache[key];

    if (cached && cached.date.getTime() === date.getTime()) {
        // Already loaded from cache
        options.success(ret);
        return ret;
    }

    // Try storage cache
    new Store(function(store) {
        store.objectFromCache(key, date, function(store, objects) {
            var f = function(objects) {
                objectCache[key] = {
                    date: date,
                    objects: objects
                };

                // Remove models loaded from the cache
                if (fromCache !== null) {
                    for (var i = 0; i < fromCache.length; i++) {
                        ret.remove(fromCache[i]);
                    }
                }

                createModel(ctx, ret, objects, options);

                options.complete(ret);
                options.success(ret);
            };

            if (!objects) {
                var parseOptions = {
                    autosmooth: options.autosmooth,
                    shareVertices: options.shareVertices
                };

                wavefrontParser.parse(body, parseOptions, function(objects) {
                    store.objectToCache(key, filename, date, objects);
                    f(objects);
                });
            } else {
                f(objects);
            }
        });
    });

    return ret;
}

/**
 * Load a Wavefront OBJ from file. This asynchronously loads
 * the given file and constructs a model from its definition.
 * This function returns an initially empty model which will
 * be filled in with child models representing all the objects
 * from the loaded file when the file is loaded. It is valid
 * to render the returned model immediately, but it will be
 * empty until the file finishes loading.
 *
 * To be notified of the model being finished loading, you can
 * specify a 'success(model)' callback in the options parameter.
 * If an error occurred during loading, the 'error(request, message)'
 * callback will be called instead.
 *
 * @param ctx the context.
 * @param filename the filename.
 * @param options optional options.
 */
exports.load = function(ctx, filename, options) {
    var localPrefix = 'local:';
    var isLocal = (filename.indexOf(localPrefix) === 0);

    if (!isLocal && document.location.protocol.indexOf('file') === 0) {
        throw new Error('Cannot load external models in local mode');
    }

    var makeError = (function(stack) {
        return function(message) {
            var e = new Error(message);
            e.originalStack = stack;

            return e;
        };
    })((new Error()).stack);

    options = utils.merge({
        error: function(m) { throw makeError(m); },
        success: function() {},
        complete: function() {},
        autosmooth: false,
        shareVertices: true
    }, options);

    var ret = new Model(ctx, filename, options);

    // Load previous from cache if possible.
    var cached = objectCache[cacheKey(filename, options)];
    var fromCache = null;

    if (cached) {
        createModel(ctx, ret, cached.objects, options);
        options.complete(ret);

        fromCache = ret.children.slice(0);
    }

    if (isLocal) {
        new Store(function(store) {
            var localName = filename.slice(localPrefix.length);

            store.modelData(localName, function(store, model) {
                if (model !== null) {
                    try {
                        parseOrCachedObj(ctx, model.creationTime, filename, ret, model.data, fromCache, options);
                    } catch (e) {
                        console.error(e.stack);
                        options.error(e.message);
                    }
                } else {
                    options.error('Model not found');
                }
            });
        });
    } else {
        var backend;
        var url;

        if (filename.indexOf('http:') === 0 || filename.indexOf('https:') === 0) {
            url = 'm/';
            backend = true;
        } else {
            url = global.Settings.frontend.url('assets/models/');
            backend = false;
        }

        url += encodeURIComponent(filename);

        utils.get(url, {
            success: function(req, body) {
                try {
                    var date = new Date(req.getResponseHeader('Last-Modified'));
                    parseOrCachedObj(ctx, date, filename, ret, body, fromCache, options);
                } catch (e) {
                    console.error(e.stack);
                    options.error(e.message);
                }
            },

            error: function(req, e) {
                options.error(e ? e.message : req.responseText);
            },

            backend: backend,
            json: false
        });
    }

    return ret;
};

// vi:ts=4:et
