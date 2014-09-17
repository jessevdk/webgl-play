"use strict";

var ns;

if (typeof window != 'undefined' || typeof self != 'undefined') {
    var ctx = (typeof window != 'undefined' ? window : self);

    if (typeof ctx.glsl == 'undefined') {
        ctx.glsl = {};
    }

    ctx.glsl.builtins = {};
    ns = ctx.glsl.builtins;
} else {
    // in node
    var glsl = {
        source: require('./source'),
        ast: require('./ast'),
        tokenizer: require('./tokenizer'),
    }

    ns = exports;
}

(function(exports) {

var Tn = glsl.tokenizer.Tokenizer;
var dtn = new Tn(null);

exports.Functions = [];
exports.FunctionMap = {};

exports.Types = [];
exports.TypeMap = {};


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

    this.fields.push(field);
    this.field_map[name] = field;

    this.zero[name] = type.zero;
    return field;
}


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
    TypeClass.call(this, PrimitiveType._name(id));

    this.id = id;
    this.zero = zero;

    this.is_scalar = PrimitiveType._is_scalar(id);
    this.is_vec = PrimitiveType._is_vec(id);
    this.is_mat = PrimitiveType._is_mat(id);

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
}

PrimitiveType.prototype.marshal = function() {
    return '$' + this.name;
}

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
}

PrimitiveType._is_mat = function(tok) {
    switch (tok) {
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
        return true;
    }

    return false;
}

PrimitiveType._is_scalar = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
        return true;
    }

    return false;
}

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
}

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
}

PrimitiveType._name = function(tok) {
    switch (tok) {
    case Tn.T_VOID:
        return "void";

    case Tn.T_FLOAT:
        return "float";
    case Tn.T_INT:
        return "int";
    case Tn.T_BOOL:
        return "bool";

    case Tn.T_VEC2:
        return "vec2";
    case Tn.T_VEC3:
        return "vec3";
    case Tn.T_VEC4:
        return "vec4";

    case Tn.T_BVEC2:
        return "bvec2";
    case Tn.T_BVEC3:
        return "bvec3";
    case Tn.T_BVEC4:
        return "bvec4";

    case Tn.T_IVEC2:
        return "ivec2";
    case Tn.T_IVEC3:
        return "ivec3";
    case Tn.T_IVEC4:
        return "ivec4";

    case Tn.T_MAT2:
        return "mat2";
    case Tn.T_MAT3:
        return "mat3";
    case Tn.T_MAT4:
        return "mat4";

    case Tn.T_SAMPLER2D:
        return "sampler2D";
    case Tn.T_SAMPLERCUBE:
        return "samplerCube";
    }
}

PrimitiveType._create_builtins = function() {
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

        var name = PrimitiveType._name(tokid);

        var bloc = new glsl.source.BuiltinRange()
        var tok = dtn.create_token(tokid, name, bloc);

        var decl = new glsl.ast.TypeDecl((new glsl.ast.TypeRef(tok)).complete());
        decl.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);
        decl.incomplete = false;

        decl.type.t = {
            type: new PrimitiveType(tokid, zero)
        };

        exports.Types.push(decl);
        exports.TypeMap[tokid] = decl;

        name = name[0].toUpperCase() + name.slice(1);

        exports[name] = decl.type.t.type;
    }
}

PrimitiveType._create_builtins();

function declare_variable(qualifiers, typeid, name, arsize, defintval) {
    var type = exports.TypeMap[typeid];
    var bloc = new glsl.source.BuiltinRange();

    var tp = new glsl.ast.TypeRef(dtn.create_token(typeid, PrimitiveType._name(typeid), bloc));
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

    var Int = exports.TypeMap[Tn.T_INT].type.t.type;

    if (typeof arsize !== 'undefined' && arsize !== null) {
        n.is_array = true;
        n.left_bracket = dtn.create_token(Tn.T_LEFT_BRACKET, dtn.token_name(Tn.T_LEFT_BRACKET), bloc);
        n.right_bracket = dtn.create_token(Tn.T_RIGHT_BRACKET, dtn.token_name(Tn.T_RIGHT_BRACKET), bloc);

        if (typeof arsize === 'string') {
            var expr = new glsl.ast.VariableExpr(dtn.create_token(Tn.T_IDENTIFIER, arsize, bloc));
            expr.complete();

            var c = exports.ConstantMap[arsize];

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
            }
        }
    }

    if (typeof defintval !== 'undefined' && defintval !== null) {
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

    return decl;
}

