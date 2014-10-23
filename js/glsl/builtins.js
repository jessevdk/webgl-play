'use strict';

var glsl = {
    source: require('./source'),
    ast: require('./ast'),
    tokenizer: require('./tokenizer'),
};

var Tn = glsl.tokenizer.Tokenizer;
var dtn = new Tn(null);

function TypeClass(name) {
    glsl.ast.Node.call(this);
    this.incomplete = false;

    this.name = name;

    this.is_primitive = false;
    this.is_array = false;
    this.is_composite = false;
    this.is_user = false;

    this.decl = null;
}

TypeClass.prototype = glsl.ast.Node.create('TypeClass', TypeClass);
exports.TypeClass = TypeClass;


function CompositeType(name) {
    TypeClass.call(this, name);

    this.field_map = {};
    this.fields = [];
    this.is_composite = true;
    this.has_array_field = false;
    this.has_sampler_field = false;

    this.zero = {};
}

CompositeType.prototype = glsl.ast.Node.create('builtins.CompositeType', CompositeType, TypeClass);
exports.CompositeType = CompositeType;

CompositeType.prototype.declare_field = function(name, type) {
    var field = {
        name: name,
        type: type,
        decl: null
    };

    if (type.is_array || (type.is_composite && type.has_array_field)) {
        this.has_array_field = true;
    }

    if (type.is_sampler || (type.is_composite && type.has_sampler_field)) {
        this.has_sampler_field = true;
    }

    this.fields.push(field);
    this.field_map[name] = field;

    this.zero[name] = type.zero;
    return field;
};


function UserType(name, decl) {
    CompositeType.call(this, name);

    this.decl = decl;
    this.is_user = true;
}

UserType.prototype = glsl.ast.Node.create('builtins.UserType', UserType, CompositeType);
exports.UserType = UserType;


function ArrayType(element_type, length) {
    TypeClass.call(this, element_type.name + '[' + length + ']');

    this.element_type = element_type;
    this.length = length;

    this.zero = [];

    for (var i = 0; i < length; i++) {
        this.zero.push(element_type.zero);
    }

    this.is_array = true;
}

ArrayType.prototype = glsl.ast.Node.create('builtins.ArrayType', ArrayType, TypeClass);
exports.ArrayType = ArrayType;


function PrimitiveType(id, zero) {
    TypeClass.call(this, dtn.token_name(id));

    this.id = id;
    this.zero = zero;

    this.is_scalar = PrimitiveType._is_scalar(id);
    this.is_vec = PrimitiveType._is_vec(id);
    this.is_mat = PrimitiveType._is_mat(id);
    this.is_sampler = PrimitiveType._is_sampler(id);

    this.element_type = PrimitiveType._element_type(id);
    this.is_int = (this.element_type == Tn.T_INT);
    this.is_float = (this.element_type == Tn.T_FLOAT);
    this.is_bool = (this.element_type == Tn.T_BOOL);

    this.is_primitive = true;

    this.length = PrimitiveType._length(id);
}

PrimitiveType.prototype = glsl.ast.Node.create('builtins.PrimitiveType', PrimitiveType, TypeClass);
exports.PrimitiveType = PrimitiveType;

PrimitiveType.prototype.marshal_can_ref = function() {
    return false;
};

PrimitiveType.prototype.marshal = function() {
    return '$' + this.name;
};

PrimitiveType._is_vec = function(tok) {
    switch (tok) {
    case Tn.T_VEC2:
    case Tn.T_VEC3:
    case Tn.T_VEC4:
    case Tn.T_BVEC2:
    case Tn.T_BVEC3:
    case Tn.T_BVEC4:
    case Tn.T_IVEC2:
    case Tn.T_IVEC3:
    case Tn.T_IVEC4:
        return true;
    }

    return false;
};

PrimitiveType._is_sampler = function(tok) {
    switch (tok) {
    case Tn.T_SAMPLER2D:
    case Tn.T_SAMPLERCUBE:
        return true;
    }

    return false;
};

PrimitiveType._is_mat = function(tok) {
    switch (tok) {
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
        return true;
    }

    return false;
};

PrimitiveType._is_scalar = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
        return true;
    }

    return false;
};

PrimitiveType._element_type = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_VEC2:
    case Tn.T_VEC3:
    case Tn.T_VEC4:
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
        return Tn.T_FLOAT;
    case Tn.T_INT:
    case Tn.T_IVEC2:
    case Tn.T_IVEC3:
    case Tn.T_IVEC4:
        return Tn.T_INT;
    case Tn.T_BOOL:
    case Tn.T_BVEC2:
    case Tn.T_BVEC3:
    case Tn.T_BVEC4:
        return Tn.T_BOOL;

    }

    return null;
};

