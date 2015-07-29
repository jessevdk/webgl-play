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

    this.isPrimitive = false;
    this.isArray = false;
    this.isComposite = false;
    this.isUser = false;

    this.decl = null;
}

TypeClass.prototype = glsl.ast.Node.create('TypeClass', TypeClass);
exports.TypeClass = TypeClass;


function CompositeType(name) {
    TypeClass.call(this, name);

    this.fieldMap = {};
    this.fields = [];
    this.isComposite = true;
    this.hasArrayField = false;
    this.hasSamplerField = false;

    this.zero = {};
}

CompositeType.prototype = glsl.ast.Node.create('builtins.CompositeType', CompositeType, TypeClass);
exports.CompositeType = CompositeType;

CompositeType.prototype.declareField = function(name, type) {
    var field = {
        name: name,
        type: type,
        decl: null
    };

    if (type.isArray || (type.isComposite && type.hasArrayField)) {
        this.hasArrayField = true;
    }

    if (type.isSampler || (type.isComposite && type.hasSamplerField)) {
        this.hasSamplerField = true;
    }

    this.fields.push(field);
    this.fieldMap[name] = field;

    this.zero[name] = type.zero;
    return field;
};


function UserType(name, decl) {
    CompositeType.call(this, name);

    this.decl = decl;
    this.isUser = true;
}

UserType.prototype = glsl.ast.Node.create('builtins.UserType', UserType, CompositeType);
exports.UserType = UserType;


function ArrayType(elementType, length) {
    TypeClass.call(this, elementType.name + '[' + length + ']');

    this.elementType = elementType;
    this.length = length;

    this.zero = [];

    for (var i = 0; i < length; i++) {
        this.zero.push(elementType.zero);
    }

    this.isArray = true;
}

ArrayType.prototype = glsl.ast.Node.create('builtins.ArrayType', ArrayType, TypeClass);
exports.ArrayType = ArrayType;


function PrimitiveType(id, zero) {
    TypeClass.call(this, dtn.tokenName(id));

    this.id = id;
    this.zero = zero;

    this.isScalar = PrimitiveType._isScalar(id);
    this.isVec = PrimitiveType._isVec(id);
    this.isMat = PrimitiveType._isMat(id);
    this.isSampler = PrimitiveType._isSampler(id);

    this.elementType = PrimitiveType._elementType(id);
    this.isInt = (this.elementType == Tn.T_INT);
    this.isFloat = (this.elementType == Tn.T_FLOAT);
    this.isBool = (this.elementType == Tn.T_BOOL);

    this.isPrimitive = true;

    this.length = PrimitiveType._length(id);
}

PrimitiveType.prototype = glsl.ast.Node.create('builtins.PrimitiveType', PrimitiveType, TypeClass);
exports.PrimitiveType = PrimitiveType;

PrimitiveType.prototype.marshalCanRef = function() {
    return false;
};

PrimitiveType.prototype.marshal = function() {
    return '$' + this.name;
};