function create_builtin_constants() {
    exports.Constants = [
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexAttribs', null, 8),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexUniformVectors', null, 128),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVaryingVectors', null, 8),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexTextureImageUnits', null, 0),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxCombinedTextureImageUnits', null, 8),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxTextureImageUnits', null, 8),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxFragmentUniformVectors', null, 16),
        declare_variable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxDrawBuffers', null, 1)
    ];

    exports.ConstantMap = {};

    for (var i = 0; i < exports.Constants.length; i++) {
        var c = exports.Constants[i];

        exports.ConstantMap[c.names[0].name.text] = c;
    }
}

function create_builtin_variables() {
    exports.Variables = {};
    exports.Variables[glsl.source.VERTEX] = [
        declare_variable([Tn.T_HIGHP], Tn.T_VEC4, 'gl_Position'),
        declare_variable([Tn.T_MEDIUMP], Tn.T_FLOAT, 'gl_PointSize')
    ];

    exports.Variables[glsl.source.FRAGMENT] = [
        declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragCoord'),
        declare_variable([], Tn.T_BOOL, 'gl_FrontFacing'),
        declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragColor'),
        declare_variable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragData', 'gl_MaxDrawBuffers'),
        declare_variable([Tn.T_MEDIUMP], Tn.T_VEC2, 'gl_PointCoord'),
    ];
}

create_builtin_constants();
create_builtin_variables();

function elem_evaluator() {
    var l = 0;

    for (var i = 0; i < arguments.length; i++) {
        if (Array.prototype.isPrototypeOf(arguments[i])) {
            l = arguments[i].length;
            break;
        }
    }

    if (l == 0) {
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
}

function func_evaluator() {
    var args = [];

    for (var i = 0; i < arguments.length; i++) {
        if (!Array.prototype.isPrototypeOf(arguments[i])) {
            args.push([arguments[i]]);
        } else {
            args.push(arguments[i]);
        }
    }

    return this.apply(this, args);
}

function define_builtin_function(rettype, name, params, elemfunc, func) {
    if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(rettype)) {
        rettype = exports.TypeMap[rettype];
    }

    var sp = params.slice();

    for (var i = 0; i < sp.length; i += 2) {
        var p = sp[i];

        if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(p)) {
            sp[i] = exports.TypeMap[p];
        }
    }

    var bloc = new glsl.source.BuiltinRange();

    var type = new glsl.ast.TypeRef(dtn.create_token(rettype.type.token.id, PrimitiveType._name(rettype.type.token.id), bloc));
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

    if (sig in exports.FunctionMap) {
        return;
    }

    var f = new glsl.ast.FunctionProto(header);

    f.is_builtin = true;
    f.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);
    f.incomplete = false;

    if (elemfunc) {
        f.evaluate = elem_evaluator.bind(elemfunc);
    } else if (func) {
        f.evaluate = func_evaluator.bind(func);
    } else {
        f.evaluate = null;
    }

    exports.Functions.push(f);
    exports.FunctionMap[sig] = f;

    return f;
}

function define_builtin_function_gen(gentypes, rettype, name, params, elemfunc, func) {
    if (rettype !== null) {
        rettype = exports.TypeMap[rettype];
    }

    for (var i = 0; i < gentypes.length; i++) {
        var g = exports.TypeMap[gentypes[i]];
        var sp = params.slice();

        for (var j = 0; j < sp.length; j += 2) {
            var item = sp[j];

            if (item === null) {
                sp[j] = g;
            } else {
                sp[j] = exports.TypeMap[item];
            }
        }

        define_builtin_function(rettype !== null ? rettype : g,
                                name,
                                sp,
                                elemfunc,
                                func);
    }
}

