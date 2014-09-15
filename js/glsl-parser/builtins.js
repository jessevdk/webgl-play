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

    this.is_int = PrimitiveType._is_int(id);
    this.is_float = PrimitiveType._is_float(id);
    this.is_bool = PrimitiveType._is_bool(id);

    this.is_primitive = true;

    this.length = PrimitiveType._length(id);
}

PrimitiveType.prototype = glsl.ast.Node.create('builtins.PrimitiveType', PrimitiveType, TypeClass);
exports.PrimitiveType = PrimitiveType;

PrimitiveType.prototype.marshal_can_ref = function() {
    return false;
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

PrimitiveType._is_int = function(tok) {
    switch (tok) {
    case Tn.T_INT:
    case Tn.T_IVEC2:
    case Tn.T_IVEC3:
    case Tn.T_IVEC4:
        return true;
    }

    return false;
}

PrimitiveType._is_bool = function(tok) {
    switch (tok) {
    case Tn.T_BOOL:
    case Tn.T_BVEC2:
    case Tn.T_BVEC3:
    case Tn.T_BVEC4:
        return true;
    }

    return false;
}

PrimitiveType._is_float = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_VEC2:
    case Tn.T_VEC3:
    case Tn.T_VEC4:
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
        return true;
    }

    return false;
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

function define_builtin_function(rettype, name, params) {
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

    var type = new glsl.ast.TypeRef(dtn.create_token(rettype.id, PrimitiveType._name(rettype.id), bloc));
    type.incomplete = false;

    type.t = {
        type: rettype
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
    f.semi = dtn.create_token(Tn.T_SEMICOLON, ';', bloc);
    f.incomplete = false;

    exports.Functions.push(f);
    exports.FunctionMap[sig] = f;

    return f;
}

function define_builtin_function_gen(gentypes, rettype, name, params) {
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
                                sp);
    }
}

function define_builtin_gentype_function(rettype, name, params) {
    var gentypes = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];

    define_builtin_function_gen(gentypes, rettype, name, params);
}

function define_builtin_mat_function(rettype, name, params) {
    var gentypes = [Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4];

    define_builtin_function_gen(gentypes, rettype, name, params);
}

function define_builtin_relvec_function(rettype, name, params) {
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

        define_builtin_function(ret, name, sp);
    }
}