PrimitiveType._length = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
        return 1;
    case Tn.T_VEC2:
    case Tn.T_IVEC2:
    case Tn.T_BVEC2:
    case Tn.T_MAT2:
        return 2;
    case Tn.T_VEC3:
    case Tn.T_IVEC3:
    case Tn.T_BVEC3:
    case Tn.T_MAT3:
        return 3;
    case Tn.T_VEC4:
    case Tn.T_IVEC4:
    case Tn.T_BVEC4:
    case Tn.T_MAT4:
        return 4;
    }

    return 0;
};

function Operator(op) {
    this.op = op;
    this.ret = null;
    this.lhs = null;
    this.rhs = null;
}

Operator.prototype._evaluate_elem = function(a, b) {
    switch (this.op) {
    case Tn.T_PLUS:
        return a + b;
    case Tn.T_DASH:
        return a - b;
    case Tn.T_STAR:
        return a * b;
    case Tn.T_SLASH:
        return a / b;
    case Tn.T_LEFT_ANGLE:
        return a < b;
    case Tn.T_RIGHT_ANGLE:
        return a > b;
    case Tn.T_LE_OP:
        return a <= b;
    case Tn.T_GE_OP:
        return a >= b;
    case Tn.T_EQ_OP:
        return a == b;
    case Tn.T_NE_OP:
        return a != b;
    case Tn.T_AND_OP:
        return a && b;
    case Tn.T_OR_OP:
        return a || b;
    case Tn.T_XOR_OP:
        return (a && !b) || (b && !a);
    }
};

Operator.prototype.evaluate = function(a, b) {
    if (this.op == Tn.T_STAR) {
        if (this.lhs.is_vec && this.rhs.is_mat) {
            var ret = [];

            for (var i = 0; i < this.lhs.length; i++) {
                var s = 0;

                for (var j = 0; j < this.lhs.length; j++) {
                    s += a[j] * b[i][j];
                }

                ret.push(s);
            }

            return ret;
        } else if (this.lhs.is_mat && this.rhs.is_vec) {
            var ret = [];

            for (var i = 0; i < this.lhs.length; i++) {
                var s = 0;

                for (var j = 0; j < this.lhs.length; j++) {
                    s += a[j][i] * b[j];
                }

                ret.push(s);
            }

            return ret;
        }
    }

    if (this.lhs.is_vec || this.rhs.is_vec) {
        var ret = [];
        var l = (this.lhs.is_vec ? this.lhs.length : this.rhs.length);

        for (var i = 0; i < l; i++) {
            ret.push(this._evaluate_elem(this.lhs.is_vec ? a[i] : a, this.rhs.is_vec ? b[i] : b));
        }

        return ret;
    } else if (this.lhs.is_mat || this.rhs.is_mat) {
        var ret = [];
        var l = (this.lhs.is_mat ? this.lhs.length : this.rhs.length);

        for (var i = 0; i < l; i++) {
            for (var j = 0; j < l; j++) {
                ret.push(this._evaluate_elem(this.lhs.is_mat ? a[i][j] : a, this.rhs.is_mat ? b[i][j] : b));
            }
        }

        return ret;
    } else {
        return this._evaluate_elem(a, b);
    }
};

function UnaryOperator(op) {
    this.op = op;
    this.ret = null;
    this.expr = null;
}

UnaryOperator.prototype.evaluate = function(a) {
    switch (this.op) {
    case Tn.T_BANG:
        return !a;
    case Tn.T_DASH:
        return -a;
    case Tn.T_INC_OP:
        return a + 1;
    case Tn.T_DEC_OP:
        return a - 1;
    }
};

function Builtins(type, options) {
    this.type = type;

    if (typeof options === 'undefined') {
        options = {};
    }

    this._options = options;

    this.types = [];
    this.type_map = {};

    this.variables = [];
    this.variable_map = {};

    this.functions = [];
    this.function_map = {};

    this.operators = [];
    this.operator_map = {};

    this.precisions = [];
    this.precision_map = {};

    this._define_types();
    this._define_constants();
    this._define_variables();
    this._define_functions();
    this._define_operators();
    this._define_precisions();
}

exports.Builtins = Builtins;

Builtins.create_for_context = function(ctx, type) {
    return new Builtins(type, Builtins.options_from_context(ctx));
};

