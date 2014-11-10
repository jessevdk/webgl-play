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
    builtins: require('./builtins'),
};

var Tn = glsl.tokenizer.Tokenizer;

function Error(loc, message) {
    glsl.source.Error.call(this, loc, message);
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

exports.Error = Error;

function Annotate(ast, opts) {
    (new Annotator(ast, opts)).annotate();
}

function Annotator(ast, opts) {
    this._ast = ast;

    if (typeof opts === 'undefined') {
        opts = {};
    }

    if (typeof opts.builtins !== 'undefined') {
        this._builtins = opts.builtins;
    } else {
        this._builtins = new glsl.builtins.Builtins(ast.type);
    }

    this._ast.functionProtos = [];
    this._ast.functionProtoMap = {};

    this._ast.functions = [];
    this._ast.functionMap = {};

    this._ast.uniforms = [];
    this._ast.uniformMap = {};

    this._ast.varyings = [];
    this._ast.varyingMap = {};

    this._scope = null;
    this._scopes = [];

    var bscope = this._pushScope({
        functionProtos: [],
        functionProtoMap: {}
    });

    bscope.marshal = function() {
        return '(builtin scope)';
    };

    // Push builtin types into the scope
    for (var i = 0; i < this._builtins.types.length; i++) {
        var btype = this._builtins.types[i];
        var t = btype.type.t.type;

        this._declareType(t);
    }

    // Push builtin functions into the scope
    for (var i = 0; i < this._builtins.functions.length; i++) {
        var f = this._builtins.functions[i];

        this._scope.functionProtoMap[f.header.signature()] = f;
        this._scope.functionProtos.push(f);
    }

    // Push builtin variables into the scope
    for (var i = 0; i < this._builtins.variables.length; i++) {
        var v = this._builtins.variables[i];
        this._declareVariable(v.names[0]);
    }

    // Push builtin precision into the scope
    for (var i = 0; i < this._builtins.precisions.length; i++) {
        var p = this._builtins.precisions[i];

        this._scope.precisions.push(p);
        this._scope.precisionMap[p.type.t.type.name] = p;
    }

    this._pushScope(ast);
    this._errors = [];
}

Annotator.prototype.annotate = function() {
    this._annotateNode(this._ast);
    this._ast._errors = this._ast._errors.concat(this._errors);
};

Annotator.prototype._isToplevelScope = function() {
    return this._scope == this._ast;
};

Annotator.prototype._pushScope = function(node) {
    if (!glsl.ast.StructDecl.prototype.isPrototypeOf(node)) {
        node.variables = [];
        node.variableMap = {};
    }

    node.types = [];
    node.typeMap = {};
    node.scopes = [];

    node.symbols = {};

    node.precisions = [];
    node.precisionMap = {};

    if (this._scope !== null) {
        this._scope.scopes.push(node);
    }

    node.parentScope = this._scope;

    this._scope = node;
    this._scopes.unshift(this._scope);

    return node;
};

Annotator.prototype._popScope = function() {
    var ret = this._scopes.shift();
    this._scope = this._scopes[0];

    return ret;
};

Annotator.prototype._annotateNode = function(node) {
    if (!node) {
        return;
    }

    var fn = '_annotate' + node.nodeName;

    if (typeof this[fn] !== 'function') {
        throw new global.Error('no annotator available for ' + node.nodeName);
    }

    node.t = {
        type: null
    };

    return this[fn](node);
};

Annotator.prototype._annotateParser = function(node) {
    for (var i = 0; i < node.body.length; i++) {
        this._annotateNode(node.body[i]);
    }
};

Annotator.prototype._lookup = function(name, mapname) {
    var scope = this._scope;

    while (scope !== null) {
        if (typeof scope[mapname] !== 'undefined' && name in scope[mapname]) {
            return scope[mapname][name];
        }

        scope = scope.parentScope;
    }

    return null;
};

Annotator.prototype._lookupType = function(name) {
    return this._lookup(name, 'typeMap');
};

Annotator.prototype._lookupSymbol = function(name) {
    return this._lookup(name, 'symbols');
};

Annotator.prototype._lookupFunction = function(name) {
    return this._lookup(name, 'functionMap');
};

Annotator.prototype._lookupFunctionProto = function(name) {
    return this._lookup(name, 'functionProtoMap');
};

Annotator.prototype._lookupFunctionOrProto = function(name) {
    var f = this._lookupFunction(name);

    if (f !== null) {
        return f;
    }

    return this._lookupFunctionProto(name);
};

Annotator.prototype._declareType = function(type) {
    this._scope.types.push(type);
    this._scope.typeMap[type.name] = type;
    this._scope.symbols[type.name] = type;
};

Annotator.prototype._declareVariable = function(node) {
    this._scope.variableMap[node.name.text] = node;
    this._scope.variables.push(node);

    if (node.type.isUniform() && this._isToplevelScope()) {
        this._scope.uniforms.push(node);
        this._scope.uniformMap[node.name.text] = node;
    } else if (node.type.isVarying()) {
        this._scope.varyings.push(node);
        this._scope.varyingMap[node.name.text] = node;
    }

    this._scope.symbols[node.name.text] = node;
};

Annotator.prototype._lookupOrDeclareType = function(type) {
    var tp = this._lookupType(type.name);

    if (tp === null) {
        this._declareType(type);
        return type;
    }

    return tp;
};

Annotator.prototype._annotateTypeRef = function(type) {
    if (type.incomplete) {
        return;
    }

    if (type.decl !== null) {
        this._annotateNode(type.decl);

        type.t.type = type.decl.t.type;
    } else {
        if (type.isPrimitive) {
            type.t.type = this._builtins.typeMap[type.token.id].type.t.type;
        } else {
            type.t.type = this._lookupType(type.token.text);
        }
    }

    if (type.t.type === null) {
        this._error(type.location(), 'unknown type ' + type.token.text);
    }
};

Annotator.prototype._annotateArray = function(node, elementType) {
    if (node.isArray) {
        if (this._resolveArraySize(node)) {
            node.t.type = this._lookupOrDeclareType(new glsl.builtins.ArrayType(elementType, node.arraySize.t.constValue));
        }
    }
};

Annotator.prototype._annotateNamed = function(node) {
    this._annotateNode(node.initialValue);

    if (!node.isArray) {
        node.t.type = node.type.t.type;
    } else {
        this._annotateArray(node, node.type.t.type);
    }

    if (node.t.type !== null) {
        if (node.type.isAttribute()) {
            if (node.t.type.isComposite) {
                this._error(node.location(), 'structures cannot be attributes');
            } else if (node.t.type.isArray) {
                this._error(node.location(), 'arrays cannot be attributes');
            }
        }

        if (node.type.isVarying()) {
            if (node.t.type.isComposite) {
                this._error(node.location(), 'structures cannot be varying');
            }
        }
    }

    if (node.type.isAttribute()) {
        if (this._ast.type != glsl.source.VERTEX) {
            this._error(node.location(), 'attributes can only be declared in vertex shaders');
        }

        if (!this._isToplevelScope()) {
            this._error(node.location(), 'attributes can only be declared globally');
        }

        if (node.initialValue !== null) {
            this._error(node.initialValue.location(), 'attributes cannot have an initial value');
        }
    }

    if (node.type.isUniform()) {
        if (!this._isToplevelScope() ) {
            this._error(node.location(), 'uniforms can only be declared globally');
        }

        if (node.initialValue !== null) {
            this._error(node.initialValue.location(), 'uniforms cannot have an initial value');
        }
    }

    if (node.type.isVarying()) {
        if (!this._isToplevelScope()) {
            this._error(node.location(), 'varyings can only be declared globally');
        }

        if (node.initialValue !== null) {
            this._error(node.initialValue.location(), 'varyings cannot have an initial value');
        }
    }

    if (node.type.isConst()) {
        if (node.isArray) {
            this._error(node.location(), 'arrays cannot be declared as const');
        } else if (node.t.type.isComposite && node.t.type.hasArrayField) {
            this._error(node.location(), 'cannot declare a struct containing an array as const');
        }

        if (node.initialValue !== null) {
            if (!node.initialValue.t.isConstExpression) {
                this._error(node.initialValue.location(), 'expected constant initial value expression');
            } else {
                node.t.isConstExpression = true;
                node.t.constValue = node.initialValue.t.constValue;
            }
        } else {
            this._error(node.location(), 'missing constant value initialization');

            node.t.isConstExpression = true;
            node.t.constValue = node.t.type.zero;
        }
    }
};

Annotator.prototype._annotateParamDecl = function(node) {
    this._annotateNode(node.type);

    node.t.users = [];

    if (!node.isArray) {
        node.t.type = node.type.t.type;
    } else {
        this._annotateArray(node, node.type.t.type);
    }
};

Annotator.prototype._annotateVariableDecl = function(node) {
    this._annotateNode(node.type);

    for (var i = 0; i < node.names.length; i++) {
        var name = node.names[i];

        this._annotateNode(name);
        name.t.users = [];

        // Check if variable with the same name is already declared in this
        // scope
        if (name.name !== null && name.name.text in this._scope.symbols) {
            var sym = this._scope.symbols[name.name.text];

            if (glsl.ast.Named.prototype.isPrototypeOf(sym) && glsl.ast.VariableDecl.prototype.isPrototypeOf(sym.decl)) {
                this._error(name.location(), 'the variable \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + sym.location().inspect());
                continue;
            } else {
                this._error(name.location(), 'a ' + this._errorSymbolTypeName(sym) + ' \'' + name.name.text + '\' has already been declared in this scope, previous declaration was at ' + sym.location().inspect());
            }
        }

        // Declare variable
        this._declareVariable(name);

        if (node.type !== null && node.type.t.type !== null &&
            name.initialValue !== null && name.initialValue.t.type !== null) {
            if (node.type.t.type !== name.initialValue.t.type) {
                this._error(name.location(), 'cannot assign value of type ' + name.initialValue.t.type.name + ' to variable of type ' + node.type.t.type.name);
            }
        }
    }
};

Annotator.prototype._annotateTypeDecl = function(node) {
    this._annotateNode(node.type);
};

Annotator.prototype._annotateStructDecl = function(node) {
    var type;

    if (glsl.ast.StructDecl.prototype.isPrototypeOf(this._scope)) {
        this._error(node.location(), 'nested struct declarations are not allowed');
    }

    if (node.name !== null) {
        var tp = this._lookupSymbol(node.name.text);

        if (tp !== null) {
            this._error(node.location(), 'a type named ' + node.name.text + ' has already been declared, previous declaration was at ' + tp.location().inspect());
            return;
        }

        type = new glsl.builtins.UserType(node.name.text, node);
        this._declareType(type);
    } else {
        // new anonymous user type
        type = new glsl.builtins.UserType(null, node);
    }

    node.t.type = type;
    this._pushScope(node);

    var fieldMap = {};

    for (var i = 0; i < node.fields.length; i++) {
        var field = node.fields[i];

        this._annotateNode(field.type);

        for (var j = 0; j < field.names.length; j++) {
            var name = field.names[j];

            this._annotateNode(name);

            if (name.type.t.type) {
                var f = node.t.type.declareField(name.name.text, name.type.t.type);
                f.decl = name;

                if (name.name.text in fieldMap) {
                    this._error(name.location(), 'a field named ' + name.name.text + ' already exists, previous declaration was at ' + fieldMap[name.name.text].location().inspect());
                }

                fieldMap[name.name.text] = field;
            }
        }
    }

    this._popScope(node);
};

Annotator.prototype._resolveArraySize = function(node) {
    if (!node.isArray) {
        return false;
    }

    this._annotateNode(node.arraySize);

    if (!node.arraySize.t.isConstExpression) {
        this._error(node.arraySize.location(), 'expected constant expression for array size');
        return false;
    } else if (node.arraySize.t.type != this._builtins.Int) {
        var n;

        if (node.arraySize.t.type == this._builtins.Float) {
            n = 'float';
        } else if (node.arraySize.t.type == this._builtins.Bool) {
            n = 'boolean';
        } else {
            n = 'user type';
        }

        this._error(node.arraySize.location(), 'expected constant integer expression for array size, but got ' + n);
        return false;
    } else if (node.arraySize.constValue <= 0) {
        this._error(node.arraySize.location(), 'array size must be larger or equal to 1, but got ' + node.arraySize.constValue);
    }

    return true;
};

Annotator.prototype._annotateFunctionHeader = function(node) {
    // return type
    this._annotateNode(node.type);

    if (node.type.t.type !== null && node.type.t.type.isArray) {
        this._error(node.type.location(), 'array return values are not allowed');
    }

    node.t.type = node.type.t.type;

    for (var i = 0; i < node.parameters.length; i++) {
        this._annotateNode(node.parameters[i]);
    }
};

Annotator.prototype._annotateFunctionProto = function(node) {
    if (!this._isToplevelScope()) {
        this._error(node.location(), 'nested function prototypes are not allowed');
        return;
    }

    var id = node.header.signature();
    var name = node.header.name;

    if (name.text === 'main') {
        this._error(name.location, 'cannot overload main');
    }

    var prev = this._lookupFunction(id);

    if (prev !== null) {
        this._error(name.location, 'the function prototype ' + name.text + ' appears after its definition at ' + prev.name.location);
        return;
    } else if (name.text in this._scope.symbols) {
        var sym = this._scope.symbols[name.text];

        this._error(name.location, 'a ' + this._errorSymbolTypeName(sym) + ' ' + name.text + ' has already been declared, previous declaration was at ' + sym.location());
        return;
    }

    this._annotateNode(node.header);

    node.t.type = node.header.t.type;

    this._scope.functionProtos.push(node);
    this._scope.functionProtoMap[id] = node;
};

Annotator.prototype._qualifiersToString = function(qualifiers) {
    var ret = '';

    for (var i = 0; i < qualifiers.length; i++) {
        var q = qualifiers[i];

        if (i !== 0) {
            ret += ' ';
        }

        ret += q.token.text;
    }

    return ret;
};

Annotator.prototype._matchingQualifiers = function(a, b) {
    if (a.length != b.length) {
        return false;
    }

    var cpa = a.slice();
    var cpb = b.slice();

    while (cpa.length > 0) {
        var i = cpb.indexOf(cpa.pop());

        if (i !== -1) {
            cpb.splice(i, 1);
        } else {
            return false;
        }
    }

    if (cpb.length !== 0) {
        return false;
    }

    return true;
};

Annotator.prototype._annotateFunctionDef = function(node) {
    if (!this._isToplevelScope()) {
        this._error(node.location(), 'nested function definitions are not allowed');
        return;
    }

    var id = node.header.signature();
    var name = node.header.name;

    var prev = this._lookupFunction(id);

    if (prev !== null) {
        this._error(name.location, 'the function ' + name.text + ' is already defined, previous definition was at ' + prev.name.location.inspect());
        return;
    } else if (name.text in this._scope.symbols) {
        var sym = this._scope.symbols[name.text];

        this._error(name.location, 'a ' + this._errorSymbolTypeName(sym) + ' ' + name.text + ' has already been declared, previous declaration was at ' + sym.location().inspect());
        return;
    }

    this._annotateNode(node.header);
    node.t.type = node.header.t.type;

    var proto = this._lookupFunctionProto(id);

    if (proto !== null) {
        if (proto.header.type.type != node.header.type.type) {
            this._error(node.header.type.location(), 'the return type ' + node.header.type.token.text + ' of the function definition of ' + name.text + ' does not correspond to the return type ' + proto.header.type.token.text + ' of its prototype declared at ' + proto.location());
        }

        if (node.header.parameters.length == proto.header.parameters.length) {
            for (var i = 0; i < node.header.parameters.length; i++) {
                var param1 = node.header.parameters[i];
                var param2 = proto.header.parameters[i];

                if (!this._matchingQualifiers(param1.type.qualifiers, param2.type.qualifiers)) {
                    this._error(param1.location(), 'the type qualifiers of parameter ' + param1.name.text + ' (' + this._qualifiersToString(param1.type.qualifiers) + ') of the function definition of ' + name.text + ' do not correspond to the parameter type qualifiers ' + this._qualifiersToString(param2.type.qualifiers) + ' of its prototype declared at ' + param2.location());
                }
            }
        }
    } else if (node.header.name.text === 'main') {
        this._error(node.header.name.location, 'invalid definition of main, expected void main()');
    }

    this._scope.functions.push(node);
    this._scope.functionMap[id] = node;

    this._pushScope(node);

    for (var i = 0; i < node.header.parameters.length; i++) {
        var param = node.header.parameters[i];

        if (i === 0 && param.type.token.id == Tn.T_VOID) {
            continue;
        }

        this._scope.variables.push(param);

        if (param.name !== null) {
            this._scope.variableMap[param.name.text] = param;

            this._scope.symbols[param.name.text] = param;
        }
    }

    this._annotateNode(node.body);

    this._popScope();
};

Annotator.prototype._annotateBlock = function(node) {
    if (node.newScope) {
        this._pushScope(node);
    }

    for (var i = 0; i < node.body.length; i++) {
        var item = node.body[i];

        this._annotateNode(item);
    }

    if (node.newScope) {
        this._popScope();
    }
};

Annotator.prototype._annotatePrecisionStmt = function(node) {
    this._annotateNode(node.type);

    if (node.type === null || node.type.t.type === null) {
        return;
    }

    var tp = node.type.t.type;

    var allowed = [
        this._builtins.Int,
        this._builtins.Float,
        this._builtins.Sampler2D,
        this._builtins.SamplerCube
    ];

    if (allowed.indexOf(tp) == -1) {
        this._error(node.location(), 'precision can only be set for int, float and sampler types');
    }

    this._scope.precisions.push(node);
    this._scope.precisionMap[tp.name] = node;
};

Annotator.prototype._errorSymbolTypeName = function(node) {
    if (glsl.ast.Named.prototype.isPrototypeOf(node)) {
        return this._errorSymbolTypeName(node.decl);
    }

    var map = [
        [glsl.ast.FunctionDef, 'function definition'],
        [glsl.ast.FunctionProto, 'function prototype'],
        [glsl.ast.StructDecl, 'struct'],
        [glsl.ast.VariableDecl, 'variable'],
    ];

    for (var i = 0; i < map.length; i++) {
        var item = map[i];

        if (item[0].prototype.isPrototypeOf(node)) {
            return item[1];
        }
    }

    return node.nodeName;
};

Annotator.prototype._annotateInvariantDecl = function(node) {
    for (var i = 0; i < node.names.length; i++) {
        var name = node.names[i];

        var symbol = this._lookupSymbol(name.text);

        if (symbol === null) {
            this._error(name.location, 'cannot make unknown variable ' + name.text + ' invariant');
        } else if (!glsl.ast.Named.prototype.isPrototypeOf(symbol) ||
                   !glsl.ast.VariableDecl.prototype.isPrototypeOf(symbol.decl)) {
            var n = this._errorSymbolTypeName(symbol);

            this._error(name.location, 'cannot make the ' + n + ' ' + name.text + ' invariant');
        }
    }
};

Annotator.prototype._annotateExpressionStmt = function(node) {
    this._annotateNode(node.expression);
};

Annotator.prototype._initExpr = function(node) {
    node.t.isConstExpression = false;
    node.t.constValue = null;
};

Annotator.prototype._annotateConstantExpr = function(node) {
    this._initExpr(node);

    node.t.isConstExpression = true;
    node.t.constValue = node.token.value;

    switch (node.token.id) {
    case Tn.T_INTCONSTANT:
        node.t.type = this._builtins.Int;
        break;
    case Tn.T_FLOATCONSTANT:
        node.t.type = this._builtins.Float;
        break;
    case Tn.T_BOOLCONSTANT:
        node.t.type = this._builtins.Bool;
        break;
    }
};

Annotator.prototype._annotateFunctionCallExpr = function(node) {
    this._initExpr(node);

    var argnames = [];

    node.t.decl = null;
    node.t.isConstructor = false;

    var isok = true;

    for (var i = 0; i < node.arguments.length; i++) {
        var arg = node.arguments[i];

        this._annotateNode(arg);

        if (arg.t.type === null) {
            isok = false;
            continue;
        }

        if (i === 0 && arg.t.type == this._builtins.Void) {
            continue;
        }

        argnames.push(arg.t.type.name);
    }

    if (!isok) {
        return;
    }

    var tp = this._lookupType(node.name.text);

    if (tp !== null) {
        node.t.type = tp;
        node.t.isConstructor = true;

        if (tp.isPrimitive) {
            if (tp.isScalar) {
                if (node.arguments.length != 1) {
                    this._error(node.location(), 'constructor of type ' + tp.name + ' requires exactly 1 argument, ' + node.arguments.length + ' given');
                } else {
                    var nt = node.arguments[0].t;

                    if (!nt.type.isPrimitive) {
                        this._error(node.location, 'constructor of type ' + tp.name + ' cannot be called with type ' + nt.type.name);
                    } else if (nt.isConstExpression) {
                        node.t.isConstExpression = true;

                        if (nt.type.isScalar) {
                            node.t.constValue = nt.constValue;
                        } else {
                            node.t.constValue = nt.constValue[0];
                        }
                    }
                }
            } else if (tp.isVec || tp.isMat) {
                if (node.arguments.length == 1) {
                    var arg0 = node.arguments[0].t;

                    if (arg0.type.isScalar && arg0.isConstExpression) {
                        node.t.isConstExpression = true;
                        node.t.constValue = [];

                        for (var i = 0; i < tp.length; i++) {
                            if (tp.isVec) {
                                node.t.constValue.push(arg0.constValue);
                            } else {
                                var col = [];

                                for (var j = 0; j < tp.length; j++) {
                                    if (j == i) {
                                        col.push(arg0.constValue);
                                    } else {
                                        col.push(0);
                                    }
                                }

                                node.t.constValue.push(col);
                            }
                        }
                    } else if (!arg0.type.isScalar) {
                        if (arg0.type.isVec != tp.isVec || arg0.type.isMat != tp.isMat) {
                            this._error(node.location(), 'cannot call constructor of type ' + tp.name + ' with argument of type ' + arg0.type.name);
                        } else if (arg0.isConstExpression) {
                            node.t.isConstExpression = true;
                            node.t.constValue = [];

                            for (var i = 0; i < tp.length; i++) {
                                if (tp.isVec) {
                                    if (i >= arg0.type.length) {
                                        node.t.constValue.push(0);
                                    } else {
                                        node.t.constValue.push(arg0.constValue[i]);
                                    }
                                } else {
                                    var col = [];

                                    for (var j = 0; j < tp.length; j++) {
                                        if (i >= arg0.type.length || j >= arg0.type.length) {
                                            col.push(i == j ? 1 : 0);
                                        } else {
                                            col.push(arg0.constValue[i][j]);
                                        }
                                    }

                                    node.t.constValue.push(col);
                                }
                            }
                        }
                    }
                } else if (node.arguments.length > 1) {
                    var val = [];
                    var mval = [];

                    var numel = 0;
                    var numex;

                    if (tp.isMat) {
                        numex = tp.length * tp.length;
                    } else {
                        numex = tp.length;
                    }

                    node.t.isConstExpression = true;

                    for (var i = 0; i < node.arguments.length; i++) {
                        var arg = node.arguments[i];

                        if (tp.isMat && arg.t.type.isMat) {
                            this._error(arg.location(), 'cannot construct matrix with intermixed matrix argument');
                            return;
                        }

                        if (!arg.t.type.isPrimitive) {
                            this._error(arg.location(), 'cannot use value of type ' + arg.t.type.name + ' to construct value of type ' + tp.name);
                            return;
                        }

                        if (numel + arg.t.type.length > numex) {
                            this._error(arg.location(), 'too many values to construct value of type ' + tp.name);
                            return;
                        }

                        numel += arg.t.type.length;

                        if (arg.t.isConstExpression) {
                            var v = arg.t.constValue;

                            if (arg.t.type.isScalar) {
                                v = [v];
                            }

                            for (var j = 0; j < v.length; j++) {
                                if (val.length == tp.length && tp.isMat) {
                                    mval.push(val);
                                    val = [];
                                }

                                val.push(v[j]);
                            }
                        } else {
                            node.t.isConstExpression = false;

                        }
                    }

                    if (tp.isMat) {
                        mval.push(val);
                    }

                    if (numel != numex) {
                        this._error(node.location(), 'not enough values to fully construct type ' + tp.name + ' (got ' + numel + ', but expected ' + numex + ' values)');
                        return;
                    }

                    if (node.t.isConstExpression) {
                        if (tp.isMat) {
                            node.t.constValue = mval;
                        } else {
                            node.t.constValue = val;
                        }
                    }
                } else {
                    var numex = 1;

                    if (tp.isMat) {
                        numex = tp.length * tp.length;
                    } else if (tp.isVec) {
                        numex = tp.length;
                    }

                    this._error(node.location(), 'not enough values to fully construct type ' + tp.name + ' (got 0, but expected ' + numex + ')');

                    node.t.isConstExpression = true;
                    node.t.constValue = node.t.type.zero;
                }
            }
        } else {
            // structures
            if (node.arguments.length != tp.fields.length) {
                this._error(node.location(), 'expected ' + tp.fields.length + ' arguments, but got ' + node.arguments.length);
                return;
            }

            node.t.isConstExpression = true;
            var val = {};

            for (var i = 0; i < node.arguments.length; i++) {
                var arg = node.arguments[i];
                var field = tp.fields[i];

                if (arg.t.type != field.type) {
                    this._error(arg.location(), 'cannot initialize ' + tp.name + '.' + field.name + ' with type ' + field.type.name + ' from argument of type ' + arg.t.type.name);
                    continue;
                } else if (arg.t.isConstExpression) {
                    val[field.name] = arg.t.constValue;
                    node.t.isConstExpression = true;
                }
            }

            if (node.t.isConstExpression) {
                node.t.constValue = val;
            }
        }

        return;
    }

    var sig = glsl.ast.FunctionHeader.signatureFromNames(node.name.text, argnames);
    var f = this._lookupFunctionOrProto(sig);

    if (f === null) {
        this._error(node.location(), 'could not find function matching signature ' + sig);
        return;
    }

    if (glsl.ast.FunctionProto.prototype.isPrototypeOf(f) && f.isBuiltin && f.evaluate !== null) {
        var cargs = [];

        for (var i = 0; i < node.arguments.length; i++) {
            var arg = node.arguments[i];

            if (arg.t.isConstExpression) {
                cargs.push(arg.t.constValue);
            } else {
                cargs = null;
                break;
            }
        }

        if (cargs !== null) {
            node.t.isConstExpression = true;
            node.t.constValue = f.evaluate.apply(this, cargs);
        }
    }

    node.t.type = f.header.type.t.type;
    node.t.decl = f;
};

Annotator.prototype._annotateVariableExpr = function(node) {
    this._initExpr(node);

    var sym = this._lookupSymbol(node.name.text);

    node.t.decl = null;

    if (sym === null) {
        this._error(node.location(), 'undefined variable ' + node.name.text);
    } else if ((glsl.ast.Named.prototype.isPrototypeOf(sym) && glsl.ast.VariableDecl.prototype.isPrototypeOf(sym.decl)) ||
               glsl.ast.ParamDecl.prototype.isPrototypeOf(sym)) {
        node.t.decl = sym;
        node.t.type = sym.t.type;

        sym.t.users.push(node);

        if (glsl.ast.Named.prototype.isPrototypeOf(sym) && sym.t.isConstExpression) {
            node.t.isConstExpression = true;
            node.t.constValue = sym.t.constValue;
        }
    } else {
        this._error(node.location(), 'expected a variable for ' + node.name.text + ' but got a ' + this._errorSymbolTypeName(sym));
    }
};

Annotator.prototype._validateLvalue = function(node) {
    if (node.t.type === null) {
        return false;
    }

    switch (Object.getPrototypeOf(node)) {
    case glsl.ast.GroupExpr.prototype:
        return this._validateLvalue(node.expression);
    case glsl.ast.VariableExpr.prototype:
        if (node.t.decl.type.isUniform()) {
            this._error(node.location(), 'cannot assign to uniform value');
            return false;
        } else if (node.t.decl.type.isConst()) {
            this._error(node.location(), 'cannot assign to const value');
        }

        return true;
    case glsl.ast.FieldSelectionExpr.prototype:
        if (!this._validateLvalue(node.expression)) {
            return false;
        }

        if (node.expression.t.type.isVec) {
            // check for repeated values in the swizzle
            var chars = node.selector.text.split('');
            chars.sort();
            var found = null;

            for (var i = 0; i < chars.length - 1; i++) {
                if (chars[i] == chars[i + 1]) {
                    found = chars[i];
                    break;
                }
            }

            if (found !== null) {
                var first = node.selector.text.indexOf(found);
                var second = node.selector.text.indexOf(found, first + 1);

                this._error(node.selector.location().advanceChars(second), 'cannot assign to repeated swizzle');
                return false;
            }
        }

        return true;
    case glsl.ast.IndexExpr.prototype:
        if (!this._validateLvalue(node.expression)) {
            return false;
        }

        return true;
    default:
        this._error(node.location(), 'cannot assign to expression');
        return false;
    }
};

Annotator.prototype._annotateAssignmentExpr = function(node) {
    this._initExpr(node);

    this._annotateNode(node.lhs);
    this._annotateNode(node.rhs);

    node.t.type = node.lhs.t.type;

    if (node.lhs.t.type !== null && node.rhs.t.type !== null) {
        var binop = null;

        switch (node.op.id) {
        case Tn.T_MUL_ASSIGN:
            binop = Tn.T_STAR;
            break;
        case Tn.T_DIV_ASSIGN:
            binop = Tn.T_SLASH;
            break;
        case Tn.T_ADD_ASSIGN:
            binop = Tn.T_PLUS;
            break;
        case Tn.T_SUB_ASSIGN:
            binop = Tn.T_DASH;
            break;
        }

        var rettype = node.rhs.t.type;

        if (binop !== null) {
            var sig = Tn.tokenName(binop) + '(' + node.lhs.t.type.name + ',' + node.rhs.t.type.name + ')';

            if (!(sig in this._builtins.operatorMap)) {
                this._error(node.location(), 'cannot use the operator \'' + Tn.tokenName(binop) + '\' on types ' + node.lhs.t.type.name + ' and ' + node.rhs.t.type.name);
            } else {
                var oper = this._builtins.operatorMap[sig];
                rettype = oper.ret;
            }
        }

        if (node.lhs.t.type != rettype) {
            this._error(node.lhs.location().extend(node.op.location), 'cannot assign expression of type ' + node.rhs.t.type.name + ' to a value of type ' + node.lhs.t.type.name);
        }
    }

    if (glsl.ast.VariableExpr.prototype.isPrototypeOf(node.lhs) && node.lhs.t.type !== null && node.lhs.t.type.isArray) {
        this._error(node.lhs.location(), 'cannot assign to array');
    }

    this._validateLvalue(node.lhs);
};

Annotator.prototype._annotateBinOpExpr = function(node) {
    this._initExpr(node);

    this._annotateNode(node.lhs);
    this._annotateNode(node.rhs);

    // Make some guess if lhs or rhs could not be type checked
    if (node.lhs.t.type === null) {
        node.t.type = node.rhs.t.type;
    } else if (node.rhs.t.type === null) {
        node.t.type = node.lhs.t.type;
    } else if (node.lhs.t.type !== null && node.rhs.t.type !== null) {
        if (node.op.id == Tn.T_EQ_OP || node.op.id == Tn.T_NE_OP) {
            if (node.lhs.t.type == node.rhs.t.type) {
                if (node.lhs.t.type.isComposite && node.lhs.t.type.hasArrayField) {
                    this._error(node.op.location, 'cannot compare structures with array fields');
                } else if (node.lhs.t.type.isComposite && node.lhs.t.type.hasSamplerField) {
                    this._error(node.op.location, 'cannot compare structures with sampler fields');
                } else if (node.lhs.t.type.isArray) {
                    this._error(node.op.location, 'cannot compare arrays');
                } else if (node.lhs.t.type.isSampler) {
                    this._error(node.op.location, 'cannot compare samplers');
                }

                node.t.type = this._builtins.Bool;
                return;
            }
        }

        var sig = node.op.text + '(' + node.lhs.t.type.name + ',' + node.rhs.t.type.name + ')';

        if (sig in this._builtins.operatorMap) {
            var op = this._builtins.operatorMap[sig];
            node.t.type = op.ret;

            if (node.lhs.t.isConstExpression && node.rhs.t.isConstExpression) {
                node.t.isConstExpression = true;
                node.t.constValue = op.evaluate(node.lhs.t.constValue, node.rhs.t.constValue);
            }
        } else {
            this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on types ' + node.lhs.t.type.name + ' and ' + node.rhs.t.type.name);
        }
    }
};

Annotator.prototype._annotateUnaryOpExpr = function(node) {
    this._initExpr(node);

    this._annotateNode(node.expression);

    if (node.expression.t.type === null) {
        return;
    }

    var sig = node.op.text + '(' + node.expression.t.type.name + ')';

    if (sig in this._builtins.operatorMap) {
        var op = this._builtins.operatorMap[sig];
        node.t.type = op.ret;

        if (node.expression.t.isConstExpression) {
            node.t.isConstExpression = true;

            if (glsl.ast.UnaryPostfixOpExpr.prototype.isPrototypeOf(node)) {
                node.t.constValue = node.expression.t.constValue;
            } else {
                node.t.constValue = op.evaluate(node.expression.t.constValue);
            }
        }
    } else {
        this._error(node.location(), 'cannot use the \'' + node.op.text + '\' operator on type ' + node.expression.t.type.name);
    }
};

Annotator.prototype._annotateUnaryPostfixOpExpr = function(node) {
    this._annotateUnaryOpExpr(node);
};

Annotator.prototype._annotateTernaryExpr = function(node) {
    this._initExpr(node);

    this._annotateNode(node.condition);
    this._annotateNode(node.trueExpression);
    this._annotateNode(node.falseExpression);

    if (node.condition.t.type !== null && node.condition.t.type != this._builtins.Bool) {
        this._error(node.condition.location(), 'the condition of a ternary conditional expression must be of type bool, not ' + node.condition.t.type.name);
    }

    if ((node.trueExpression === null || node.trueExpression.t.type === null) &&
        (node.falseExpression === null || node.falseExpression.t.type === null)) {
        return;
    }

    if (node.trueExpression === null || node.trueExpression.t.type === null) {
        node.t.type = node.falseExpression.t.type;
    } else if (node.falseExpression === null || node.falseExpression.t.type === null) {
        node.t.type = node.trueExpression.t.type;
    } else if (node.trueExpression.t.type != node.falseExpression.t.type) {
        this._error(node.trueExpression.location().extend(node.falseExpression.location()),
                    'the true expression and false expression must be of the same type, but got ' + node.trueExpression.t.type.name + ' and ' + node.falseExpression.t.type.name);
        node.t.type = node.trueExpression.t.type;
    } else {
        node.t.type = node.trueExpression.t.type;
    }

    if (node.condition.t.isConstExpression) {
        if (node.condition.t.constValue) {
            if (node.trueExpression.t.isConstExpression) {
                node.t.isConstExpression = true;
                node.t.constValue = node.trueExpression.t.constValue;
            }
        } else {
            if (node.falseExpression.t.isConstExpression) {
                node.t.isConstExpression = true;
                node.t.constValue = node.falseExpression.t.constValue;
            }
        }
    }
};

Annotator.prototype._annotateIndexExpr = function(node) {
    this._initExpr(node);

    this._annotateNode(node.expression);
    this._annotateNode(node.index);

    var et = node.expression.t.type;

    if (et !== null) {
        if ((!et.isArray && !et.isPrimitive) || et.length <= 1) {
            this._error(node.expression.location(), 'only vectors, matrices and arrays can be indexed, not ' + et.name);
        } else if (node.index.t.type !== null && node.index.t.type.isConstExpression && node.index.t.type.constValue >= et.length) {
            this._error(node.index.location(), 'index out of bounds, trying to index element ' + node.index.t.type.constValue + ' in a value of length ' + et.length);
        } else if (et.isPrimitive) {
            if (et.isMat) {
                var m = {2: this._builtins.Vec2, 3: this._builtins.Vec3, 4: this._builtins.Vec4};
                node.t.type = m[et.length];
            } else if (et.isFloat) {
                node.t.type = this._builtins.Float;
            } else if (et.isInt) {
                node.t.type = this._builtins.Int;
            } else if (et.isBool) {
                node.t.type = this._builtins.Bool;
            }
        } else if (et.isArray) {
            node.t.type = et.elementType;
        }
    }

    if (node.index.t.type !== null) {
        if (node.index.t.type != this._builtins.Int) {
            this._error(node.index.location(), 'expected integer index expression, but got expression of type ' + node.index.t.type.name);
        } else if (node.expression.t.isConstExpression) {
            node.t.constValue = node.expression.t.constValue[node.index.t.constValue];
            node.t.isConstExpression = true;
        }
    }
};

Annotator.prototype._annotateFieldSelectionExpr = function(node) {
    this._initExpr(node);
    this._annotateNode(node.expression);

    var et = node.expression.t.type;

    if (et === null) {
        return;
    }

    if (node.selector === null) {
        return;
    }

    var s = node.selector.text;

    if (et.isPrimitive) {
        if (et.isVec) {
            var components = {
                'x': 0, 'y': 0, 'z': 0, 'w': 0,
                'r': 1, 'g': 1, 'b': 1, 'a': 1,
                's': 2, 't': 2, 'p': 2, 'q': 2
            };

            var cgroups = [
                'xyzw',
                'rgba',
                'stpq'
            ];

            if (s.length > 4) {
                this._error(node.selector.location, 'component selection on vectors is limited to a maximum of 4 elements, got ' + s.length);
                return;
            }

            var tps = [];

            if (et.isFloat) {
                tps = [Tn.T_FLOAT, Tn.T_VEC2, Tn.T_VEC3, Tn.T_VEC4];
            } else if (et.isInt) {
                tps = [Tn.T_INT, Tn.T_IVEC2, Tn.T_IVEC3, Tn.T_IVEC4];
            } else if (et.isBool) {
                tps = [Tn.T_BOOL, Tn.T_BVEC2, Tn.T_BVEC3, Tn.T_BVEC4];
            }

            node.t.type = this._builtins.typeMap[tps[s.length - 1]].type.t.type;

            if (node.expression.t.isConstExpression) {
                node.t.isConstExpression = true;

                if (node.t.type.isVec) {
                    node.t.constValue = [];

                    for (var i = 0; i < node.t.type.length; i++) {
                        node.t.constValue.push(0);
                    }
                } else {
                    node.t.constValue = 0;
                }
            }

            var ci = 0;

            for (var i = 0; i < s.length; i++) {
                var c = s[i];

                if (!(c in components)) {
                    this._error(node.selector.location.start.advanceChars(i).toRange(),
                                'invalid component selector \'' + c + '\', expected one of \'xyzw\' \'rgba\' or \'stpq\'');
                    return;
                }

                if (i !== 0 && ci != components[c]) {
                    this._error(node.selector.location.start.advanceChars(i).toRange(),
                                'cannot mix components of different groups, expected one of \'' + cgroups[ci] + '\'');
                    return;
                }

                ci = components[c];

                var j = cgroups[ci].indexOf(c);

                if (j >= et.length) {
                    this._error(node.selector.location.start.advanceChars(i).toRange(),
                                'selector out of bounds, expression has only ' + et.length + ' components, but tried to select component ' + (ci + 1));
                    return;
                }

                if (node.expression.t.isConstExpression) {
                    if (node.t.type.isVec) {
                        node.t.constValue[i] = node.expression.t.constValue[j];
                    } else {
                        node.t.constValue = node.expression.t.constValue[j];
                    }
                }
            }
        } else {
            this._error(node.expression.location().extend(node.op.location), 'selector \'' + s + '\' does not apply to an expression of type ' + et.name);
        }
    } else if (et.isComposite) {
        // Select on field in user defined type
        if (s in et.fieldMap) {
            var f = et.fieldMap[s];

            if (node.expression.t.isConstExpression && s in node.expression.t.constValue) {
                node.t.isConstExpression = true;
                node.t.constValue = node.expression.t.constValue[s];
            }

            node.t.type = f.type;
        } else {
            this._error(node.selector.location, 'the field \'' + s + '\' does not exist in the struct type ' + et.name);
        }
    } else {
        this._error(node.selector.location, 'cannot apply selector \'' + s + '\' to expression of type ' + et.name);
    }
};

Annotator.prototype._copyType = function(dest, src) {
    dest.t.type = src.t.type;
    dest.t.isConstExpression = src.t.isConstExpression;
    dest.t.constValue = src.t.constValue;
};
Annotator.prototype._annotateGroupExpr = function(node) {
    this._initExpr(node);
    this._annotateNode(node.expression);

    this._copyType(node, node.expression);
};

Annotator.prototype._annotateExpressionListStmt = function(node) {
    for (var i = 0; i < node.expressions.length; i++) {
        this._annotateNode(node.expressions[i]);
    }

    this._copyType(node, node.expressions[node.expressions.length - 1]);
};

Annotator.prototype._annotateDoStmt = function(node) {
    this._annotateNode(node.condition);

    if (node.condition.t.type !== null && node.condition.t.type !== this._builtins.Bool) {
        this._error(node.condition.location(), 'condition must of of type bool, got type ' + node.condition.t.type.name);
    }

    this._annotateNode(node.body);
};

Annotator.prototype._annotateWhileStmt = function(node) {
    this._pushScope(node);
    this._annotateNode(node.condition);

    if (node.condition.t.type !== null && node.condition.t.type !== this._builtins.Bool) {
        this._error(node.condition.location(), 'condition must of of type bool, got type ' + node.condition.t.type.name);
    }

    this._annotateNode(node.body);
    this._popScope();
};

Annotator.prototype._annotateForRestStmt = function(node) {
    this._annotateNode(node.condition);

    if (node.condition.t.type !== null && node.condition.t.type !== this._builtins.Bool) {
        this._error(node.condition.location(), 'condition must of of type bool, got type ' + node.condition.t.type.name);
    }

    this._annotateNode(node.expression);
};

Annotator.prototype._annotateForStmt = function(node) {
    this._pushScope(node);

    this._annotateNode(node.init);
    this._annotateNode(node.rest);
    this._annotateNode(node.body);

    this._popScope();
};

Annotator.prototype._annotateSelectionStmt = function(node) {
    this._annotateNode(node.condition);

    if (node.condition !== null &&
        node.condition.t.type !== null &&
        node.condition.t.type !== this._builtins.Bool) {
        this._error(node.condition.location(), 'condition must of of type bool, got type ' + node.condition.t.type.name);
    }

    this._pushScope(node.body);
    this._annotateNode(node.body);
    this._popScope();

    if (node.els) {
        this._pushScope(node.els);
        this._annotateNode(node.els);
        this._popScope(node.els);
    }
};

Annotator.prototype._annotateSelectionElseStmt = function(node) {
    this._annotateNode(node.body);
};

Annotator.prototype._annotateBreakStmt = function() {
};

Annotator.prototype._annotateContinueStmt = function() {
};

Annotator.prototype._annotateDiscardStmt = function() {
};

Annotator.prototype._annotateReturnStmt = function(node) {
    this._annotateNode(node.expression);

    var scope = this._scope;

    while (scope !== null && !glsl.ast.FunctionDef.prototype.isPrototypeOf(scope)) {
        scope = scope.parentScope;
    }

    if (scope !== null) {
        if (scope.t.type === this._builtins.Void && node.expression !== null) {
            this._error(node.expression.location(), 'returning value in a function with type void');
        } else if (scope.t.type !== this._builtins.Void && node.expression !== null && node.expression.t.type !== null && node.expression.t.type != scope.t.type) {
            this._error(node.expression.location(), 'expected return value of type ' + scope.t.type.name + ' but got value of type ' + node.expression.t.type.name);
        }
    }
};

Annotator.prototype._annotateNoMatch = function() {
};

Annotator.prototype._annotateEmptyStmt = function() {
};

Annotator.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
};

exports.Annotate = Annotate;

// vi:ts=4:et