PrimitiveType._isVec = function(tok) {
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

PrimitiveType._isSampler = function(tok) {
    switch (tok) {
    case Tn.T_SAMPLER2D:
    case Tn.T_SAMPLERCUBE:
        return true;
    }

    return false;
};

PrimitiveType._isMat = function(tok) {
    switch (tok) {
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
        return true;
    }

    return false;
};

PrimitiveType._isScalar = function(tok) {
    switch (tok) {
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
        return true;
    }

    return false;
};

PrimitiveType._elementType = function(tok) {
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

Operator.prototype._evaluateElem = function(a, b) {
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
        if (this.lhs.isVec && this.rhs.isMat) {
            var ret = [];

            for (var i = 0; i < this.lhs.length; i++) {
                var s = 0;

                for (var j = 0; j < this.lhs.length; j++) {
                    s += a[j] * b[i][j];
                }

                ret.push(s);
            }

            return ret;
        } else if (this.lhs.isMat && this.rhs.isVec) {
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

    if (this.lhs.isVec || this.rhs.isVec) {
        var ret = [];
        var l = (this.lhs.isVec ? this.lhs.length : this.rhs.length);

        for (var i = 0; i < l; i++) {
            ret.push(this._evaluateElem(this.lhs.isVec ? a[i] : a, this.rhs.isVec ? b[i] : b));
        }

        return ret;
    } else if (this.lhs.isMat || this.rhs.isMat) {
        var ret = [];
        var l = (this.lhs.isMat ? this.lhs.length : this.rhs.length);

        for (var i = 0; i < l; i++) {
            for (var j = 0; j < l; j++) {
                ret.push(this._evaluateElem(this.lhs.isMat ? a[i][j] : a, this.rhs.isMat ? b[i][j] : b));
            }
        }

        return ret;
    } else {
        return this._evaluateElem(a, b);
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
    this.typeMap = {};

    this.variables = [];
    this.variableMap = {};

    this.functions = [];
    this.functionMap = {};

    this.operators = [];
    this.operatorMap = {};

    this.precisions = [];
    this.precisionMap = {};

    this._defineTypes();
    this._defineConstants();
    this._defineVariables();
    this._defineFunctions();
    this._defineOperators();
    this._definePrecisions();
}

exports.Builtins = Builtins;

Builtins.createForContext = function(ctx, type) {
    return new Builtins(type, Builtins.optionsFromContext(ctx));
};

Builtins.optionsFromContext = function(ctx) {
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

        var drawbuffersExt = ctx.getExtension('WEBGL_draw_buffers');

        if (drawbuffersExt !== null) {
            constants.gl_MaxDrawBuffers = ctx.getParameter(drawbuffersExt.MAX_DRAW_BUFFERS_WEBGL);
        } else {
            constants.gl_MaxDrawBuffers = 1;
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

Builtins.prototype._defineTypes = function() {
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

        var name = dtn.tokenName(tokid);

        var bloc = new glsl.source.BuiltinRange();
        var tok = dtn.createToken(tokid, name, bloc);

        var decl = new glsl.ast.TypeDecl((new glsl.ast.TypeRef(tok)).complete());
        decl.semi = dtn.createToken(Tn.T_SEMICOLON, ';', bloc);
        decl.incomplete = false;

        decl.type.t = {
            type: new PrimitiveType(tokid, zero)
        };

        this.types.push(decl);
        this.typeMap[tokid] = decl;

        name = name[0].toUpperCase() + name.slice(1);

        this[name] = decl.type.t.type;
    }
};

Builtins.prototype._declareVariable = function(qualifiers, typeid, name, arsize, defintval) {
    var type = this.typeMap[typeid];
    var bloc = new glsl.source.BuiltinRange();

    var tp = new glsl.ast.TypeRef(dtn.createToken(typeid, dtn.tokenName(typeid), bloc));
    tp.complete();

    for (var i = 0; i < qualifiers.length; i++) {
        var q = qualifiers[i];

        tp.qualifiers.push(dtn.createToken(q, dtn.tokenName(q), bloc));
    }

    tp.t = {
        type: type.type.t.type
    };

    var decl = new glsl.ast.VariableDecl(tp);

    var n = new glsl.ast.Named(dtn.createToken(Tn.T_IDENTIFIER, name, bloc), decl);

    n.type = tp;

    n.t = {
        type: n.type.t.type,
        users: []
    };

    var Int = this.typeMap[Tn.T_INT].type.t.type;

    if (typeof arsize !== 'undefined' && arsize !== null) {
        n.isArray = true;
        n.leftBracket = dtn.createToken(Tn.T_LEFT_BRACKET, dtn.tokenName(Tn.T_LEFT_BRACKET), bloc);
        n.rightBracket = dtn.createToken(Tn.T_RIGHT_BRACKET, dtn.tokenName(Tn.T_RIGHT_BRACKET), bloc);

        if (typeof arsize === 'string') {
            var expr = new glsl.ast.VariableExpr(dtn.createToken(Tn.T_IDENTIFIER, arsize, bloc));
            expr.complete();

            var c = this.variableMap[arsize];

            expr.t = {
                decl: c,
                type: c.names[0].t.type,
                isConstExpression: true,
                constValue: c.names[0].t.constValue
            };

            n.arraySize = expr;
        } else {
            var tok = dtn.createToken(Tn.T_INTCONSTANT, "" + arsize, bloc);
            tok.value = arsize;

            n.arraySize = new glsl.ast.ConstantExpr(tok);
            n.arraySize.complete();

            n.arraySize.t = {
                type: Int,
                isConstExpression: true,
                constValue: arsize
            };
        }
    }

    if (typeof defintval !== 'undefined' && defintval !== null) {
        if (typeof this._options.constants !== 'undefined' && name in this._options.constants) {
            defintval = this._options.constants[name];
        }

        n.initialAssign = dtn.createToken(Tn.T_EQUAL, dtn.tokenName(Tn.T_EQUAL), bloc);

        var tok = dtn.createToken(Tn.T_INTCONSTANT, "" + defintval, bloc);
        tok.value = defintval;

        n.initialValue = new glsl.ast.ConstantExpr(tok);
        n.initialValue.complete();
        n.initialValue.t = {
            type: Int,
            isConstExpression: true,
            constValue: defintval
        };

        n.t.isConstExpression = true;
        n.t.constValue = defintval;
    }

    n.complete();

    decl.names.push(n);
    decl.complete();

    decl.t = {
        type: tp.t.type
    };

    this.variables.push(decl);
    this.variableMap[name] = decl;
};

Builtins.prototype._defineConstants = function() {
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexAttribs', null, 8);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexUniformVectors', null, 128);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVaryingVectors', null, 8);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxVertexTextureImageUnits', null, 0);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxCombinedTextureImageUnits', null, 8);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxTextureImageUnits', null, 8);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxFragmentUniformVectors', null, 16);
    this._declareVariable([Tn.T_CONST, Tn.T_MEDIUMP], Tn.T_INT, 'gl_MaxDrawBuffers', null, 1);
};

Builtins.prototype._defineVariables = function() {
    switch (this.type) {
    case glsl.source.VERTEX:
        this._declareVariable([Tn.T_HIGHP], Tn.T_VEC4, 'gl_Position');
        this._declareVariable([Tn.T_MEDIUMP], Tn.T_FLOAT, 'gl_PointSize');
        break;
    case glsl.source.FRAGMENT:
        this._declareVariable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragCoord');
        this._declareVariable([], Tn.T_BOOL, 'gl_FrontFacing');
        this._declareVariable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragColor');
        this._declareVariable([Tn.T_MEDIUMP], Tn.T_VEC4, 'gl_FragData', 'gl_MaxDrawBuffers');
        this._declareVariable([Tn.T_MEDIUMP], Tn.T_VEC2, 'gl_PointCoord');
        break;
    }
};

Builtins.prototype._declarePrecision = function(precision, typeid) {
    var bloc = new glsl.source.BuiltinRange();
    var type = this.typeMap[typeid];

    var prec = new glsl.ast.PrecisionStmt(dtn.createToken(Tn.T_PRECISION, dtn.tokenName(Tn.T_PRECISION), bloc));

    prec.qualifier = dtn.createToken(precision, dtn.tokenName(precision), bloc);

    var tp = new glsl.ast.TypeRef(dtn.createToken(typeid, dtn.tokenName(typeid), bloc));
    tp.complete();

    tp.t = {
        type: type.type.t.type
    };

    prec.type = tp;
    prec.semi = dtn.createToken(Tn.T_SEMICOLON, ';', bloc);

    this.precisions.push(prec);
    this.precisionMap[type.name] = prec;
};

Builtins.prototype._definePrecisions = function() {
    switch (this.type) {
    case glsl.source.VERTEX:
        this._declarePrecision(Tn.T_HIGHP, Tn.T_FLOAT);
        this._declarePrecision(Tn.T_HIGHP, Tn.T_INT);
        this._declarePrecision(Tn.T_LOWP, Tn.T_SAMPLER2D);
        this._declarePrecision(Tn.T_LOWP, Tn.T_SAMPLERCUBE);
        break;
    case glsl.source.FRAGMENT:
        this._declarePrecision(Tn.T_MEDIUMP, Tn.T_INT);
        this._declarePrecision(Tn.T_LOWP, Tn.T_SAMPLER2D);
        this._declarePrecision(Tn.T_LOWP, Tn.T_SAMPLERCUBE);
        break;
    }
};

Builtins.prototype._elemEvaluator = function() {
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

Builtins.prototype._funcEvaluator = function() {
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

Builtins.prototype._defineBuiltinFunction = function(rettype, name, params, elemfunc, func) {
    if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(rettype)) {
        rettype = this.typeMap[rettype];
    }

    var sp = params.slice();

    for (var i = 0; i < sp.length; i += 2) {
        var p = sp[i];

        if (!glsl.ast.TypeDecl.prototype.isPrototypeOf(p)) {
            sp[i] = this.typeMap[p];
        }
    }

    var bloc = new glsl.source.BuiltinRange();

    var type = new glsl.ast.TypeRef(dtn.createToken(rettype.type.token.id, dtn.tokenName(rettype.type.token.id), bloc));
    type.incomplete = false;

    type.t = {
        type: rettype.type.t.type
    };

    var name = dtn.createToken(Tn.T_IDENTIFIER, name, bloc);

    var header = new glsl.ast.FunctionHeader(type, name);
    header.leftParen = dtn.createToken(Tn.T_LEFT_PAREN, '(', bloc);
    header.rightParen = dtn.createToken(Tn.T_RIGHT_PAREN, ')', bloc);

    header.incomplete = false;

    for (var i = 0; i < sp.length; i += 2) {
        var p = sp[i];

        var decl = (new glsl.ast.ParamDecl()).complete();

        decl.type = p.type;
        decl.name = dtn.createToken(Tn.T_IDENTIFIER, sp[i + 1], bloc);

        header.parameters.push(decl);
    }

    var sig = header.signature();

    if (sig in this.functionMap) {
        return;
    }

    var f = new glsl.ast.FunctionProto(header);

    f.isBuiltin = true;
    f.semi = dtn.createToken(Tn.T_SEMICOLON, ';', bloc);
    f.incomplete = false;

    if (elemfunc) {
        f.evaluate = this._elemEvaluator.bind(elemfunc);
    } else if (func) {
        f.evaluate = this._funcEvaluator.bind(func);
    } else {
        f.evaluate = null;
    }

    this.functions.push(f);
    this.functionMap[sig] = f;

    return f;
};

Builtins.prototype._defineBuiltinFunctionGen = function(gentypes, rettype, name, params, elemfunc, func) {
    if (rettype !== null) {
        rettype = this.typeMap[rettype];
    }

    for (var i = 0; i < gentypes.length; i++) {
        var g = this.typeMap[gentypes[i]];
        var sp = params.slice();

        for (var j = 0; j < sp.length; j += 2) {
            var item = sp[j];

            if (item === null) {
                sp[j] = g;
            } else {
                sp[j] = this.typeMap[item];
            }
        }

        this._defineBuiltinFunction(rettype !== null ? rettype : g,
                                      name,
                                      sp,
                                      elemfunc,
                                      func);
    }
};

Builtins.prototype._defineBuiltinGentypeFunction = function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];

    this._defineBuiltinFunctionGen(gentypes, rettype, name, params, elemfunc, func);
};

Builtins.prototype._defineBuiltinMatFunction = function(rettype, name, params, elemfunc, func) {
    var gentypes = [Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4];

    this._defineBuiltinFunctionGen(gentypes, rettype, name, params, elemfunc, func);
};

Builtins.prototype._defineBuiltinRelvecFunction = function(rettype, name, params, elemfunc, func) {
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

        this._defineBuiltinFunction(ret, name, sp, elemfunc, func);
    }
};