function define_builtin_gentype_function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];

    define_builtin_function_gen(gentypes, rettype, name, params, elemfunc, func);
}

function define_builtin_mat_function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4];

    define_builtin_function_gen(gentypes, rettype, name, params, elemfunc, func);
}

function define_builtin_relvec_function(rettype, name, params, elemfunc, func) {
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

        define_builtin_function(ret, name, sp, elemfunc, func);
    }
}

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
}

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
}

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
}

exports.Operators = [];
exports.OperatorMap = {};

function find_type(t, def) {
    if (t === null) {
        t = def;
    }

    return exports.TypeMap[t].type.t.type;
}

function define_builtin_bin_operator_gen(rettype, optypes, lhs, rhs, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new Operator(op);
            o.ret = find_type(rettype, g);
            o.lhs = find_type(lhs, g);
            o.rhs = find_type(rhs, g);

            var sig = dtn.token_name(op) + '(' + o.lhs.name + ',' + o.rhs.name + ')';

            exports.Operators.push(o);
            exports.OperatorMap[sig] = o;
        }
    }
}

function define_builtin_unary_operator_gen(rettype, optypes, expr, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new UnaryOperator(op);
            o.ret = find_type(rettype, g);
            o.expr = find_type(expr, g);

            var sig = dtn.token_name(op) + '(' + o.expr.name + ')';

            exports.Operators.push(o);
            exports.OperatorMap[sig] = o;
        }
    }
}

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
}

// Angle and Trigonometry functions
define_builtin_gentype_function(null, 'radians', [null, 'degrees'], Emulate.radians);
define_builtin_gentype_function(null, 'degrees', [null, 'radians'], Emulate.degrees);

define_builtin_gentype_function(null, 'sin', [null, 'angle'], Math.sin);
define_builtin_gentype_function(null, 'cos', [null, 'angle'], Math.cos);
define_builtin_gentype_function(null, 'tan', [null, 'angle'], Math.tan);

define_builtin_gentype_function(null, 'asin', [null, 'x'], Math.asin);
define_builtin_gentype_function(null, 'acos', [null, 'x'], Math.acos);
define_builtin_gentype_function(null, 'atan', [null, 'y', null, 'x'], Math.atan2);
define_builtin_gentype_function(null, 'atan', [null, 'y_over_x'], Math.atan);

// Exponential Functions
define_builtin_gentype_function(null, 'pow', [null, 'x', null, 'y'], Math.pow);
define_builtin_gentype_function(null, 'exp', [null, 'x'], Math.exp);
define_builtin_gentype_function(null, 'log', [null, 'x'], Math.log);
define_builtin_gentype_function(null, 'exp2', [null, 'x'], Emulate.exp2);
define_builtin_gentype_function(null, 'log2', [null, 'x'], Emulate.log2);
define_builtin_gentype_function(null, 'sqrt', [null, 'x'], Math.sqrt);
define_builtin_gentype_function(null, 'inversesqrt', [null, 'x'], Emulate.inversesqrt);