Builtins.options_from_context = function(ctx) {
    var constants = {};

    if (ctx !== null) {
        var c = {
            'gl_MaxVertexAttribs': 'MAX_VERTEX_ATTRIBS',
            'gl_MaxVertexUniformVectors': 'MAX_VERTEX_UNIFORM_VECTORS',
            'gl_MaxVaryingVectors': 'MAX_VARYING_VECTORS',
            'gl_MaxVertexTextureImageUnits': 'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
            'gl_MaxCombinedTextureImageUnits': 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
            'gl_MaxTextureImageUnits': 'MAX_TEXTURE_IMAGE_UNITS',
            'gl_MaxFragmentUniformVectors': 'MAX_FRAGMENT_UNIFORM_VECTORS',
            'gl_MaxDrawBuffers': 1
        };

        for (var name in c) {
            var cval = c[name];

            if (typeof cval !== 'string') {
                constants[name] = cval;
            } else if (typeof ctx[cval] !== 'undefined') {
                constants[name] = ctx.getParameter(ctx[cval]);
            }
        }

        var drawbuffers_ext = ctx.getExtension('WEBGL_draw_buffers');

        if (drawbuffers_ext !== null) {
            constants['gl_MaxDrawBuffers'] = ctx.getParameter(drawbuffers_ext.MAX_DRAW_BUFFERS_WEBGL);
        } else {
            constants['gl_MaxDrawBuffers'] = 1;
        }
    }

    var ret = {
        constants: constants
    };

    var exts = ctx.getSupportedExtensions();

    if (exts.indexOf('OES_standard_derivatives') !== -1) {
        ret.derivatives = true;
    }

    return ret;
};

Builtins.prototype._define_types = function() {
    var btypetoks = [
        [Tn.T_VOID, 0],
        [Tn.T_FLOAT, 0.0],
        [Tn.T_INT, 0],
        [Tn.T_BOOL, false],

        [Tn.T_VEC2, [0.0, 0.0]],
        [Tn.T_VEC3, [0.0, 0.0, 0.0]],
        [Tn.T_VEC4, [0.0, 0.0, 0.0, 0.0]],

        [Tn.T_BVEC2, [false, false]],
        [Tn.T_BVEC3, [false, false, false]],
        [Tn.T_BVEC4, [false, false, false, false]],

        [Tn.T_IVEC2, [0, 0]],
        [Tn.T_IVEC3, [0, 0, 0]],
        [Tn.T_IVEC4, [0, 0, 0, 0]],

        [Tn.T_MAT2, [[0, 0], [0, 0]]],
        [Tn.T_MAT3, [[0, 0, 0], [0, 0, 0], [0, 0, 0]]],
        [Tn.T_MAT4, [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]],

        [Tn.T_SAMPLER2D, 0],
        [Tn.T_SAMPLERCUBE, 0]
    ];

    for (var i = 0; i < btypetoks.length; i++) {
        var tokid = btypetoks[i][0];
        var zero = btypetoks[i][1];

        var name = dtn.token_name(tokid);

        var bloc = new glsl.source.BuiltinRange();
        var tok = dtn.create_token(tokid, name, bloc);

        var decl = new glsl.ast.TypeDecl((new glsl.ast.TypeRef(tok)).complete());
        decl.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);
        decl.incomplete = false;

        decl.type.t = {
            type: new PrimitiveType(tokid, zero)
        };

        this.types.push(decl);
        this.type_map[tokid] = decl;

        name = name[0].toUpperCase() + name.slice(1);

        this[name] = decl.type.t.type;
    }
};

Builtins.prototype._declare_variable = function(qualifiers, typeid, name, arsize, defintval) {
    var type = this.type_map[typeid];
    var bloc = new glsl.source.BuiltinRange();

    var tp = new glsl.ast.TypeRef(dtn.create_token(typeid, dtn.token_name(typeid), bloc));
    tp.complete();

    for (var i = 0; i < qualifiers.length; i++) {
        var q = qualifiers[i];

        tp.qualifiers.push(dtn.create_token(q, dtn.token_name(q), bloc));
    }

    tp.t = {
        type: type.type.t.type
    };

    var decl = new glsl.ast.VariableDecl(tp);

    var n = new glsl.ast.Named(dtn.create_token(Tn.T_IDENTIFIER, name, bloc), decl);

    n.type = tp;

    n.t = {
        type: n.type.t.type,
    };

    var Int = this.type_map[Tn.T_INT].type.t.type;

    if (typeof arsize !== 'undefined' && arsize !== null) {
        n.is_array = true;
        n.left_bracket = dtn.create_token(Tn.T_LEFT_BRACKET, dtn.token_name(Tn.T_LEFT_BRACKET), bloc);
        n.right_bracket = dtn.create_token(Tn.T_RIGHT_BRACKET, dtn.token_name(Tn.T_RIGHT_BRACKET), bloc);

        if (typeof arsize === 'string') {
            var expr = new glsl.ast.VariableExpr(dtn.create_token(Tn.T_IDENTIFIER, arsize, bloc));
            expr.complete();

            var c = this.variable_map[arsize];

            expr.t = {
                decl: c,
                type: c.names[0].t.type,
                is_const_expression: true,
                const_value: c.names[0].t.const_value
            };

            n.array_size = expr;
        } else {
            var tok = dtn.create_token(Tn.T_INTCONSTANT, "" + arsize, bloc);
            tok.value = arsize;

            n.array_size = new glsl.ast.ConstantExpr(tok);
            n.array_size.complete();

            n.array_size.t = {
                type: Int,
                is_const_expression: true,
                const_value: arsize
            };
        }
    }

    if (typeof defintval !== 'undefined' && defintval !== null) {
        if (typeof this._options.constants !== 'undefined' && name in this._options.constants) {
            defintval = this._options.constants[name];
        }

        n.initial_assign = dtn.create_token(Tn.T_EQUAL, dtn.token_name(Tn.T_EQUAL), bloc);

        var tok = dtn.create_token(Tn.T_INTCONSTANT, "" + defintval, bloc);
        tok.value = defintval;

        n.initial_value = new glsl.ast.ConstantExpr(tok);
        n.initial_value.complete();
        n.initial_value.t = {
            type: Int,
            is_const_expression: true,
            const_value: defintval
        };

        n.t.is_const_expression = true;
        n.t.const_value = defintval;
    }

    n.complete();

    decl.names.push(n);
    decl.complete();

    decl.t = {
        type: tp.t.type
    };

    this.variables.push(decl);
    this.variable_map[name] = decl;
};

