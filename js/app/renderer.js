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

'use strict';

var Signals = require('../signals/signals');
var utils = require('../utils/utils');

/**
 * The javascript context.
 *
 * @constructor
 */
function JsContext(gl) {
    /**
     * The webgl context. This is the WebGLRenderingContext obtained
     * from the canvas.
     */
    this.gl = gl;

    /**
     * The models module. This module contains various high-level
     * utilities for creating and working with object models.
     */
    this.models = require('../models/models');

    /**
     * The math module. This module contains basic math types, including
     * vectors, matrices, quaternions and transforms. Note that this
     * module is provided by glMatrix, with a small number of additional
     * types and functions (such as transform).
     */
    this.math = require('../math/math');

    this.ui = require('./ui');

    /**
     * The shared program.
     */
    this.program = {};

    /**
     * A map of program names to compiled GLSL programs.
     */
    this.programs = {};
    this._default_program = null;

    /**
     * A persistent state. You can use this to store and retrieve persistent state
     * between recompilations of your program.
     */
    this.state = {};

    this._signals = new Signals();
    this._signals.on_event = this._signals.register_signal('event');

    this._view = null;
}

/**
 * Get/set the current rendering view.
 *
 * When called without parameters, obtains the current rendering view,
 * otherwise sets it. The view is a model with an associated projection
 * and viewport. See {@link models.View} for more information on
 * constructing a view. All model rendering after setting a view will
 * use that views information to render.
 *
 * @param view the new view to set, or not provided to obtain the current view.
 */
JsContext.prototype.view = function(view) {
    if (typeof view === 'undefined') {
        return this._view;
    }

    if (this._view !== null) {
        this._view.unbind(this);
    }

    this._view = view;
    view.updateViewport(this);

    view.bind(this);
}

JsContext.prototype.requireExtension = function(ext) {
    var e = this.gl.getExtension(ext);

    if (!e) {
        throw new Error('Missing required extension ' + ext);
    }

    return e;
}

JsContext.prototype.requireExtensions = function(exts) {
    var ret = {};

    for (var i = 0; i < exts.length; i++) {
        var e = this.requireExtension(exts[i]);

        ret[exts[i]] = e;
    }

    return ret;
}

JsContext.prototype.getExtension = function(ext) {
    return this.gl.getExtension(ext);
}

JsContext.prototype.getExtensions = function(exts) {
    var ret = {};

    for (var i = 0; i < exts.length; i++) {
        var e = this.gl.getExtension(exts[i]);

        if (e) {
            ret[exts[i]] = e;
        }
    }

    return ret;
}

/**
 * Find a GLSL program by name. If the name is not given, or null, then
 * the default program will be returned.
 *
 * @param name the program name.
 * @returns a program object.
 */
JsContext.prototype.findProgram = function(name) {
    if (!name) {
        return this._default_program;
    }

    if (!(name in this.programs)) {
        return null;
    }

    return this.programs[name];
}

function Renderer(canvas, fullscreenParent, options) {
    Signals.call(this);

    this.options = utils.merge({
        thumbnail_width: 80,
        thumbnail_height: 45
    }, options);

    this.canvas = canvas;
    this._canvasContainer = canvas.parentElement;
    this._canvasParent = this._canvasContainer.parentElement;

    this._fullscreenParent = fullscreenParent;
    this._isFullscreen = false;

    this._hideUi = false;

    this.context = this._create_context();
    this.program = null;
    this._mouse_pressed = false;
    this._frameCounter = 0;

    this._on_notify_first_frame = this.register_signal('notify::first-frame');
    this._on_notify_fullscreen = this.register_signal('notify::fullscreen');

    this._on_error = this.register_signal('error');

    var events = ['mousedown', 'mouseup', 'mousemove', 'keyup', 'keypress', 'wheel'];

    for (var i = 0; i < events.length; i++) {
        canvas.addEventListener(events[i], this._on_pass_event.bind(this));
    }

    canvas.addEventListener('keydown', this._on_keydown.bind(this));

    this._ui = [];
}

Renderer.prototype = Object.create(Signals.prototype);
Renderer.prototype.constructor = Renderer;

Renderer.prototype._on_keydown = function(e) {
    this._event(e);

    if (!e.defaultPrevented) {
        switch (e.keyCode) {
        case 70: // f
            this.toggleFullscreen();
            break;
        case 85: // u
            this.toggleUi();
            break;
        case 27: // escape
            if (this._isFullscreen) {
                this.toggleFullscreen();
            }
            break;
        case 32: // Space
            if (this._anim === 0) {
                this.start();
            } else {
                this.pause();
            }
            break;
        }
    }
}