// Common Functions
define_builtin_gentype_function(null, 'abs', [null, 'x'], Math.abs);
define_builtin_gentype_function(null, 'sign', [null, 'x'], Emulate.sign);
define_builtin_gentype_function(null, 'floor', [null, 'x'], Math.floor);
define_builtin_gentype_function(null, 'ceil', [null, 'x'], Math.ceil);
define_builtin_gentype_function(null, 'fract', [null, 'x'], Emulate.fract);
define_builtin_gentype_function(null, 'mod', [null, 'x', null, 'y'], Emulate.mod);
define_builtin_gentype_function(null, 'min', [null, 'x', null, 'y'], Math.min);
define_builtin_gentype_function(null, 'min', [null, 'x', Tn.T_FLOAT, 'y'], Math.min);
define_builtin_gentype_function(null, 'max', [null, 'x', null, 'y'], Math.max);
define_builtin_gentype_function(null, 'max', [null, 'x', Tn.T_FLOAT, 'y'], Math.max);
define_builtin_gentype_function(null, 'clamp', [null, 'x', null, 'minVal', null, 'maxVal'], Emulate.clamp);
define_builtin_gentype_function(null, 'clamp', [null, 'x', Tn.T_FLOAT, 'minVal', Tn.T_FLOAT, 'maxVal'], Emulate.clamp);
define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', null, 'a'], Emulate.mix);
define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', Tn.T_FLOAT, 'a'], Emulate.mix);
define_builtin_gentype_function(null, 'step', [null, 'edge', null, 'x'], Emulate.step);
define_builtin_gentype_function(null, 'step', [Tn.T_FLOAT, 'edge', null, 'x'], Emulate.step);
define_builtin_gentype_function(null, 'smoothstep', [null, 'edge0', null, 'edge1', null, 'x'], Emulate.smoothstep);
define_builtin_gentype_function(null, 'smoothstep', [Tn.T_FLOAT, 'edge0', Tn.T_FLOAT, 'edge1', null, 'x'], Emulate.smootstep);

// Geometric Functions
define_builtin_gentype_function(Tn.T_FLOAT, 'length', [null, 'x'], null, Emulate.length);
define_builtin_gentype_function(Tn.T_FLOAT, 'distance', [null, 'p0', null, 'p1'], null, Emulate.distance);
define_builtin_gentype_function(Tn.T_FLOAT, 'dot', [null, 'x', null, 'y'], null, Emulate.dot);
define_builtin_function(Tn.T_VEC3, 'cross', [Tn.T_VEC3, 'x', Tn.T_VEC3, 'y'], null, Emulate.cross);
define_builtin_gentype_function(null, 'normalize', [null, 'x'], null, Emulate.normalize);
define_builtin_gentype_function(null, 'faceforward', [null, 'N', null, 'I', null, 'Nref'], null, Emulate.faceforward);
define_builtin_gentype_function(null, 'reflect', [null, 'I', null, 'N'], null, Emulate.reflect);
define_builtin_gentype_function(null, 'refract', [null, 'I', null, 'N', Tn.T_FLOAT, 'eta'], null, Emulate.refract);

// Matrix Functions
define_builtin_mat_function(null, 'matrixCompMult', [null, 'x', null, 'y'], Emulate.matrixCompMult);

// Vector Relational Functions
define_builtin_relvec_function('bvec', 'lessThan', ['vec', 'x', 'vec', 'y'], Emulate.lessThan);
define_builtin_relvec_function('bvec', 'lessThan', ['ivec', 'x', 'ivec', 'y'], Emulate.lessThan);
define_builtin_relvec_function('bvec', 'lessThanEqual', ['vec', 'x', 'vec', 'y'], Emulate.lessThanEqual);
define_builtin_relvec_function('bvec', 'lessThanEqual', ['ivec', 'x', 'ivec', 'y'], Emulate.lessThanEqual);

define_builtin_relvec_function('bvec', 'greaterThan', ['vec', 'x', 'vec', 'y'], Emulate.greaterThan);
define_builtin_relvec_function('bvec', 'greaterThan', ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThan);
define_builtin_relvec_function('bvec', 'greaterThanEqual', ['vec', 'x', 'vec', 'y'], Emulate.greaterThanEqual);
define_builtin_relvec_function('bvec', 'greaterThanEqual', ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThanEqual);

define_builtin_relvec_function('bvec', 'equal', ['vec', 'x', 'vec', 'y'], Emulate.equal);
define_builtin_relvec_function('bvec', 'equal', ['ivec', 'x', 'ivec', 'y'], Emulate.equal);
define_builtin_relvec_function('bvec', 'notEqual', ['vec', 'x', 'vec', 'y'], Emulate.notEqual);
define_builtin_relvec_function('bvec', 'notEqual', ['ivec', 'x', 'ivec', 'y'], Emulate.notEqual);
define_builtin_relvec_function('bvec', 'notEqual', ['bvec', 'x', 'bvec', 'y'], Emulate.notEqual);

