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

function Renderer(canvas) {
    Signals.call(this);

    this.options = utils.merge({
        thumbnail_width: 80
    }, options);

    this.canvas = canvas;
    this.context = this._create_context();
    this.program = null;
    this._mouse_pressed = false;
    this._frameCounter = 0;

    this._on_notify_first_frame = this.register_signal('notify::first-frame');
    this._on_error = this.register_signal('error');

    canvas.addEventListener('mousedown', this._on_mousedown.bind(this));
    canvas.addEventListener('mouseup', this._on_mouseup.bind(this));
    canvas.addEventListener('mousemove', this._on_mousemove.bind(this));
    canvas.addEventListener('keydown', this._on_pass_event.bind(this));
    canvas.addEventListener('keyup', this._on_pass_event.bind(this));
    canvas.addEventListener('keypress', this._on_pass_event.bind(this));
    canvas.addEventListener('scroll', this._on_pass_event.bind(this));
}

Renderer.prototype = Object.create(Signals.prototype);
Renderer.prototype.constructor = Renderer;

Renderer.prototype._on_mousedown = function(e) {
    this._mouse_pressed = true;
    this._event(e);
}

Renderer.prototype._on_mouseup = function(e) {
    this._mouse_pressed = false;
    this._event(e);
}

Renderer.prototype._on_mousemove = function(e) {
    if (this._mouse_pressed) {
        this._event(e);
    }
}

Renderer.prototype._on_pass_event = function(e) {
    this._event(e);
}

Renderer.prototype._event = function(e) {
    if (this.program && this.program.event) {
        try {
            this.program.event.call(this.program, this.context, e);
        } catch (e) {
            this._on_error(e);
            this.pause();
        }
    }
}

Renderer.prototype._create_context = function() {
    return new JsContext(this.canvas.getContext('webgl'));
}

Renderer.prototype.update = function(doc) {
    var complete = true;

    var errors = {
        js: {
            parse: null,
            run: null,
            init: null
        },
        programs: null
    };

    var func = null;

    // Compile javascript
    try {
        func = new Function(doc.js.data + '\n\nreturn {init: init, render: render, save: save, event: event};');
    } catch (e) {
        console.error(e.stack);

        errors.js.parse = e;
        complete = false;
    }

    // Compile all programs
    var programs = {};
    var default_program = null;

    for (var i = 0; i < doc.programs.length; i++) {
        var p = doc.programs[i];

        var prog = p.compile(this.context.gl);

        if (prog.vertex.error !== null || prog.fragment.error !== null) {
            if (errors.programs === null) {
                errors.programs = {};
            }

            errors.programs[p.name()] = {
                vertex: prog.vertex.error,
                fragment: prog.fragment.error
            };

            complete = false;
        }

        programs[p.name()] = prog;

        if (prog.is_default) {
            default_program = prog;
        }
    }

    var obj = {};
    var ret = null;

    var state = {};

    if (this.program && this.program.save) {
        try {
            state = this.program.save.call(this.program, this.context);
        } catch (e) {
            console.error(e.stack);
        }
    }

    if (func !== null) {
        try {
            ret = func.call(obj);
        } catch (e) {
            console.error(e.stack);

            errors.js.run = e;
            complete = false;
        }
    }

    var nctx = this._create_context();
    nctx.state = state;

    if (ret !== null && ret.init) {
        try {
            ret.init.call(ret, nctx);
        } catch (e) {
            console.error(e.stack);

            errors.js.init = e;
            complete = false;
        }
    }

    if (!complete) {
        return errors;
    }

    this.context = nctx;
    this.context.programs = programs;
    this.context._default_program = default_program;

    this.program = ret;

    this._frameCounter = 0;
    this.start();
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

    // Keep aspect ratio
    canvas.width = Math.max(w, this.options.thumbnail_width);
    canvas.height = Math.floor(canvas.width * r);

    var ctx = canvas.getContext('2d');

    var source = this.canvas;
    ctx.globalCompositeOperation = 'copy';

    // Iteratively scale down the original image size by a factor of 2
    // until we reach the desired size. Doing it in one step gives poor
    // results due to the standard (and non-controllable) 2x2 bilinear
    // filter that most browsers use.
    while (true) {
        if (w < this.options.thumbnail_width) {
            w = this.options.thumbnail_width;
        }

        h = Math.floor(w * r);
        ph = Math.floor(pw * r);

        ctx.drawImage(source, 0, 0, pw, ph, 0, 0, w, h);
        source = canvas;

        if (w === this.options.thumbnail_width) {
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

module.exports = Renderer;

// vi:ts=4:et