Renderer.prototype._on_pass_event = function(e) {
    if (e.type === 'mousedown') {
        this._mouse_pressed = true;

        this._on_mousemove = (function(e) {
            this._event(e);

            e.preventDefault();
            e.stopPropagation();
        }).bind(this);

        this._on_mouseup = (function(e) {
            this._event(e);
            this._mouse_pressed = false;

            window.removeEventListener('mousemove', this._on_mousemove);
            window.removeEventListener('mouseup', this._on_mouseup);
        }).bind(this);

        window.addEventListener('mousemove', this._on_mousemove);
        window.addEventListener('mouseup', this._on_mouseup);
    }

    if ((e.type !== 'mousemove' && e.type !== 'mouseup') || !this._mouse_pressed) {
        this._event(e);
    }
}

Renderer.prototype._event = function(e) {
    if (this.program && typeof this.program.event === 'function') {
        try {
            this.program.event.call(this.program, this.context, e);
        } catch (e) {
            this._on_error(e);
            this.pause();
        }
    }

    if (!e.defaultPrevented) {
        this.context._signals.on_event(e);
    }
}

Renderer.prototype._create_context = function() {
    var ret = new JsContext(this.canvas.getContext('webgl'));

    ret.ui.add = this._ui_add.bind(this)
    return ret;
}

Renderer.prototype._removeUi = function(ui) {
    for (var i = 0; i < ui.length; i++) {
        ui[i].e.parentElement.removeChild(ui[i].e);
    }
}

Renderer.prototype.update = function(doc) {
    var complete = true;

    var errors = {
        js: {
            parse: null,
            run: null,
            init: null,
            extensions: null
        },
        programs: null
    };

    var func = null;

    // Compile javascript
    try {
        func = new Function(doc.js.data
                            + '\n\nreturn {init: typeof init !== "undefined" ? init : null'
                            + ', render: typeof render !== "undefined" ? render : null'
                            + ', save: typeof save !== "undefined" ? save : null'
                            + ', event: typeof event !== "undefined" ? event : null'
                            + ', extensions: typeof extensions !== "undefined" ? extensions : null};');
    } catch (e) {
        console.error(e.stack);

        errors.js.parse = e;
        complete = false;
    }

    var state = {};

    if (this.program && this.program.save) {
        try {
            var nstate = this.program.save.call(this.program, this.context);

            if (typeof nstate !== 'undefined') {
                state = nstate;
            }
        } catch (e) {
            console.error(e.stack);
        }
    }

    var nctx = this._create_context();
    nctx.state = state;

    var obj = {};
    var ret = null;

    if (func !== null) {
        try {
            ret = func.call(obj);
        } catch (e) {
            console.error(e.stack);

            errors.js.run = e;
            complete = false;
        }
    }

    if (ret !== null && complete && ret.extensions) {
        try {
            ret.extensions.call(ret, nctx);
        } catch (e) {
            console.error(e.stack);

            errors.js.extensions = e;
            complete = false;
        }
    }

    // Compile all programs
    var programs = {};
    var default_program = null;

    for (var i = 0; i < doc.programs.length; i++) {
        var p = doc.programs[i];

        var prog = p.compile(this.context.gl);

        if (prog.vertex.error !== null || prog.fragment.error !== null || prog.error !== null) {
            if (errors.programs === null) {
                errors.programs = {};
            }

            if (prog.vertex.error !== null) {
                console.error(p.name() + '(vertex): ' + prog.vertex.error);
            }

            if (prog.fragment.error !== null) {
                console.error(p.name() + '(fragment): ' + prog.fragment.error);
            }

            if (prog.error !== null) {
                console.error(p.name() + '(program): ' + prog.error);
            }

            errors.programs[p.name()] = {
                vertex: prog.vertex.error,
                fragment: prog.fragment.error,
                program: prog.error
            };

            complete = false;
        }

        programs[p.name()] = prog;

        if (prog.is_default) {
            default_program = prog;
        }
    }

    var prevUi = this._ui;
    this._ui = [];

    if (ret !== null && complete && ret.init) {
        try {
            ret.init.call(ret, nctx);
        } catch (e) {
            console.error(e.stack);

            errors.js.init = e;
            complete = false;
        }
    }

    if (!complete) {
        this._removeUi(this._ui);
        this._ui = prevUi;
        return errors;
    }

    this._removeUi(prevUi);

    this.context = nctx;
    this.context.programs = programs;
    this.context._default_program = default_program;

    this.program = ret;

    this._frameCounter = 0;
    this.start();
}