Builtins.prototype._define_constants = function() {
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexAttribs', null, 8);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexUniformVectors', null, 128);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVaryingVectors', null, 8);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexTextureImageUnits', null, 0);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxCombinedTextureImageUnits', null, 8);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxTextureImageUnits', null, 8);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxFragmentUniformVectors', null, 16);
    this._declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxDrawBuffers', null, 1);
};

Builtins.prototype._define_variables = function() {
    switch (this.type) {
    case glsl.source.VERTEX:
        this._declare_variable([Tn.T_HIGHP], Tn.T_VEC4, 'gl_Position');
        this._declare_variable([Tn.T_MEDIUMP], Tn.T_FLOAT, 'gl_PointSize');
        break;
    case glsl.source.FRAGMENT:
        this._declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragCoord');
        this._declare_variable([], Tn.T_BOOL, 'gl_FrontFacing');
        this._declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragColor');
        this._declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragData', 'gl_MaxDrawBuffers');
        this._declare_variable([Tn.T_MEDIUMP], Tn.T_VEC2, 'gl_PointCoord');
        break;
    }
};

Builtins.prototype._declare_precision = function(precision, typeid) {
    var bloc = new glsl.source.BuiltinRange();
    var type = this.type_map[typeid];

    var prec = new glsl.ast.PrecisionStmt(dtn.create_token(Tn.T_PRECISION, dtn.token_name(Tn.T_PRECISION), bloc));

    prec.qualifier = dtn.create_token(precision, dtn.token_name(precision), bloc);

    var tp = new glsl.ast.TypeRef(dtn.create_token(typeid, dtn.token_name(typeid), bloc));
    tp.complete();

    tp.t = {
        type: type.type.t.type
    };

    prec.type = tp;
    prec.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);

    this.precisions.push(prec);
    this.precision_map[type.name] = prec;
}

Builtins.prototype._define_precisions = function() {
    switch (this.type) {
    case glsl.source.VERTEX:
        this._declare_precision(Tn.T_HIGHP, Tn.T_FLOAT);
        this._declare_precision(Tn.T_HIGHP, Tn.T_INT);
        this._declare_precision(Tn.T_LOWP, Tn.T_SAMPLER2D);
        this._declare_precision(Tn.T_LOWP, Tn.T_SAMPLERCUBE);
        break;
    case glsl.source.FRAGMENT:
        this._declare_precision(Tn.T_MEDIUMP, Tn.T_INT);
        this._declare_precision(Tn.T_LOWP, Tn.T_SAMPLER2D);
        this._declare_precision(Tn.T_LOWP, Tn.T_SAMPLERCUBE);
        break;
    }
}

Builtins.prototype._elem_evaluator = function() {
    var l = 0;

    for (var i = 0; i < arguments.length; i++) {
        if (Array.prototype.isPrototypeOf(arguments[i])) {
            l = arguments[i].length;
            break;
        }
    }

    if (l === 0) {
        return this.apply(this, arguments);
    } else {
        var ret = [];

        for (var i = 0; i < l; i++) {
            var args = [];

            for (var j = 0; j < arguments.length; j++) {
                var arg = arguments[j];

                if (Array.prototype.isPrototypeOf(arg)) {
                    args.push(arg[i]);
                } else {
                    args.push(arg);
                }
            }

            ret.push(this.apply(this, args));
        }

        return ret;
    }
};

Builtins.prototype._func_evaluator = function() {
    var args = [];

    for (var i = 0; i < arguments.length; i++) {
        if (!Array.prototype.isPrototypeOf(arguments[i])) {
            args.push([arguments[i]]);
        } else {
            args.push(arguments[i]);
        }
    }

    return this.apply(this, args);
};