function Operator(op) {
    this.op = op;
    this.ret = null;
    this.lhs = null;
    this.rhs = null;
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

// Angle and Trigonometry functions
define_builtin_gentype_function(null, 'radians', [null, 'degrees']);
define_builtin_gentype_function(null, 'degrees', [null, 'radians']);

define_builtin_gentype_function(null, 'sin', [null, 'angle']);
define_builtin_gentype_function(null, 'cos', [null, 'angle']);
define_builtin_gentype_function(null, 'tan', [null, 'angle']);

define_builtin_gentype_function(null, 'asin', [null, 'x']);
define_builtin_gentype_function(null, 'acos', [null, 'x']);
define_builtin_gentype_function(null, 'atan', [null, 'y', null, 'x']);
define_builtin_gentype_function(null, 'atan', [null, 'y_over_x']);

// Exponential Functions
define_builtin_gentype_function(null, 'pow', [null, 'x', null, 'y']);
define_builtin_gentype_function(null, 'exp', [null, 'x']);
define_builtin_gentype_function(null, 'log', [null, 'x']);
define_builtin_gentype_function(null, 'exp2', [null, 'x']);
define_builtin_gentype_function(null, 'log2', [null, 'x']);
define_builtin_gentype_function(null, 'sqrt', [null, 'x']);
define_builtin_gentype_function(null, 'inversesqrt', [null, 'x']);

// Common Functions
define_builtin_gentype_function(null, 'abs', [null, 'x']);
define_builtin_gentype_function(null, 'sign', [null, 'x']);
define_builtin_gentype_function(null, 'floor', [null, 'x']);
define_builtin_gentype_function(null, 'ceil', [null, 'x']);
define_builtin_gentype_function(null, 'fract', [null, 'x']);
define_builtin_gentype_function(null, 'mod', [null, 'x', null, 'y']);
define_builtin_gentype_function(null, 'min', [null, 'x', null, 'y']);
define_builtin_gentype_function(null, 'min', [null, 'x', Tn.T_FLOAT, 'y']);
define_builtin_gentype_function(null, 'max', [null, 'x', null, 'y']);
define_builtin_gentype_function(null, 'max', [null, 'x', Tn.T_FLOAT, 'y']);
define_builtin_gentype_function(null, 'clamp', [null, 'x', null, 'minVal', null, 'maxVal']);
define_builtin_gentype_function(null, 'clamp', [null, 'x', Tn.T_FLOAT, 'minVal', Tn.T_FLOAT, 'maxVal']);
define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', null, 'a']);
define_builtin_gentype_function(null, 'mix', [null, 'x', null, 'y', Tn.T_FLOAT, 'a']);
define_builtin_gentype_function(null, 'step', [null, 'edge', null, 'x']);
define_builtin_gentype_function(null, 'step', [Tn.T_FLOAT, 'edge', null, 'x']);
define_builtin_gentype_function(null, 'smoothstep', [null, 'edge0', null, 'edge1', null, 'x']);
define_builtin_gentype_function(null, 'smoothstep', [Tn.T_FLOAT, 'edge0', Tn.T_FLOAT, 'edge1', null, 'x']);

// Geometric Functions
define_builtin_gentype_function(Tn.T_FLOAT, 'length', [null, 'x']);
define_builtin_gentype_function(Tn.T_FLOAT, 'distance', [null, 'p0', null, 'p1']);
define_builtin_gentype_function(Tn.T_FLOAT, 'dot', [null, 'x', null, 'y']);
define_builtin_function(Tn.T_VEC3, 'cross', [Tn.T_VEC3, 'x', Tn.T_VEC3, 'y']);
define_builtin_gentype_function(null, 'normalize', [null, 'x']);
define_builtin_gentype_function(null, 'faceforward', [null, 'N', null, 'I', null, 'Nref']);
define_builtin_gentype_function(null, 'reflect', [null, 'I', null, 'N']);
define_builtin_gentype_function(null, 'refract', [null, 'I', null, 'N', Tn.T_FLOAT, 'eta']);

// Matrix Functions
define_builtin_mat_function(null, 'matrixCompMult', [null, 'x', null, 'y']);

// Vector Relational Functions
define_builtin_relvec_function('bvec', 'lessThan', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'lessThan', ['ivec', 'x', 'ivec', 'y']);
define_builtin_relvec_function('bvec', 'lessThanEqual', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'lessThanEqual', ['ivec', 'x', 'ivec', 'y']);

define_builtin_relvec_function('bvec', 'greaterThan', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'greaterThan', ['ivec', 'x', 'ivec', 'y']);
define_builtin_relvec_function('bvec', 'greaterThanEqual', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'greaterThanEqual', ['ivec', 'x', 'ivec', 'y']);

define_builtin_relvec_function('bvec', 'equal', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'equal', ['ivec', 'x', 'ivec', 'y']);
define_builtin_relvec_function('bvec', 'notEqual', ['vec', 'x', 'vec', 'y']);
define_builtin_relvec_function('bvec', 'notEqual', ['ivec', 'x', 'ivec', 'y']);
define_builtin_relvec_function('bvec', 'notEqual', ['bvec', 'x', 'bvec', 'y']);

define_builtin_relvec_function(Tn.T_BOOL, 'any', ['bvec', 'x']);
define_builtin_relvec_function(Tn.T_BOOL, 'all', ['bvec', 'x']);
define_builtin_relvec_function('bvec', 'not', ['bvec', 'x']);

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
