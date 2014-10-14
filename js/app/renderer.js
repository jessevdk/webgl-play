var Signals = require('../signals/signals');

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
     * The currently compiled and running js program. This evaluates to the same
     * value as 'this'.
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

    this._view = view;
    view.updateViewport(this);

    view.bind(this);
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

    this.canvas = canvas;
    this.context = this._create_context();
    this._first_frame = false;

    this._on_notify_first_frame = this.register_signal('notify::first-frame');
}

Renderer.prototype = Object.create(Signals.prototype);
Renderer.prototype.constructor = Renderer;

Renderer.prototype._create_context = function() {
    return new JsContext(this.canvas.getContext('webgl', {preserveDrawingBuffer: true}));
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
        func = new Function(doc.js.data + '\n\nreturn {init: init, render: render};');
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
    nctx.state = this.context.state;

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

    this._first_frame = true;
    this.start();
}

Renderer.prototype.do_render = function(t) {
    this._anim = requestAnimationFrame(this.do_render.bind(this));

    var gl = this.context.gl;

    if (this.program.render) {
        try {
            this.program.render.call(this.program, this.context);
        } catch (e) {
            console.error(e.stack);
            this.pause();
            return;
        }

        if (this._first_frame) {
            var dataurl = this.canvas.toDataURL();
            this._first_frame = false;

            this._on_notify_first_frame(dataurl);
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