Builtins.prototype._findType = function(t, def) {
    if (t === null) {
        t = def;
    }

    return this.typeMap[t].type.t.type;
};

Builtins.prototype._defineBuiltinBinOperatorGen = function(rettype, optypes, lhs, rhs, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new Operator(op);
            o.ret = this._findType(rettype, g);
            o.lhs = this._findType(lhs, g);
            o.rhs = this._findType(rhs, g);

            var sig = dtn.tokenName(op) + '(' + o.lhs.name + ',' + o.rhs.name + ')';

            this.operators.push(o);
            this.operatorMap[sig] = o;
        }
    }
};

Builtins.prototype._defineBuiltinUnaryOperatorGen = function(rettype, optypes, expr, gens) {
    for (var i = 0; i < optypes.length; i++) {
        var op = optypes[i];

        for (var j = 0; j < gens.length; j++) {
            var g = gens[j];

            var o = new UnaryOperator(op);
            o.ret = this._findType(rettype, g);
            o.expr = this._findType(expr, g);

            var sig = dtn.tokenName(op) + '(' + o.expr.name + ')';

            this.operators.push(o);
            this.operatorMap[sig] = o;
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

Builtins.prototype._defineFunctions = function() {
    this._defineBuiltinFunction(Tn.T_VOID, 'main', []);

    // Angle and Trigonometry functions
    this._defineBuiltinGentypeFunction(null, 'radians', [null, 'degrees'], Emulate.radians);
    this._defineBuiltinGentypeFunction(null, 'degrees', [null, 'radians'], Emulate.degrees);

    this._defineBuiltinGentypeFunction(null, 'sin', [null, 'angle'], Math.sin);
    this._defineBuiltinGentypeFunction(null, 'cos', [null, 'angle'], Math.cos);
    this._defineBuiltinGentypeFunction(null, 'tan', [null, 'angle'], Math.tan);

    this._defineBuiltinGentypeFunction(null, 'asin', [null, 'x'], Math.asin);
    this._defineBuiltinGentypeFunction(null, 'acos', [null, 'x'], Math.acos);
    this._defineBuiltinGentypeFunction(null, 'atan', [null, 'y', null, 'x'], Math.atan2);
    this._defineBuiltinGentypeFunction(null, 'atan', [null, 'y_over_x'], Math.atan);

    // Exponential Functions
    this._defineBuiltinGentypeFunction(null, 'pow', [null, 'x', null, 'y'], Math.pow);
    this._defineBuiltinGentypeFunction(null, 'exp', [null, 'x'], Math.exp);
    this._defineBuiltinGentypeFunction(null, 'log', [null, 'x'], Math.log);
    this._defineBuiltinGentypeFunction(null, 'exp2', [null, 'x'], Emulate.exp2);
    this._defineBuiltinGentypeFunction(null, 'log2', [null, 'x'], Emulate.log2);
    this._defineBuiltinGentypeFunction(null, 'sqrt', [null, 'x'], Math.sqrt);
    this._defineBuiltinGentypeFunction(null, 'inversesqrt', [null, 'x'], Emulate.inversesqrt);

    // Common Functions
    this._defineBuiltinGentypeFunction(null, 'abs', [null, 'x'], Math.abs);
    this._defineBuiltinGentypeFunction(null, 'sign', [null, 'x'], Emulate.sign);
    this._defineBuiltinGentypeFunction(null, 'floor', [null, 'x'], Math.floor);
    this._defineBuiltinGentypeFunction(null, 'ceil', [null, 'x'], Math.ceil);
    this._defineBuiltinGentypeFunction(null, 'fract', [null, 'x'], Emulate.fract);
    this._defineBuiltinGentypeFunction(null, 'mod', [null, 'x', null, 'y'], Emulate.mod);
    this._defineBuiltinGentypeFunction(null, 'min', [null, 'x', null, 'y'], Math.min);
    this._defineBuiltinGentypeFunction(null, 'min', [null, 'x', Tn.T_FLOAT, 'y'], Math.min);
    this._defineBuiltinGentypeFunction(null, 'max', [null, 'x', null, 'y'], Math.max);
    this._defineBuiltinGentypeFunction(null, 'max', [null, 'x', Tn.T_FLOAT, 'y'], Math.max);
    this._defineBuiltinGentypeFunction(null, 'clamp', [null, 'x', null, 'minVal', null, 'maxVal'], Emulate.clamp);
    this._defineBuiltinGentypeFunction(null, 'clamp', [null, 'x', Tn.T_FLOAT, 'minVal', Tn.T_FLOAT, 'maxVal'], Emulate.clamp);
    this._defineBuiltinGentypeFunction(null, 'mix', [null, 'x', null, 'y', null, 'a'], Emulate.mix);
    this._defineBuiltinGentypeFunction(null, 'mix', [null, 'x', null, 'y', Tn.T_FLOAT, 'a'], Emulate.mix);
    this._defineBuiltinGentypeFunction(null, 'step', [null, 'edge', null, 'x'], Emulate.step);
    this._defineBuiltinGentypeFunction(null, 'step', [Tn.T_FLOAT, 'edge', null, 'x'], Emulate.step);
    this._defineBuiltinGentypeFunction(null, 'smoothstep', [null, 'edge0', null, 'edge1', null, 'x'], Emulate.smoothstep);
    this._defineBuiltinGentypeFunction(null, 'smoothstep', [Tn.T_FLOAT, 'edge0', Tn.T_FLOAT, 'edge1', null, 'x'], Emulate.smootstep);

    // Geometric Functions
    this._defineBuiltinGentypeFunction(Tn.T_FLOAT, 'length',
                                          [null, 'x'], null, Emulate.length);

    this._defineBuiltinGentypeFunction(Tn.T_FLOAT, 'distance',
                                          [null, 'p0', null, 'p1'], null, Emulate.distance);

    this._defineBuiltinGentypeFunction(Tn.T_FLOAT, 'dot',
                                          [null, 'x', null, 'y'], null, Emulate.dot);

    this._defineBuiltinFunction(Tn.T_VEC3, 'cross',
                                  [Tn.T_VEC3, 'x', Tn.T_VEC3, 'y'], null, Emulate.cross);

    this._defineBuiltinGentypeFunction(null, 'normalize',
                                          [null, 'x'], null, Emulate.normalize);

    this._defineBuiltinGentypeFunction(null, 'faceforward',
                                          [null, 'N', null, 'I', null, 'Nref'], null, Emulate.faceforward);

    this._defineBuiltinGentypeFunction(null, 'reflect',
                                          [null, 'I', null, 'N'], null, Emulate.reflect);

    this._defineBuiltinGentypeFunction(null, 'refract',
                                          [null, 'I', null, 'N', Tn.T_FLOAT, 'eta'], null, Emulate.refract);

    // Matrix Functions
    this._defineBuiltinMatFunction(null, 'matrixCompMult', [null, 'x', null, 'y'], Emulate.matrixCompMult);

    // Vector Relational Functions
    this._defineBuiltinRelvecFunction('bvec', 'lessThan',
                                         ['vec', 'x', 'vec', 'y'], Emulate.lessThan);

    this._defineBuiltinRelvecFunction('bvec', 'lessThan',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.lessThan);

    this._defineBuiltinRelvecFunction('bvec', 'lessThanEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.lessThanEqual);

    this._defineBuiltinRelvecFunction('bvec', 'lessThanEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.lessThanEqual);

    this._defineBuiltinRelvecFunction('bvec', 'greaterThan',
                                         ['vec', 'x', 'vec', 'y'], Emulate.greaterThan);
    this._defineBuiltinRelvecFunction('bvec', 'greaterThan',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThan);

    this._defineBuiltinRelvecFunction('bvec', 'greaterThanEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.greaterThanEqual);

    this._defineBuiltinRelvecFunction('bvec', 'greaterThanEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.greaterThanEqual);

    this._defineBuiltinRelvecFunction('bvec', 'equal',
                                         ['vec', 'x', 'vec', 'y'], Emulate.equal);

    this._defineBuiltinRelvecFunction('bvec', 'equal',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.equal);

    this._defineBuiltinRelvecFunction('bvec', 'notEqual',
                                         ['vec', 'x', 'vec', 'y'], Emulate.notEqual);

    this._defineBuiltinRelvecFunction('bvec', 'notEqual',
                                         ['ivec', 'x', 'ivec', 'y'], Emulate.notEqual);

    this._defineBuiltinRelvecFunction('bvec', 'notEqual',
                                         ['bvec', 'x', 'bvec', 'y'], Emulate.notEqual);

    this._defineBuiltinRelvecFunction(Tn.T_BOOL, 'any',
                                         ['bvec', 'x'], null, Emulate.any);

    this._defineBuiltinRelvecFunction(Tn.T_BOOL, 'all',
                                         ['bvec', 'x'], null, Emulate.all);

    this._defineBuiltinRelvecFunction('bvec', 'not',
                                         ['bvec', 'x'], Emulate.not);

    // Texture Lookup Functions
    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2D',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2D',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'bias']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProj',
                                  [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'bias']);

    if (this.type == glsl.source.VERTEX) {
        this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC2, 'coord', Tn.T_FLOAT, 'lod']);

        this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProjLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);

        this._defineBuiltinFunction(Tn.T_VEC4, 'texture2DProjLod',
                                      [Tn.T_SAMPLER2D, 'sampler', Tn.T_VEC4, 'coord', Tn.T_FLOAT, 'lod']);
    }

    this._defineBuiltinFunction(Tn.T_VEC4, 'textureCube',
                                  [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord']);

    this._defineBuiltinFunction(Tn.T_VEC4, 'textureCube',
                                  [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'bias']);

    if (this.type === glsl.source.VERTEX) {
        this._defineBuiltinFunction(Tn.T_VEC4, 'textureCubeLod',
                                      [Tn.T_SAMPLERCUBE, 'sampler', Tn.T_VEC3, 'coord', Tn.T_FLOAT, 'lod']);
    }

    // Derivative functions
    if (this._options.derivatives && this.type === glsl.source.FRAGMENT) {
        this._defineBuiltinGentypeFunction(null, 'dFdx', [null, 'x']);
        this._defineBuiltinGentypeFunction(null, 'dFdy', [null, 'x']);
        this._defineBuiltinGentypeFunction(null, 'fwidth', [null, 'x']);
    }
};

Builtins.prototype._defineOperators = function() {
    // Operators
    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, null,
                                          [Tn.T_INT, Tn.T_FLOAT,
                                           Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                           Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          Tn.T_FLOAT, null,
                                          [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, Tn.T_FLOAT,
                                          [Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT3]);

    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          Tn.T_INT, null,
                                          [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_PLUS, Tn.T_DASH, Tn.T_STAR, Tn.T_SLASH],
                                          null, Tn.T_INT,
                                          [Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    // Matrix/vector multiplication
    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_MAT2, null, [Tn.T_VEC2]);
    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_MAT3, null, [Tn.T_VEC3]);
    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_MAT4, null, [Tn.T_VEC4]);

    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_VEC2, null, [Tn.T_MAT2]);
    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_VEC3, null, [Tn.T_MAT3]);
    this._defineBuiltinBinOperatorGen(null, [Tn.T_STAR], Tn.T_VEC4, null, [Tn.T_MAT4]);

    // Relational operators
    this._defineBuiltinBinOperatorGen(Tn.T_BOOL,
                                          [Tn.T_LEFT_ANGLE, Tn.T_RIGHT_ANGLE, Tn.T_LE_OP, Tn.T_GE_OP],
                                          null, null,
                                          [Tn.T_FLOAT, Tn.T_INT]);

    // Logical operators
    this._defineBuiltinBinOperatorGen(Tn.T_BOOL,
                                          [Tn.T_EQ_OP, Tn.T_NE_OP],
                                          null, null,
                                          [Tn.T_INT, Tn.T_FLOAT, Tn.T_BOOL,
                                           Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                           Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                           Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._defineBuiltinBinOperatorGen(null,
                                          [Tn.T_AND_OP, Tn.T_OR_OP, Tn.T_XOR_OP],
                                          null, null,
                                          [Tn.T_BOOL]);

    // Unary operators
    this._defineBuiltinUnaryOperatorGen(null,
                                            [Tn.T_DASH, Tn.T_DEC_OP, Tn.T_INC_OP],
                                            null,
                                            [Tn.T_INT, Tn.T_FLOAT,
                                             Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4,
                                             Tn.T_MAT2, Tn.T_MAT3, Tn.T_MAT4,
                                             Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4]);

    this._defineBuiltinUnaryOperatorGen(null,
                                            [Tn.T_BANG],
                                            null,
                                            [Tn.T_BOOL]);
};

// vi:ts=4:et
