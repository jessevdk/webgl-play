function JsContext(gl) {
    this.gl = gl;
    this.models = require('./models');
    this.math = require('./math');
    this.program = {};
    this.state = {};
}

JsContext.prototype.view = function(view) {
    if (typeof view === 'undefined') {
        return this._view;
    }

    this._view = view;
    view.updateViewport(this);

    view.bind(this);
}

JsContext.prototype.findProgram = function(name) {
    if (!name) {
        name = 'default';
    }

    if (!(name in this.programs)) {
        return null;
    }

    return this.programs[name];
}

function Renderer(canvas) {
    this.canvas = canvas;
    this.context = this._create_context();
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
        func = new Function(doc.js.data + '\n\nreturn {init: init, render: render};');
    } catch (e) {
        console.error(e.stack);

        errors.js.parse = e;
        complete = false;
    }

    // Compile all programs
    var programs = {};

    for (var i = 0; i < doc.programs.length; i++) {
        var p = doc.programs[i];

        var prog = p.compile(this.context.gl);

        if (prog.vertex.error !== null || prog.fragment.error !== null) {
            if (errors.programs === null) {
                errors.programs = {};
            }

            errors.programs[p.name] = {
                vertex: prog.vertex.error,
                fragment: prog.fragment.error
            };

            complete = false;
        }

        programs[p.name] = prog;
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

    this.program = ret;
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