Builtins.prototype._define_builtin_function = function(rettype, name, params, elemfunc, func) {
    if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(rettype)) {
        rettype = this.type_map[rettype];
    }

    var sp = params.slice();

    for (var i = 0; i < sp.length; i += 2) {
        var p = sp[i];

        if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(p)) {
            sp[i] = this.type_map[p];
        }
    }

    var bloc = new glsl.source.BuiltinRange();

    var type = new glsl.ast.TypeRef(dtn.create_token(rettype.type.token.id, dtn.token_name(rettype.type.token.id), bloc));
    type.incomplete = false;

    type.t = {
        type: rettype.type.t.type
    };

    var name = dtn.create_token(Tn.T_IDENTIFIER, name, bloc);

    var header = new glsl.ast.FunctionHeader(type, name);
    header.left_paren = dtn.create_token(Tn.T_LEFT_PAREN, '(', bloc);
    header.right_paren = dtn.create_token(Tn.T_RIGHT_PAREN, ')', bloc);

    header.incomplete = false;

    for (var i = 0; i < sp.length; i += 2) {
        var p = sp[i];

        var decl = (new glsl.ast.ParamDecl()).complete();

        decl.type = p.type;
        decl.name = dtn.create_token(Tn.T_IDENTIFIER, sp[i + 1], bloc);

        header.parameters.push(decl);
    }

    var sig = header.signature();

    if (sig in this.function_map) {
        return;
    }

    var f = new glsl.ast.FunctionProto(header);

    f.is_builtin = true;
    f.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);
    f.incomplete = false;

    if (elemfunc) {
        f.evaluate = this._elem_evaluator.bind(elemfunc);
    } else if (func) {
        f.evaluate = this._func_evaluator.bind(func);
    } else {
        f.evaluate = null;
    }

    this.functions.push(f);
    this.function_map[sig] = f;

    return f;
};

Builtins.prototype._define_builtin_function_gen = function(gentypes, rettype, name, params, elemfunc, func) {
    if (rettype !== null) {
        rettype = this.type_map[rettype];
    }

    for (var i = 0; i < gentypes.length; i++) {
        var g = this.type_map[gentypes[i]];
        var sp = params.slice();

        for (var j = 0; j < sp.length; j += 2) {
            var item = sp[j];

            if (item === null) {
                sp[j] = g;
            } else {
                sp[j] = this.type_map[item];
            }
        }

        this._define_builtin_function(rettype !== null ? rettype : g,
                                      name,
                                      sp,
                                      elemfunc,
                                      func);
    }
};

Builtins.prototype._define_builtin_gentype_function = function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];

    this._define_builtin_function_gen(gentypes, rettype, name, params, elemfunc, func);
};

Builtins.prototype._define_builtin_mat_function = function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4];

    this._define_builtin_function_gen(gentypes, rettype, name, params, elemfunc, func);
};

Builtins.prototype._define_builtin_relvec_function = function(rettype, name, params, elemfunc, func) {
    var vmap = {
        'bvec': [Tn.T_BVEC2, Tn.T_BVEC3, Tn.T_BVEC4],
        'vec':  [Tn.T_VEC2,  Tn.T_VEC3,  Tn.T_VEC4],
        'ivec': [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]
    };

    for (var i = 0; i < 3; i++) {
        var ret = rettype;

        if (rettype in vmap) {
            ret = vmap[rettype][i];
        }

        var sp = params.slice();

        for (var j = 0; j < sp.length; j += 2) {
            var p = sp[j];

            if (p in vmap) {
                sp[j] = vmap[p][i];
            }
        }

        this._define_builtin_function(ret, name, sp, elemfunc, func);
    }
};

Builtins.prototype._find_type = function(t, def) {
    if (t === null) {
        t = def;
    }

    return this.type_map[t].type.t.type;
};

Builtins.prototype._define_builtin_bin_operator_gen = function(rettype, optypes, lhs, rhs, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new Operator(op);
            o.ret = this._find_type(rettype, g);
            o.lhs = this._find_type(lhs, g);
            o.rhs = this._find_type(rhs, g);

            var sig = dtn.token_name(op) + '(' + o.lhs.name + ',' + o.rhs.name + ')';

            this.operators.push(o);
            this.operator_map[sig] = o;
        }
    }
};

Builtins.prototype._define_builtin_unary_operator_gen = function(rettype, optypes, expr, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new UnaryOperator(op);
            o.ret = this._find_type(rettype, g);
            o.expr = this._find_type(expr, g);

            var sig = dtn.token_name(op) + '(' + o.expr.name + ')';

            this.operators.push(o);
            this.operator_map[sig] = o;
        }
    }
};