define_builtin_relvec_function(Tn.T_BOOL, 'any', ['bvec', 'x'], null, Emulate.any);
define_builtin_relvec_function(Tn.T_BOOL, 'all', ['bvec', 'x'], null, Emulate.all);
define_builtin_relvec_function('bvec', 'not', ['bvec', 'x'], Emulate.not);

// Texture Lookup Functions
define_builtin_function(Tn.T_VEC4, 'texture2D', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord']);
define_builtin_function(Tn.T_VEC4, 'texture2D', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'bias']);
define_builtin_function(Tn.T_VEC4, 'texture2DProj', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord']);
define_builtin_function(Tn.T_VEC4, 'texture2DProj', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);
define_builtin_function(Tn.T_VEC4, 'texture2DProj', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord']);
define_builtin_function(Tn.T_VEC4, 'texture2DProj', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'bias']);
define_builtin_function(Tn.T_VEC4, 'texture2DLod', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'lod']);
define_builtin_function(Tn.T_VEC4, 'texture2DProjLod', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);
define_builtin_function(Tn.T_VEC4, 'texture2DProjLod', [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'lod']);
define_builtin_function(Tn.T_VEC4, 'textureCube', [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord']);
define_builtin_function(Tn.T_VEC4, 'textureCube', [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);
define_builtin_function(Tn.T_VEC4, 'textureCubeLod', [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);


// Operators
define_builtin_bin_operator_gen(null,
                                [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                null, null,
                                [Tn.T_INT, Tn.T_FLOAT,
                                 Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                 Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                 Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

define_builtin_bin_operator_gen(null,
                                [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                Tn.T_FLOAT, null,
                                [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                 Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

define_builtin_bin_operator_gen(null,
                                [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                null, Tn.T_FLOAT,
                                [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                 Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

define_builtin_bin_operator_gen(null,
                                [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                Tn.T_INT, null,
                                [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

define_builtin_bin_operator_gen(null,
                                [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                null, Tn.T_INT,
                                [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

// Matrix/vector multiplication
define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT2, null, [Tn.T_VEC2]);
define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT3, null, [Tn.T_VEC3]);
define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_MAT4, null, [Tn.T_VEC4]);

define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC2, null, [Tn.T_MAT2]);
define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC3, null, [Tn.T_MAT3]);
define_builtin_bin_operator_gen(null, [Tn.T_STAR], Tn.T_VEC4, null, [Tn.T_MAT4]);

// Relational operators
define_builtin_bin_operator_gen(Tn.T_BOOL,
                                [Tn.T_LEFT_ANGLE, Tn.T_RIGHT_ANGLE, Tn.T_LE_OP, Tn.T_GE_OP],
                                null, null,
                                [Tn.T_FLOAT, Tn.T_INT]);

// Logical operators
define_builtin_bin_operator_gen(Tn.T_BOOL,
                                [Tn.T_EQ_OP, Tn.T_NE_OP],
                                null, null,
                                [Tn.T_INT, Tn.T_FLOAT, Tn.T_BOOL,
                                 Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                 Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                 Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

define_builtin_bin_operator_gen(null,
                                [Tn.T_AND_OP, Tn.T_OR_OP, Tn.T_XOR_OP],
                                null, null,
                                [Tn.T_BOOL]);

// Unary operators
define_builtin_unary_operator_gen(null,
                                  [Tn.T_DASH, Tn.T_DEC_OP, Tn.T_INC_OP],
                                  null,
                                  [Tn.T_INT, Tn.T_FLOAT,
                                   Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                   Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                   Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

define_builtin_unary_operator_gen(null,
                                  [Tn.T_BANG],
                                  null,
                                  [Tn.T_BOOL]);

})(ns);

// vi:ts=4:et