Renderer.prototype._extract_ui_ids = function(ui, prefix, ret) {
    if (typeof ui._settings.id !== 'undefined') {
        if (prefix) {
            prefix += '.' + ui._settings.id;
        } else {
            prefix = ui._settings.id;
        }

        ret[prefix] = ui;
    }

    for (var i = 0; i < ui.children.length; i++) {
        this._extract_ui_ids(ui.children[i], prefix, ret);
    }

    return ret;
}

Renderer.prototype._ui_add = function(ui, placement) {
    this._canvasContainer.appendChild(ui.e);
    this._ui.push(ui);

    if (placement) {
        for (var p in placement) {
            var v = placement[p];

            if (typeof v === 'number') {
                v += 'px';
            }

            ui.e.style[p] = v;
        }
    }

    return this._extract_ui_ids(ui, '', {});
}

Renderer.prototype._grab_image = function() {
    var canvas = document.createElement('canvas');

    var r = this.canvas.height / this.canvas.width;

    // Half down sample N times until we reach thumbnail_width
    var pw = this.canvas.width;
    var ph = this.canvas.height;

    var step = 1.8;

    var w = Math.floor(pw / step);
    var h = Math.floor(ph / step);

    var thumbnail = {
        width: this.options.thumbnail_width,
        height: this.options.thumbnail_height
    };

    // Keep aspect ratio
    if (pw > this.options.thumbnail_width / this.options.thumbnail_height * ph) {
        thumbnail.height = (this.options.thumbnail_width / pw) * ph;
    } else {
        thumbnail.width = (this.options.thumbnail_height / ph) * pw;
    }

    canvas.width = Math.max(w, thumbnail.width);
    canvas.height = Math.floor(canvas.width * r);

    var ctx = canvas.getContext('2d');

    var source = this.canvas;
    ctx.globalCompositeOperation = 'copy';

    // Iteratively scale down the original image size by a factor of 2
    // until we reach the desired size. Doing it in one step gives poor
    // results due to the standard (and non-controllable) 2x2 bilinear
    // filter that most browsers use.
    while (true) {
        if (w < thumbnail.width) {
            w = thumbnail.width;
        }

        h = Math.floor(w * r);
        ph = Math.floor(pw * r);

        ctx.drawImage(source, 0, 0, pw, ph, 0, 0, w, h);
        source = canvas;

        if (w === thumbnail.width) {
            break;
        }

        pw = w;
        w = Math.floor(w / step);
    }

    // Set canvas to the correct final size so we can get the data url from it.
    // Note that doing this blanks the canvas, so we first get the image data,
    // then resize the canvas and put back the image data. Finally we can get
    // the correctly sized data URL.
    var img = ctx.getImageData(0, 0, w, Math.floor(w * r));
    canvas.width = w;
    canvas.height = Math.floor(w * r);
    ctx.putImageData(img, 0, 0);

    return canvas.toDataURL();
}

Renderer.prototype.do_render = function(t) {
    this._anim = requestAnimationFrame(this.do_render.bind(this));

    var gl = this.context.gl;

    if (this.program.render) {
        this.context._renderedSomething = false;

        try {
            this.program.render.call(this.program, this.context);
        } catch (e) {
            this._on_error(e);
            console.error(e.stack);
            this.pause();
            return;
        }

        if (this.context._renderedSomething) {
            this._frameCounter++;

            if (this._frameCounter === 1) {
                var dataurl = this._grab_image();
                this._on_notify_first_frame(dataurl);
            }
        }
    }
}

Renderer.prototype.start = function() {
    if (this._anim !== 0) {
        cancelAnimationFrame(this._anim);
        this._anim = 0;
    }

    this._anim = requestAnimationFrame(this.do_render.bind(this));
}

Renderer.prototype.pause = function() {
    if (this._anim !== 0) {
        cancelAnimationFrame(this._anim);
        this._anim = 0;
    }
}

Renderer.prototype.toggleUi = function() {
    if (this._hideUi) {
        this._canvasContainer.classList.remove('hide-ui');
    } else {
        this._canvasContainer.classList.add('hide-ui');
    }

    this._hideUi = !this._hideUi;
}

Renderer.prototype.toggleFullscreen = function() {
    var hasFocus = (document.activeElement === this.canvas);

    this._canvasContainer.parentElement.removeChild(this._canvasContainer);

    if (this._isFullscreen) {
        this._canvasParent.appendChild(this._canvasContainer);
        this._canvasContainer.classList.remove('fullscreen');
    } else {
        this._fullscreenParent.appendChild(this._canvasContainer);
        this._canvasContainer.classList.add('fullscreen');
    }

    if (hasFocus) {
        this.canvas.focus();
    }

    this._isFullscreen = !this._isFullscreen;
    this._on_notify_fullscreen();
}

module.exports = Renderer;

// vi:ts=4:et