var Emulate = {
    radians: function (degrees) {
        return degrees / 180.0 * Math.PI;
    },

    degrees: function (radians) {
        return radians / Math.PI * 180.0;
    },

    exp2: function (x) {
        return Math.pow(2, x);
    },

    log2: function (x) {
        return Math.log(x) / Math.log(2);
    },

    inversesqrt: function (x) {
        return 1 / Math.sqrt(x);
    },

    sign: function (x) {
        return x < 0 ? -1 : (x > 0 ? 1 : 0);
    },

    fract: function (x) {
        return x - Math.floor(x);
    },

    mod: function (x, y) {
        return x - y * Math.floor(x / y);
    },

    clamp: function (x, minVal, maxVal) {
        return Math.min(Math.max(x, minVal), maxVal);
    },

    mix: function (x, y, a) {
        return x * (1 - a) + y * a;
    },

    smoothstep: function (edge0, edge1, x) {
        if (x < edge0) {
            return 0;
        } else if (x > edge1) {
            return 1;
        } else {
            var n = (x - edge0) / (edge1 - edge0);
            return n * n * (3 - 2 * n);
        }
    },

    step: function (edge, x) {
        return x < edge ? 0 : 1;
    },

    length: function(x) {
        var s = 0;

        for (var i = 0; i < x.length; i++) {
            s += x[i] * x[i];
        }

        return Math.sqrt(s);
    },

    distance: function(p0, p1) {
        var s = 0;

        for (var i = 0; i < p0.length; i++) {
            var d = p0[i] - p1[i];
            s += d * d;
        }

        return Math.sqrt(s);
    },

    dot: function(x, y) {
        var s = 0;

        for (var i = 0; i < x.length; i++) {
            s += x[i] * y[i];
        }

        return s;
    },

    cross: function(x, y) {
        return [
            x[1] * y[2] - y[1] * x[2],
            x[2] * y[0] - y[2] * x[0],
            x[0] * y[1] - y[0] * x[1]
        ];
    },

    normalize: function(x) {
        var s = [];
        var l = Emulate.length(x);

        for (var i = 0; i < x.length; i++) {
            s.push(x[i] / l);
        }

        return s;
    },

    faceforward: function(N, I, Nref) {
        var s = [];

        var isit = Emulate.dot(Nref, I);

        for (var i = 0; i < N.length; i++) {
            s.push(isit ? N[i] : -N[i]);
        }

        return s;
    },

    reflect: function(I, N) {
        var d = Emulate.dot(N, I);
        var s = [];

        for (var i = 0; i < I.length; i++) {
            s.push(I[i] - 2 * d * N[i]);
        }

        return s;
    },

    refract: function(I, N, eta) {
        eta = eta[0];

        var d = Emulate.dot(N, I);
        var k = 1 - eta * eta * (1 - d * d);
        var s = [];
        var sk = 0;

        if (k >= 0) {
            sk = eta * d + Math.sqrt(k);
        }

        for (var i = 0; i < I.length; i++) {
            if (k < 0) {
                s.push(0);
            } else {
                s.push(eta * I[i] - sk * N[i]);
            }
        }

        return s;
    },

    matrixCompMult: function(x, y) {
        return x * y;
    },

    lessThan: function(x, y) {
        return x < y;
    },

    lessThanEqual: function(x, y) {
        return x <= y;
    },

    greaterThan: function(x, y) {
        return x > y;
    },

    greaterThanEqual: function(x, y) {
        return x < y;
    },

    equal: function(x, y) {
        return x == y;
    },

    notEqual: function(x, y) {
        return x != y;
    },

    any: function(x) {
        for (var i = 0; i < x.length; i++) {
            if (x[i]) {
                return true;
            }
        }

        return false;
    },

    all: function(x) {
        for (var i = 0; i < x.length; i++) {
            if (!x[i]) {
                return false;
            }
        }

        return true;
    },

    not: function(x) {
        return !x;
    },
};

Builtins.prototype._define_functions = function() {
    this._define_builtin_function(Tn.T_VOID, 'main', []);

    // Angle and Trigonometry functions
    this._define_builtin_gentype_function(null, 'radians', [null, 'degrees'], Emulate.radians);
    this._define_builtin_gentype_function(null, 'degrees', [null, 'radians'], Emulate.degrees);

    this._define_builtin_gentype_function(null, 'sin', [null, 'angle'], Math.sin);
    this._define_builtin_gentype_function(null, 'cos', [null, 'angle'], Math.cos);
    this._define_builtin_gentype_function(null, 'tan', [null, 'angle'], Math.tan);

    this._define_builtin_gentype_function(null, 'asin', [null, 'x'], Math.asin);
    this._define_builtin_gentype_function(null, 'acos', [null, 'x'], Math.acos);
    this._define_builtin_gentype_function(null, 'atan', [null, 'y', null, 'x'], Math.atan2);
    this._define_builtin_gentype_function(null, 'atan', [null, 'y_over_x'], Math.atan);

    // Exponential Functions
    this._define_builtin_gentype_function(null, 'pow', [null, 'x', null, 'y'], Math.pow);
    this._define_builtin_gentype_function(null, 'exp', [null, 'x'], Math.exp);
    this._define_builtin_gentype_function(null, 'log', [null, 'x'], Math.log);
    this._define_builtin_gentype_function(null, 'exp2', [null, 'x'], Emulate.exp2);
    this._define_builtin_gentype_function(null, 'log2', [null, 'x'], Emulate.log2);
    this._define_builtin_gentype_function(null, 'sqrt', [null, 'x'], Math.sqrt);
    this._define_builtin_gentype_function(null, 'inversesqrt', [null, 'x'], Emulate.inversesqrt);

    // Common Functions
    this._define_builtin_gentype_function(null, 'abs', [null, 'x'], Math.abs);
    this._define_builtin_gentype_function(null, 'sign', [null, 'x'], Emulate.sign);
    this._define_builtin_gentype_function(null, 'floor', [null, 'x'], Math.floor);
    this._define_builtin_gentype_function(null, 'ceil', [null, 'x'], Math.ceil);
    this._define_builtin_gentype_function(null, 'fract', [null, 'x'], Emulate.fract);
    this._define_builtin_gentype_function(null, 'mod', [null, 'x', null, 'y'], Emulate.mod);
    this._define_builtin_gentype_function(null, 'min', [null, 'x', null, 'y'], Math.min);
    this._define_builtin_gentype_function(null, 'min', [null, 'x', Tn.T_FLOAT, 'y'], Math.min);
    this._define_builtin_gentype_function(null, 'max', [null, 'x', null, 'y'], Math.max);
    this._define_builtin_gentype_function(null, 'max', [null, 'x', Tn.T_FLOAT, 'y'], Math.max);
    this._define_builtin_gentype_function(null, 'clamp', [null, 'x', null, 'minVal', null, 'maxVal'], Emulate.clamp);
    this._define_builtin_gentype_function(null, 'clamp', [null, 'x', Tn.T_FLOAT, 'minVal', Tn.T_FLOAT, 'maxVal'], Emulate.clamp);
    this._define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', null, 'a'], Emulate.mix);
    this._define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', Tn.T_FLOAT, 'a'], Emulate.mix);
    this._define_builtin_gentype_function(null, 'step', [null, 'edge', null, 'x'], Emulate.step);
    this._define_builtin_gentype_function(null, 'step', [Tn.T_FLOAT, 'edge', null, 'x'], Emulate.step);
    this._define_builtin_gentype_function(null, 'smoothstep', [null, 'edge0', null, 'edge1', null, 'x'], Emulate.smoothstep);
    this._define_builtin_gentype_function(null, 'smoothstep', [Tn.T_FLOAT, 'edge0', Tn.T_FLOAT, 'edge1', null, 'x'], Emulate.smootstep);

    // Geometric Functions
    this._define_builtin_gentype_function(Tn.T_FLOAT, 'length',
                                          [null, 'x'], null, Emulate.length);

    this._define_builtin_gentype_function(Tn.T_FLOAT, 'distance',
                                          [null, 'p0', null, 'p1'], null, Emulate.distance);

    this._define_builtin_gentype_function(Tn.T_FLOAT, 'dot',
                                          [null, 'x', null, 'y'], null, Emulate.dot);

    this._define_builtin_function(Tn.T_VEC3, 'cross',
                                  [Tn.T_VEC3, 'x', Tn.T_VEC3, 'y'], null, Emulate.cross);

    this._define_builtin_gentype_function(null, 'normalize',
                                          [null, 'x'], null, Emulate.normalize);

    this._define_builtin_gentype_function(null, 'faceforward',
                                          [null, 'N', null, 'I', null, 'Nref'], null, Emulate.faceforward);

    this._define_builtin_gentype_function(null, 'reflect',
                                          [null, 'I', null, 'N'], null, Emulate.reflect);

    this._define_builtin_gentype_function(null, 'refract',
                                          [null, 'I', null, 'N', Tn.T_FLOAT, 'eta'], null, Emulate.refract);

    // Matrix Functions
    this._define_builtin_mat_function(null, 'matrixCompMult', [null, 'x', null, 'y'], Emulate.matrixCompMult);

    // Vector Relational Functions
    this._define_builtin_relvec_function('bvec', 'lessThan',
                                         ['vec', 'x', 'vec', 'y'], Emulate.lessThan);

    this._define_builtin_relvec_function('bvec', 'lessThan',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.lessThan);

    this._define_builtin_relvec_function('bvec', 'lessThanEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.lessThanEqual);

    this._define_builtin_relvec_function('bvec', 'lessThanEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.lessThanEqual);

    this._define_builtin_relvec_function('bvec', 'greaterThan',
                                         ['vec', 'x', 'vec', 'y'], Emulate.greaterThan);
    this._define_builtin_relvec_function('bvec', 'greaterThan',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThan);

    this._define_builtin_relvec_function('bvec', 'greaterThanEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.greaterThanEqual);

    this._define_builtin_relvec_function('bvec', 'greaterThanEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThanEqual);

    this._define_builtin_relvec_function('bvec', 'equal',
                                         ['vec', 'x', 'vec', 'y'], Emulate.equal);

    this._define_builtin_relvec_function('bvec', 'equal',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.equal);

    this._define_builtin_relvec_function('bvec', 'notEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.notEqual);

    this._define_builtin_relvec_function('bvec', 'notEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.notEqual);

    this._define_builtin_relvec_function('bvec', 'notEqual',
                                         ['bvec', 'x', 'bvec', 'y'], Emulate.notEqual);

    this._define_builtin_relvec_function(Tn.T_BOOL, 'any',
                                         ['bvec', 'x'], null, Emulate.any);

    this._define_builtin_relvec_function(Tn.T_BOOL, 'all',
                                         ['bvec', 'x'], null, Emulate.all);

    this._define_builtin_relvec_function('bvec', 'not',
                                         ['bvec', 'x'], Emulate.not);

    // Texture Lookup Functions
    this._define_builtin_function(Tn.T_VEC4, 'texture2D',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord']);

    this._define_builtin_function(Tn.T_VEC4, 'texture2D',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'bias']);

    this._define_builtin_function(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord']);

    this._define_builtin_function(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);

    this._define_builtin_function(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord']);

    this._define_builtin_function(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'bias']);

    if (this.type == glsl.source.VERTEX) {
        this._define_builtin_function(Tn.T_VEC4, 'texture2DLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'lod']);

        this._define_builtin_function(Tn.T_VEC4, 'texture2DProjLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);

        this._define_builtin_function(Tn.T_VEC4, 'texture2DProjLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'lod']);
    }

    this._define_builtin_function(Tn.T_VEC4, 'textureCube',
                                  [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord']);

    this._define_builtin_function(Tn.T_VEC4, 'textureCube',
                                  [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);

    if (this.type === glsl.source.VERTEX) {
        this._define_builtin_function(Tn.T_VEC4, 'textureCubeLod',
                                      [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);
    }

    // Derivative functions
    if (this._options.derivatives && this.type === glsl.source.FRAGMENT) {
        this._define_builtin_gentype_function(null, 'dFdx', [null, 'x']);
        this._define_builtin_gentype_function(null, 'dFdy', [null, 'x']);
        this._define_builtin_gentype_function(null, 'fwidth', [null, 'x']);
    }
};

Builtins.prototype._define_operators = function() {
    // Operators
    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, null,
                                          [Tn.T_INT, Tn.T_FLOAT,
                                           Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                           Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          Tn.T_FLOAT, null,
                                          [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, Tn.T_FLOAT,
                                          [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          Tn.T_INT, null,
                                          [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, Tn.T_INT,
                                          [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    // Matrix/vector multiplication
    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT2, null, [Tn.T_VEC2]);
    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT3, null, [Tn.T_VEC3]);
    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT4, null, [Tn.T_VEC4]);

    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC2, null, [Tn.T_MAT2]);
    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC3, null, [Tn.T_MAT3]);
    this._define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC4, null, [Tn.T_MAT4]);

    // Relational operators
    this._define_builtin_bin_operator_gen(Tn.T_BOOL,
                                          [Tn.T_LEFT_ANGLE, Tn.T_RIGHT_ANGLE, Tn.T_LE_OP, Tn.T_GE_OP],
                                          null, null,
                                          [Tn.T_FLOAT, Tn.T_INT]);

    // Logical operators
    this._define_builtin_bin_operator_gen(Tn.T_BOOL,
                                          [Tn.T_EQ_OP, Tn.T_NE_OP],
                                          null, null,
                                          [Tn.T_INT, Tn.T_FLOAT, Tn.T_BOOL,
                                           Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                           Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._define_builtin_bin_operator_gen(null,
                                          [Tn.T_AND_OP, Tn.T_OR_OP, Tn.T_XOR_OP],
                                          null, null,
                                          [Tn.T_BOOL]);

    // Unary operators
    this._define_builtin_unary_operator_gen(null,
                                            [Tn.T_DASH, Tn.T_DEC_OP, Tn.T_INC_OP],
                                            null,
                                            [Tn.T_INT, Tn.T_FLOAT,
                                             Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                             Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                             Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._define_builtin_unary_operator_gen(null,
                                            [Tn.T_BANG],
                                            null,
                                            [Tn.T_BOOL]);
};

// vi:ts=4:et
