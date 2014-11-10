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
    tokenizer: require('./tokenizer'),
    preprocessor: require('./preprocessor'),
    source: require('./source')
};

var Tn = glsl.tokenizer.Tokenizer;

var SYNC_FAIL       = 0,
    SYNC_OK         = 1,
    SYNC_OK_CONSUME = 2;

function Error(loc, message) {
    glsl.source.Error.call(this, loc, message);
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

function Node() {
    this.incomplete = true;
}

exports.Node = Node;

Node.create = function(name, constructor, parent) {
    if (typeof parent === 'undefined') {
        parent = Node;
    }

    var ret = Object.create(parent.prototype);

    ret.nodeName = name;
    ret.constructor = constructor;

    return ret;
};

Node.prototype._valueIsEmpty = function(v) {
    if (v === null) {
        return true;
    }

    if (v === false) {
        return true;
    }

    if (v === 0) {
        return true;
    }

    if (Array.prototype.isPrototypeOf(v) && v.length === 0) {
        return true;
    }

    if (Object.prototype.isPrototypeOf(v)) {
        for (var prop in v) {
            if (v.hasOwnProperty(prop)) {
                return false;
            }
        }

        return true;
    }

    return false;
};

Node.prototype.complete = function() {
    this.incomplete = false;
    return this;
};

Node.prototype._marshalObjectIsRef = function(value, inctype) {
    if (Node.prototype.isPrototypeOf(value) &&
        value.marshalCanRef() &&
        typeof value.__marshalRefId != 'undefined') {

        value.__marshalRef++;

        var ret = '';

        if (inctype) {
            ret += value.nodeName;
        }

        return ret + '@' + value.__marshalRefId;
    }

    return null;
};

Node.prototype.marshalNodeName = function() {
    return this.nodeName;
};

Node.prototype.marshalCanRef = function() {
    return true;
};

Node.prototype._marshalObject = function(value, ctx) {
    var ret = {};

    var isref = this._marshalObjectIsRef(value, false);

    if (isref !== null) {
        return isref;
    }

    if (Node.prototype.isPrototypeOf(value) && value.marshalCanRef()) {
        value.__marshalRef = 1;
        value.__marshalRefId = ctx.__marshalRefId++;
        value.__marshalled = ret;

        ctx.objects.push(value);
    }

    for (var k in value) {
        if (k[0] != '_' && value.hasOwnProperty(k) && !this._valueIsEmpty(value[k])) {
            var name = k;
            var val = value[k];

            if (typeof val == 'object' && typeof val.marshalNodeName === 'function') {
                name += '(' + val.marshalNodeName() + ')';
            }

            ret[name] = this._marshalValue(val, ctx);
        }
    }

    return ret;
};

Node.prototype._marshalArray = function(value, ctx) {
    var ret = new Array(value.length);

    for (var i = 0; i < value.length; i++) {
        var val = value[i];

        if (typeof val == 'object' && Node.prototype.isPrototypeOf(val)) {
            var isref = this._marshalObjectIsRef(val, true);

            if (isref === null) {
                var h = {};
                h[val.nodeName] = this._marshalValue(val, ctx);

                ret[i] = h;
            } else {
                ret[i] = isref;
            }
        } else {
            ret[i] = this._marshalValue(val, ctx);
        }
    }

    return ret;
};

Node.prototype._marshalValue = function(value, ctx) {
    if (typeof value === 'undefined') {
        return 'undefined';
    }

    if (typeof value != 'object') {
        return value;
    }

    if (Array.prototype.isPrototypeOf(value)) {
        return this._marshalArray(value, ctx);
    }

    var ret = this._marshalObjectIsRef(value, false);

    if (ret === null) {
        if (typeof value.marshal == 'function') {
            ret = value.marshal(ctx);
        } else {
            ret = this._marshalObject(value, ctx);
        }
    }

    return ret;
};

Node.prototype.marshal = function(ctx) {
    var ownedCtx = false;

    if (typeof ctx === 'undefined') {
        ctx = {
            __marshalRefId: 1,
            objects: []
        };

        ownedCtx = true;
    }

    var ret = this._marshalObject(this, ctx);

    if (ownedCtx) {
        for (var i = 0; i < ctx.objects.length; i++) {
            var obj = ctx.objects[i];

            if (obj.__marshalRef > 1) {
                obj.__marshalled['@id'] = obj.__marshalRefId;
            }

            delete obj.__marshalRef;
            delete obj.__marshalled;
            delete obj.__marshalRefId;
        }
    }

    return ret;
};

Node.prototype.location = function() {
    throw new Error(this.nodeName + ' does not implement required location()');
};

Node.prototype.toJson = function() {
    return JSON.stringify(this, function(key, value) {
        if (key[0] == '_') {
            return null;
        }

        return value;
    });
};

function TypeRef(tok) {
    Node.call(this);

    this.token = tok;
    this.decl = null;

    this.qualifiers = [];

    if (tok !== null) {
        this.isPrimitive = (tok.id != Tn.T_IDENTIFIER);
    } else {
        this.isPrimitive = false;
    }
}

TypeRef.prototype = Node.create('TypeRef', TypeRef);
exports.TypeRef = TypeRef;

TypeRef.wrapDecl = function(decl) {
    if (TypeRef.prototype.isPrototypeOf(decl)) {
        return decl;
    }

    var ret = new TypeRef(null);
    ret.decl = decl;

    if (!decl.incomplete) {
        ret.complete();
    }

    return ret;
};

TypeRef.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.qualifiers);
};

TypeRef.prototype.hasQualifier = function(qid) {
    for (var i = 0; i < this.qualifiers.length; i++) {
        var q = this.qualifiers[i];

        if (q.id == qid) {
            return true;
        }
    }

    return false;
};

TypeRef.prototype.isConst = function() {
    return this.hasQualifier(Tn.T_CONST);
};

TypeRef.prototype.isAttribute = function() {
    return this.hasQualifier(Tn.T_ATTRIBUTE);
};

TypeRef.prototype.isVarying = function() {
    return this.hasQualifier(Tn.T_VARYING);
};

TypeRef.prototype.isUniform = function() {
    return this.hasQualifier(Tn.T_UNIFORM);
};

function StructDecl(stok) {
    Node.call(this);

    this.token = stok;
    this.name = null;

    this.leftBrace = null;
    this.rightBrace = null;

    this.fields = [];
}

StructDecl.prototype = Node.create('StructDecl', StructDecl);
exports.StructDecl = StructDecl;

StructDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.name,
                                   this.fields,
                                   this.leftBrace,
                                   this.rightBrace);
};

function FieldDecl(type) {
    Node.call(this);

    this.type = type;
    this.names = [];
    this.semi = null;
}

FieldDecl.prototype = Node.create('FieldDecl', FieldDecl);
exports.FieldDecl = FieldDecl;

FieldDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.type, this.names, this.semi);
};


function PrecisionStmt(token) {
    Node.call(this);

    this.token = token;
    this.qualifier = null;
    this.type = null;

    this.semi = null;
}

PrecisionStmt.prototype = Node.create('PrecisionStmt', PrecisionStmt);
exports.PrecisionStmt = PrecisionStmt;

PrecisionStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.qualifier,
                                   this.type,
                                   this.semi);
};


function InvariantDecl(token) {
    Node.call(this);

    this.token = token;
    this.names = [];

    this.semi = null;
}

InvariantDecl.prototype = Node.create('InvariantDecl', InvariantDecl);
exports.InvariantDecl = InvariantDecl;

InvariantDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.names, this.semi);
};


function VariableDecl(type) {
    Node.call(this);

    this.type = type;
    this.names = [];

    this.semi = null;
}

VariableDecl.prototype = Node.create('VariableDecl', VariableDecl);
exports.VariableDecl = VariableDecl;

VariableDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.type, this.names, this.semi);
};


function TypeDecl(type) {
    Node.call(this);

    this.type = type;
    this.semi = null;
}

TypeDecl.prototype = Node.create('TypeDecl', TypeDecl);
exports.TypeDecl = TypeDecl;

TypeDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.type, this.semi);
};


function ParamDecl() {
    Node.call(this);

    this.type = null;
    this.name = null;
    this.qualifier = null;

    this.isArray = false;
    this.arraySize = null;
    this.leftBracket = null;
    this.rightBracket = null;
}

ParamDecl.prototype = Node.create('ParamDecl', ParamDecl);
exports.ParamDecl = ParamDecl;

ParamDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.type,
                                   this.name,
                                   this.qualifier,
                                   this.arraySize,
                                   this.leftBracket,
                                   this.rightBracket);
};


function Named(name, decl) {
    Node.call(this);

    this.name = name;
    this.decl = decl;
    this.type = null;

    this.initialAssign = null;
    this.initialValue = null;

    this.isArray = false;
    this.arraySize = null;
    this.leftBracket = null;
    this.rightBracket = null;
}

Named.prototype = Node.create('Named', Named);
exports.Named = Named;

Named.prototype.location = function() {
    return glsl.source.Range.spans(this.name,
                                   this.initialAssign,
                                   this.initialValue,
                                   this.arraySize,
                                   this.leftBracket,
                                   this.rightBracket);
};


function FunctionHeader(type, name) {
    Node.call(this);

    this.type = type;
    this.name = name;
    this.parameters = [];
    this.leftParen = null;
    this.rightParen = null;
}

FunctionHeader.prototype = Node.create('FunctionHeader', FunctionHeader);
exports.FunctionHeader = FunctionHeader;

FunctionHeader.prototype.location = function() {
    return glsl.source.Range.spans(this.type,
                                   this.name,
                                   this.parameters,
                                   this.leftParen,
                                   this.rightParen);
};

FunctionHeader.signatureFromNames = function(name, argnames) {
    var ret = name + '(';

    for (var i = 0; i < argnames.length; i++) {
        var item = argnames[i];

        if (i !== 0) {
            ret += ',';
        }

        ret += item;
    }

    return ret + ')';
};

FunctionHeader.prototype.signature = function() {
    var argnames = [];

    for (var i = 0; i < this.parameters.length; i++) {
        var param = this.parameters[i];

        if (param.type.token.id == Tn.T_VOID) {
            continue;
        }

        argnames.push(param.type.token.text);
    }

    return FunctionHeader.signatureFromNames(this.name.text, argnames);
};

function FunctionProto(header) {
    Node.call(this);

    this.header = header;
    this.isBuiltin = false;
    this.semi = null;
}

FunctionProto.prototype = Node.create('FunctionProto', FunctionProto);
exports.FunctionProto = FunctionProto;

FunctionProto.prototype.location = function() {
    return glsl.source.Range.spans(this.header.location(), this.semi);
};

function FunctionDef(header) {
    Node.call(this);

    this.header = header;
    this.body = null;
}

FunctionDef.prototype = Node.create('FunctionDef', FunctionDef);
exports.FunctionDef = FunctionDef;

FunctionDef.prototype.location = function() {
    return glsl.source.Range.spans(this.header, this.body);
};

function Block() {
    Node.call(this);

    this.rightBrace = null;
    this.leftBrace = null;
    this.body = [];
    this.newScope = true;
}

Block.prototype = Node.create('Block', Block);
exports.Block = Block;

Block.prototype.location = function() {
    return glsl.source.Range.spans(this.rightBrace, this.body, this.leftBrace);
};

function EmptyStmt(semi) {
    Node.call(this);

    this.semi = semi;
}

EmptyStmt.prototype = Node.create('EmptyStmt', EmptyStmt);
exports.EmptyStmt = EmptyStmt;

EmptyStmt.prototype.location = function() {
    return this.semi.location.copy();
};

function ExpressionStmt(expr) {
    Node.call(this);

    this.expression = expr;
    this.semi = null;
}

ExpressionStmt.prototype = Node.create('ExpressionStmt', ExpressionStmt);
exports.ExpressionStmt = ExpressionStmt;

ExpressionStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.expression, this.semi);
};

function ExpressionListStmt() {
    Node.call(this);

    this.expressions = [];
    this.semi = null;
}

ExpressionListStmt.prototype = Node.create('ExpressionListStmt', ExpressionListStmt);
exports.ExpressionListStmt = ExpressionListStmt;

ExpressionListStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.expressions, this.semi);
};


function SelectionStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.leftParen = null;
    this.condition = null;
    this.rightParen = null;
    this.body = null;
    this.els = null;
}

SelectionStmt.prototype = Node.create('SelectionStmt', SelectionStmt);
exports.SelectionStmt = SelectionStmt;

SelectionStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.leftParen,
                                   this.condition,
                                   this.rightParen,
                                   this.body,
                                   this.els);
};


function SelectionElseStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.body = null;
}

SelectionElseStmt.prototype = Node.create('SelectionElseStmt', SelectionElseStmt);
exports.SelectionElseStmt = SelectionElseStmt;

SelectionElseStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.body);
};


function WhileStmt(tok) {
    Node.call(this);

    this.token = tok;

    this.leftParen = null;
    this.condition = null;
    this.rightParen = null;
    this.body = null;
}

WhileStmt.prototype = Node.create('WhileStmt', WhileStmt);
exports.WhileStmt = WhileStmt;

WhileStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.leftParen,
                                   this.condition,
                                   this.rightParen,
                                   this.body);
};


function DoStmt(dtok) {
    Node.call(this);

    this.doToken = dtok;
    this.whileToken = null;

    this.leftParen = null;
    this.condition = null;
    this.rightParen = null;
    this.body = null;
}

DoStmt.prototype = Node.create('DoStmt', DoStmt);
exports.DoStmt = DoStmt;

DoStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.doToken,
                                   this.whileToken,
                                   this.leftParen,
                                   this.condition,
                                   this.rightParen,
                                   this.body);
};


function ForStmt(tok) {
    Node.call(this);

    this.token = tok;

    this.leftParen = null;
    this.init = null;
    this.rest = null;
    this.rightParen = null;
    this.body = null;
}

ForStmt.prototype = Node.create('ForStmt', ForStmt);
exports.ForStmt = ForStmt;

ForStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.leftParen,
                                   this.init,
                                   this.rest,
                                   this.rightParen,
                                   this.body);
};


function ForRestStmt(cond) {
    Node.call(this);

    this.condition = cond;
    this.semi = null;
    this.expression = null;
}

ForRestStmt.prototype = Node.create('ForRestStmt', ForRestStmt);
exports.ForRestStmt = ForRestStmt;

ForRestStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.condition, this.semi, this.expression);
};


function ContinueStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.semi = null;
}

ContinueStmt.prototype = Node.create('ContinueStmt', ContinueStmt);
exports.ContinueStmt = ContinueStmt;

ContinueStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.semi);
};


function BreakStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.semi = null;
}

BreakStmt.prototype = Node.create('BreakStmt', BreakStmt);
exports.BreakStmt = BreakStmt;

BreakStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.semi);
};


function ReturnStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.expression = null;
    this.semi = null;
}

ReturnStmt.prototype = Node.create('ReturnStmt', ReturnStmt);
exports.ReturnStmt = ReturnStmt;

ReturnStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.expression, this.semi);
};


function DiscardStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.semi = null;
}

DiscardStmt.prototype = Node.create('DiscardStmt', DiscardStmt);
exports.DiscardStmt = DiscardStmt;

DiscardStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token, this.semi);
};


function AssignmentExpr(lexpr) {
    Node.call(this);

    this.lhs = lexpr;
    this.op = null;
    this.rhs = null;
}

AssignmentExpr.prototype = Node.create('AssignmentExpr', AssignmentExpr);
exports.AssignmentExpr = AssignmentExpr;

AssignmentExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.lhs, this.op, this.rhs);
};

function TernaryExpr(condition) {
    Node.call(this);

    this.condition = condition;
    this.questionToken = null;
    this.trueExpression = null;
    this.colonToken = null;
    this.falseExpression = null;
}

TernaryExpr.prototype = Node.create('TernaryExpr', TernaryExpr);
exports.TernaryExpr = TernaryExpr;

TernaryExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.condition,
                                   this.questionToken,
                                   this.trueExpression,
                                   this.colonToken,
                                   this.falseExpression);
};

function BinOpExpr(lhs, op, rhs) {
    Node.call(this);

    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
}

BinOpExpr.prototype = Node.create('BinOpExpr', BinOpExpr);
exports.BinOpExpr = BinOpExpr;

BinOpExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.lhs, this.op, this.rhs);
};


function UnaryOpExpr(op, rhs) {
    Node.call(this);

    this.op = op;
    this.expression = rhs;
}

UnaryOpExpr.prototype = Node.create('UnaryOpExpr', UnaryOpExpr);
exports.UnaryOpExpr = UnaryOpExpr;

UnaryOpExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.op, this.expression);
};


function UnaryPostfixOpExpr(op, rhs) {
    Node.call(this);

    this.op = op;
    this.expression = rhs;
}

UnaryPostfixOpExpr.prototype = Node.create('UnaryPostfixOpExpr', UnaryPostfixOpExpr);
exports.UnaryPostfixOpExpr = UnaryPostfixOpExpr;

UnaryPostfixOpExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.op, this.expression);
};


function ConstantExpr(token) {
    Node.call(this);

    this.token = token;
}

ConstantExpr.prototype = Node.create('ConstantExpr', ConstantExpr);
exports.ConstantExpr = ConstantExpr;

ConstantExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.token);
};


function GroupExpr() {
    Node.call(this);

    this.leftParen = null;
    this.expression = null;
    this.rightParen = null;
}

GroupExpr.prototype = Node.create('GroupExpr', GroupExpr);
exports.GroupExpr = GroupExpr;

GroupExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.leftParen, this.expression, this.rightParen);
};


function VariableExpr(name) {
    Node.call(this);

    this.name = name;
}

VariableExpr.prototype = Node.create('VariableExpr', VariableExpr);
exports.VariableExpr = VariableExpr;

VariableExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.name);
};


function FunctionCallExpr(name) {
    Node.call(this);

    this.name = name;
    this.leftParen = null;
    this.rightParen = null;
    this.arguments = [];
}

FunctionCallExpr.prototype = Node.create('FunctionCallExpr', FunctionCallExpr);
exports.FunctionCallExpr = FunctionCallExpr;

FunctionCallExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.name, this.leftParen, this.rightParen, this.arguments);
};


function FieldSelectionExpr(expr, op) {
    Node.call(this);

    this.expression = expr;
    this.op = op;

    this.selector = null;
}

FieldSelectionExpr.prototype = Node.create('FieldSelectionExpr', FieldSelectionExpr);
exports.FieldSelectionExpr = FieldSelectionExpr;

FieldSelectionExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.expression, this.op, this.selector);
};


function IndexExpr(expr) {
    Node.call(this);

    this.expression = expr;

    this.rightBracket = null;
    this.index = null;
    this.leftBracket = null;
}

IndexExpr.prototype = Node.create('IndexExpr', IndexExpr);
exports.IndexExpr = IndexExpr;

IndexExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.expression, this.rightBracket, this.index, this.leftBracket);
};


function NoMatch(tok) {
    Node.call(this);

    this.token = tok;
}

NoMatch.prototype = Node.create('NoMatch', NoMatch);
exports.NoMatch = NoMatch;

NoMatch.prototype.location = function() {
    return glsl.source.Range.spans(this.token);
};


function Parser(source, type, options) {
    Node.call(this);

    if (typeof options === 'undefined') {
        options = {};
    }

    if (typeof options.preprocessor === 'undefined') {
        options.preprocessor = {};
    }

    this._preprocessor = new glsl.preprocessor.Preprocessor(source, type, options.preprocessor);
    this._t = new Tn(this._preprocessor);

    this._errors = [];

    this.type = type;
    this.body = [];

    this.comments = [];

    this._parseTu();
    this.complete();
}

Parser.prototype = Node.create('Parser', Parser);

Parser.prototype.marshal = function(ctx) {
    var ret = Node.prototype.marshal.call(this, ctx);

    if (this._errors.length !== 0) {
        ret.errors = this._marshalArray(this._errors, ctx);
    }

    return ret;
};

Parser.prototype._requireOneOfError = function(ids, tok) {
    var loc;
    var got;

    if (tok.id == Tn.T_EOF) {
        loc = this._t.location().toRange();
        got = 'nothing';
    } else {
        loc = tok.location;
        got = this._t.tokenName(tok.id);
    }

    var choices = [];

    for (var i = 0; i < ids.length; i++) {
        choices.push(this._t.tokenName(ids[i]));
    }

    if (choices.length > 1) {
        choices = choices.slice(0, choices.length - 1).join(', ') + ' or ' + choices[choices.length - 1];

        this._error(loc, 'expected one of ' + choices + ', but got ' + got);
    } else {
        this._error(loc, 'expected ' + choices[0] + ', but got ' + got);
    }

    this._t.unconsume(tok);
    return null;
};

Parser.prototype._requireOneOf = function(ids) {
    var tok = this._t.next();

    for (var i = 0; i < ids.length; i++) {
        if (tok.id == ids[i]) {
            return tok;
        }
    }

    return this._requireOneOfError(ids, tok);
};

Parser.prototype._matchOneOf = function(matchers, tok) {
    var retf = function(m, tok) {
        return m.call(this, tok, ret);
    };

    for (var i = 0; i < matchers.length; i++) {
        var m = matchers[i];

        var ret = this._match(m, tok);

        if (ret) {
            return retf.bind(this, m);
        }
    }

    return false;
};

function matchOneOf(f, oneof) {
    for (var i = 0; i < oneof.length; i++) {
        var m = oneof[i];

        if (typeof m == 'undefined') {
            throw new Error(['undefined rule for', f]);
        }

        if (typeof m.expected == 'undefined') {
            throw new Error(['undefined .expected for ', f, m]);
        }
    }

    f.match = function(tok) {
        return this._matchOneOf(oneof, tok);
    };

    f.expected = function() {
        var ret = [];

        for (var i = 0; i < oneof.length; i++) {
            ret = ret.concat(oneof[i].expected.call(this));
        }

        return ret;
    };
}

Parser.prototype._parseBinopExpression = function(tok, m, expr, opid, rule) {
    var ret;

    if (rule == this._parseUnaryExpression && typeof expr != 'undefined') {
        ret = expr;
    } else {
        ret = rule.call(this, tok, m, expr);
    }

    if (ret.incomplete) {
        return ret;
    }

    tok = this._t.peek();

    while (opid(tok.id)) {
        var op = tok;

        // consume peeked token
        this._t.next();

        var rhs = this._parseRule(rule, this._t.next());

        ret = new BinOpExpr(ret, op, rhs);

        if (rhs.incomplete) {
            return ret;
        }

        ret.complete();
        tok = this._t.peek();
    }

    return ret;
};

Parser.prototype._parseFunctionCall = function(tok) {
    var cl = new FunctionCallExpr(tok);

    cl.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (cl.leftParen === null) {
        return cl;
    }

    var n = this._t.peek();

    if (this._match(this._parseAssignmentExpression, n)) {
        while (true) {
            var ret = this._parseRule(this._parseAssignmentExpression, this._t.next());

            cl.arguments.push(ret);

            if (ret.incomplete) {
                return cl;
            }

            n = this._t.peek();

            if (n.id != Tn.T_COMMA) {
                break;
            }

            // consume comma
            this._t.next();
        }
    } else if (n.id == Tn.T_VOID) {
        // consume peeked token
        cl.arguments = [this._t.next()];
    }

    cl.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

    if (cl.rightParen === null) {
        return cl;
    }

    return cl.complete();
};

Parser.prototype._parseFunctionIdentifier = function(tok) {
    return (new Named(tok, null)).complete();
};

Parser.prototype._isPrimitiveType = function(id) {
    switch (id) {
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
    case Tn.T_VEC2:
    case Tn.T_VEC3:
    case Tn.T_VEC4:
    case Tn.T_BVEC2:
    case Tn.T_BVEC3:
    case Tn.T_BVEC4:
    case Tn.T_IVEC2:
    case Tn.T_IVEC3:
    case Tn.T_IVEC4:
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
    case Tn.T_SAMPLER2D:
    case Tn.T_SAMPLERCUBE:
        return true;
    }

    return false;
};

Parser.prototype._parseFunctionIdentifier.match = function(tok) {
    return this._isPrimitiveType(tok.id) || tok.id == Tn.T_IDENTIFIER;
};

Parser.prototype._parsePrimaryExpression = function(tok) {
    if (this._parseFunctionIdentifier.match.call(this, tok)) {
        var n = this._t.peek();

        if (n.id == Tn.T_LEFT_PAREN) {
            return this._parseFunctionCall(tok);
        }

        return (new VariableExpr(tok)).complete();
    }

    switch (tok.id) {
    case Tn.T_INTCONSTANT:
    case Tn.T_FLOATCONSTANT:
    case Tn.T_BOOLCONSTANT:
        return (new ConstantExpr(tok)).complete();
    case Tn.T_LEFT_PAREN:
        var grp = new GroupExpr();

        grp.leftParen = tok;
        grp.expression = this._parseRule(this._parseExpression, this._t.next());

        if (grp.expression.incomplete) {
            return grp;
        }

        grp.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

        if (grp.rightParen === null) {
            return grp;
        }

        return grp.complete();
    }

    return new NoMatch(tok);
};

Parser.prototype._parsePrimaryExpression.match = function(tok) {
    switch (tok.id) {
    case Tn.T_INTCONSTANT:
    case Tn.T_FLOATCONSTANT:
    case Tn.T_BOOLCONSTANT:
    case Tn.T_LEFT_PAREN:
        return true;
    }

    return this._match(this._parseFunctionIdentifier, tok);
};

Parser.prototype._parsePrimaryExpression.expected = function() {
    return ['identifier', 'integer', 'float', 'bool', 'grouped expression'];
};

Parser.prototype._parsePostfixExpression = function(tok, m) {
    var expr = this._parsePrimaryExpression(tok, m);

    if (expr.incomplete) {
        return expr;
    }

    tok = this._t.peek();

    while (tok.id != Tn.T_EOF) {
        switch (tok.id) {
        case Tn.T_LEFT_BRACKET:
            // consume peeked token
            this._t.next();

            expr = new IndexExpr(expr);
            expr.leftBracket = tok;

            expr.index = this._parseRule(this._parseExpression, this._t.next());

            if (expr.index.incomplete) {
                break;
            }

            expr.rightBracket = this._requireOneOf([Tn.T_RIGHT_BRACKET]);

            if (expr.rightBracket === null) {
                break;
            }

            expr.complete();
            break;
        case Tn.T_DOT:
            // consume peeked token
            this._t.next();

            expr = new FieldSelectionExpr(expr, tok);

            expr.selector = this._requireOneOf([Tn.T_IDENTIFIER]);

            if (expr.selector === null) {
                break;
            }

            expr.complete();
            break;
        case Tn.T_INC_OP:
        case Tn.T_DEC_OP:
            // consume peeked token
            this._t.next();

            expr = (new UnaryPostfixOpExpr(tok, expr)).complete();
            break;
        default:
            tok = null;
            break;
        }

        if (tok === null) {
            break;
        }

        tok = this._t.peek();
    }

    return expr;
};

Parser.prototype._parsePostfixExpression.match = Parser.prototype._parsePrimaryExpression.match;

Parser.prototype._parsePostfixExpression.expected = Parser.prototype._parsePrimaryExpression.expected;

Parser.prototype._parseUnaryExpression = function(tok, m) {
    switch (tok.id) {
    case Tn.T_INC_OP:
    case Tn.T_DEC_OP:
    case Tn.T_PLUS:
    case Tn.T_DASH:
    case Tn.T_BANG:
    case Tn.T_TILDE:
        var expr = this._parseRule(this._parseUnaryExpression, this._t.next());
        var ret = new UnaryOpExpr(tok, expr);

        if (!expr.incomplete) {
            ret.complete();
        }

        return ret;
    }

    return this._parsePostfixExpression(tok, m);
};

Parser.prototype._parseUnaryExpression.match = function(tok) {
    switch (tok.id) {
    case Tn.T_INC_OP:
    case Tn.T_DEC_OP:
    case Tn.T_PLUS:
    case Tn.T_DASH:
    case Tn.T_BANG:
    case Tn.T_TILDE:
        return true;
    }

    return this._match(this._parsePostfixExpression, tok);
};

Parser.prototype._parseUnaryExpression.expected = function() {
    return ['unary operator'].concat(this._parsePostfixExpression.expected.call(this));
};

Parser.prototype._parseMultiplicativeExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_STAR ||
                                                               id == Tn.T_SLASH ||
                                                               id == Tn.T_PERCENT; },
                                        this._parseUnaryExpression);
};

Parser.prototype._parseMultiplicativeExpression.match = Parser.prototype._parseUnaryExpression.match;

Parser.prototype._parseMultiplicativeExpression.expected = Parser.prototype._parseUnaryExpression.expected;


Parser.prototype._parseAdditiveExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_PLUS ||
                                                               id == Tn.T_DASH; },
                                        this._parseMultiplicativeExpression);
};

Parser.prototype._parseAdditiveExpression.match = Parser.prototype._parseMultiplicativeExpression.match;

Parser.prototype._parseAdditiveExpression.expected = Parser.prototype._parseMultiplicativeExpression.expected;


Parser.prototype._parseShiftExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_LEFT_OP ||
                                                               id == Tn.T_RIGHT_OP; },
                                        this._parseAdditiveExpression);
};

Parser.prototype._parseShiftExpression.match = Parser.prototype._parseAdditiveExpression.match;

Parser.prototype._parseShiftExpression.expected = Parser.prototype._parseAdditiveExpression.expected;


Parser.prototype._parseRelationalExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_LEFT_ANGLE ||
                                                               id == Tn.T_RIGHT_ANGLE ||
                                                               id == Tn.T_LE_OP ||
                                                               id == Tn.T_GE_OP; },
                                        this._parseShiftExpression);
};

Parser.prototype._parseRelationalExpression.match = Parser.prototype._parseShiftExpression.match;

Parser.prototype._parseRelationalExpression.expected = Parser.prototype._parseShiftExpression.expected;


Parser.prototype._parseEqualityExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_EQ_OP || id == Tn.T_NE_OP; },
                                        this._parseRelationalExpression);
};

Parser.prototype._parseEqualityExpression.match = Parser.prototype._parseRelationalExpression.match;

Parser.prototype._parseEqualityExpression.expected = Parser.prototype._parseRelationalExpression.expected;

Parser.prototype._parseAndExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AMPERSAND; },
                                        this._parseEqualityExpression);
};


Parser.prototype._parseAndExpression.match = Parser.prototype._parseEqualityExpression.match;

Parser.prototype._parseAndExpression.expected = Parser.prototype._parseEqualityExpression.expected;


Parser.prototype._parseExclusiveOrExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_CARET; },
                                        this._parseAndExpression);
};

Parser.prototype._parseExclusiveOrExpression.match = Parser.prototype._parseAndExpression.match;

Parser.prototype._parseExclusiveOrExpression.expected = Parser.prototype._parseAndExpression.expected;


Parser.prototype._parseInclusiveOrExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_VERTICAL_BAR; },
                                        this._parseExclusiveOrExpression);
};

Parser.prototype._parseInclusiveOrExpression.match = Parser.prototype._parseExclusiveOrExpression.match;

Parser.prototype._parseInclusiveOrExpression.expected = Parser.prototype._parseExclusiveOrExpression.expected;

Parser.prototype._parseLogicalAndExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AND_OP; },
                                        this._parseInclusiveOrExpression);
};

Parser.prototype._parseLogicalAndExpression.match = Parser.prototype._parseInclusiveOrExpression.match;

Parser.prototype._parseLogicalAndExpression.expected = Parser.prototype._parseInclusiveOrExpression.expected;

Parser.prototype._parseLogicalXorExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_XOR_OP; },
                                        this._parseLogicalAndExpression);
};

Parser.prototype._parseLogicalXorExpression.match = Parser.prototype._parseLogicalAndExpression.match;

Parser.prototype._parseLogicalXorExpression.expected = Parser.prototype._parseLogicalAndExpression.expected;

Parser.prototype._parseLogicalOrExpression = function(tok, m, expr) {
    return this._parseBinopExpression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_OR_OP; },
                                        this._parseLogicalXorExpression);
};

Parser.prototype._parseLogicalOrExpression.match = Parser.prototype._parseLogicalXorExpression.match;

Parser.prototype._parseLogicalOrExpression.expected = Parser.prototype._parseLogicalXorExpression.expected;

Parser.prototype._parseUnaryConditionalExpressionRest = function(expr) {
    if (expr.incomplete) {
        return expr;
    }

    var n = this._t.peek();

    if (n.id == Tn.T_QUESTION) {
        var ret = new TernaryExpr(expr);
        ret.questionToken = this._t.next();

        ret.trueExpression = this._parseRule(this._parseExpression, this._t.next());

        if (ret.trueExpression.incomplete) {
            return ret;
        }

        ret.colonToken = this._requireOneOf([Tn.T_COLON]);

        if (ret.colonToken === null) {
            return ret;
        }

        ret.falseExpression = this._parseRule(this._parseAssignmentExpression, this._t.next());

        if (ret.falseExpression.incomplete) {
            return ret;
        }

        return ret.complete();
    }

    return expr;
};

Parser.prototype._parseUnaryConditionalExpression = function(expr) {
    var tok, m;

    var expr = this._parseLogicalOrExpression(tok, m, expr);
    return this._parseUnaryConditionalExpressionRest(expr);
};

Parser.prototype._parseConditionalExpression = function(tok, m) {
    var expr = this._parseLogicalOrExpression(tok, m);
    return this._parseUnaryConditionalExpressionRest(expr);
};

Parser.prototype._parseConditionalExpression.match = Parser.prototype._parseLogicalOrExpression.match;

Parser.prototype._parseConditionalExpression.expected = Parser.prototype._parseLogicalOrExpression.expected;

Parser.prototype._parseAssignmentOperator = function(tok) {
    return {token: tok, incomplete: false};
};

Parser.prototype._parseAssignmentOperator.match = function(tok) {
    switch (tok.id) {
    case Tn.T_EQUAL:
    case Tn.T_MUL_ASSIGN:
    case Tn.T_DIV_ASSIGN:
    case Tn.T_MOD_ASSIGN:
    case Tn.T_ADD_ASSIGN:
    case Tn.T_SUB_ASSIGN:
    case Tn.T_LEFT_ASSIGN:
    case Tn.T_RIGHT_ASSIGN:
    case Tn.T_AND_ASSIGN:
    case Tn.T_XOR_ASSIGN:
    case Tn.T_OR_ASSIGN:
        return true;
    }

    return false;
};

Parser.prototype._parseAssignmentOperator.expected = function() {
    return ['assignment operator'];
};

Parser.prototype._parseUnaryAssignmentExpression = function(expr) {
    var ret = new AssignmentExpr(expr);
    var op = this._parseRule(this._parseAssignmentOperator, this._t.next());

    if (op.incomplete) {
        return ret;
    }

    ret.op = op.token;

    ret.rhs = this._parseRule(this._parseAssignmentExpression, this._t.next());

    if (!ret.rhs.incomplete) {
        ret.complete();
    }

    return ret;
};

Parser.prototype._parseUnaryAssignmentExpression.match = Parser.prototype._parseUnaryExpression.match;

Parser.prototype._parseUnaryAssignmentExpression.expected = Parser.prototype._parseUnaryExpression.expected;

Parser.prototype._parseAssignmentExpression = function(tok, m) {
    var expr = this._parseUnaryExpression(tok, m);

    if (expr.incomplete) {
        return expr;
    }

    var n = this._t.peek();
    var m = this._match(this._parseAssignmentOperator, n);

    if (m) {
        return this._parseUnaryAssignmentExpression(expr);
    } else {
        return this._parseUnaryConditionalExpression(expr);
    }
};

Parser.prototype._parseAssignmentExpression.match = Parser.prototype._parseUnaryExpression.match;

Parser.prototype._parseAssignmentExpression.expected = Parser.prototype._parseUnaryExpression.expected;

Parser.prototype._parseExpression = function(tok, m) {
    var expr = this._parseAssignmentExpression(tok, m);

    if (expr.incomplete) {
        return expr;
    }

    tok = this._t.peek();

    if (tok.id != Tn.T_COMMA) {
        return expr;
    }

    var ret = new ExpressionListStmt();
    ret.expressions.push(expr);

    while (tok.id == Tn.T_COMMA) {
        // consume peeked comma
        this._t.next();

        tok = this._t.next();

        expr = this._parseAssignmentExpression(tok, m);
        ret.expressions.push(expr);

        if (expr.incomplete) {
            return expr;
        }

        tok = this._t.peek();
    }

    return ret.complete();
};

Parser.prototype._parseExpression.match = Parser.prototype._parseAssignmentExpression.match;
Parser.prototype._parseExpression.expected = Parser.prototype._parseAssignmentExpression.expected;

Parser.prototype._parseConstantExpression = Parser.prototype._parseConditionalExpression;
Parser.prototype._parseConstantExpression.match = Parser.prototype._parseConditionalExpression.match;
Parser.prototype._parseConstantExpression.expected = Parser.prototype._parseConditionalExpression.expected;

Parser.prototype._parseFieldDeclarationName = function(tok) {
    var name = tok;

    var ret = new Named(name, null);
    ret.complete();

    this._parseOptionalArraySpec(ret);

    return ret;
};

Parser.prototype._parseFieldDeclarationName.match = function(tok) {
    return tok.id == Tn.T_IDENTIFIER;
};

Parser.prototype._parseFieldDeclarationName.expected = function() {
    return ['field name'];
};

Parser.prototype._parseFieldDeclaration = function(tok, m) {
    var type = m(tok);
    var sdecl = new FieldDecl(type);

    if (type.incomplete) {
        return sdecl;
    }

    tok = this._t.next();
    var first = true;

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_SEMICOLON) {
        if (!first) {
            if (tok.id != Tn.T_COMMA) {
                this._requireOneOfError([Tn.T_COMMA], tok);
                return sdecl;
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var fname = this._parseRule(this._parseFieldDeclarationName, tok);

        fname.decl = sdecl;
        fname.type = type;

        sdecl.names.push(fname);

        if (fname.incomplete) {
            return sdecl;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_SEMICOLON) {
        this._requireOneOfError([Tn.T_SEMICOLON], tok);
        return sdecl;
    }

    sdecl.semi = tok;
    return sdecl.complete();
};

Parser.prototype._parseStructSpecifier = function(tok) {
    var lb = this._t.next();

    var sdl = new StructDecl(tok);

    if (lb.id != Tn.T_IDENTIFIER && lb.id != Tn.T_LEFT_BRACE ) {
        this._requireOneOfError([Tn.T_IDENTIFIER, Tn.T_LEFT_BRACE], lb);
        return sdl;
    }

    var name = null;

    if (lb.id == Tn.T_IDENTIFIER) {
        name = lb;
        lb = this._t.next();
    }

    sdl.name = name;

    if (lb.id != Tn.T_LEFT_BRACE) {
        this._requireOneOfError([Tn.T_LEFT_BRACE], lb);
        return sdl;
    }

    sdl.leftBrace = lb;

    tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var decl = this._parseRule(this._parseFieldDeclaration, tok);

        if (!NoMatch.prototype.isPrototypeOf(decl)) {
            sdl.fields.push(decl);
        }

        if (decl.incomplete) {
            return sdl;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._requireOneOfError([Tn.T_RIGHT_BRACE], tok);
        return sdl;
    }

    sdl.rightBrace = tok;
    return sdl.complete();
};

Parser.prototype._parseStructSpecifier.match = function(tok) {
    return tok.id == Tn.T_STRUCT;
};

Parser.prototype._parseTypeSpecifierNoPrecImpl = function(tok) {
    return (new TypeRef(tok)).complete();
};

Parser.prototype._parseTypeSpecifierNoPrec = function(tok, m) {
    return m(tok);
};

Parser.prototype._parseTypeSpecifierNoPrec.match = function(tok) {
    switch (tok.id) {
    case Tn.T_VOID:
    case Tn.T_FLOAT:
    case Tn.T_INT:
    case Tn.T_BOOL:
    case Tn.T_VEC2:
    case Tn.T_VEC3:
    case Tn.T_VEC4:
    case Tn.T_BVEC2:
    case Tn.T_BVEC3:
    case Tn.T_BVEC4:
    case Tn.T_IVEC2:
    case Tn.T_IVEC3:
    case Tn.T_IVEC4:
    case Tn.T_MAT2:
    case Tn.T_MAT3:
    case Tn.T_MAT4:
    case Tn.T_SAMPLER2D:
    case Tn.T_SAMPLERCUBE:
    case Tn.T_IDENTIFIER:
        return this._parseTypeSpecifierNoPrecImpl;
    }

    if (this._match(this._parseStructSpecifier, tok)) {
        return this._parseStructSpecifier.bind(this);
    }
};

Parser.prototype._parseTypeSpecifierNoPrec.expected = function() {
    return ['builtin type', 'user type identifier'];
};

Parser.prototype._parseTypeSpecifier = function(tok, m) {
    return m(tok);
};

Parser.prototype._parsePrecisionQualifier = function(tok) {
    return tok;
};

Parser.prototype._parsePrecisionQualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_HIGH_PRECISION:
    case Tn.T_MEDIUM_PRECISION:
    case Tn.T_LOW_PRECISION:
        return true;
    }

    return false;
};

Parser.prototype._parsePrecisionQualifier.expected = function() {
    return ['highp', 'mediump', 'lowp'];
};

Parser.prototype._parseTypePrecisionQualifier = function(tok) {
    var type = this._parseRule(this._parseTypeSpecifierNoPrec, this._t.next());

    type = TypeRef.wrapDecl(type);

    type.qualifiers.unshift(tok);
    return type;
};

Parser.prototype._parseTypePrecisionQualifier.match = Parser.prototype._parsePrecisionQualifier.match;

Parser.prototype._parseTypePrecisionQualifier.expected = Parser.prototype._parsePrecisionQualifier.expected;

matchOneOf(Parser.prototype._parseTypeSpecifier, [
    Parser.prototype._parseTypeSpecifierNoPrec,
    Parser.prototype._parseTypePrecisionQualifier
]);

Parser.prototype._parseFieldDeclaration.match = Parser.prototype._parseTypeSpecifier.match;
Parser.prototype._parseFieldDeclaration.expected = Parser.prototype._parseTypeSpecifier.expected;

Parser.prototype._parseTypeQualifier = function(tok) {
    var node;

    if (tok.id == Tn.T_INVARIANT) {
        var varying = this._requireOneOf([Tn.T_VARYING]);

        if (varying === null) {
            // Should have been followed by varying (invariant IDENT is handled elsewhere).
            // Create empty, incomplete TypeRef.
            node = new TypeRef(null);
        } else {
            node = this._parseRule(this._parseTypeSpecifier, this._t.next());
        }

        node.qualifiers.unshift(varying);
    } else {
        node = this._parseRule(this._parseTypeSpecifier, this._t.next());
        node = TypeRef.wrapDecl(node);
    }

    if (node) {
        node.qualifiers.unshift(tok);
    }

    return node;
};

Parser.prototype._parseTypeQualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONST:
    case Tn.T_ATTRIBUTE:
    case Tn.T_VARYING:
    case Tn.T_INVARIANT:
    case Tn.T_UNIFORM:
        return true;
    }
};

Parser.prototype._parseTypeQualifier.expected = function() {
    return ['const', 'attribute', 'varying', 'invariant', 'uniform'];
};

Parser.prototype._parseFullySpecifiedType = function(tok, m) {
    return m(tok);
};

matchOneOf(Parser.prototype._parseFullySpecifiedType, [
    Parser.prototype._parseTypeSpecifier,
    Parser.prototype._parseTypeQualifier
]);

Parser.prototype._parseOptionalArraySpec = function(ret) {
   var tok = this._t.peek();

    if (tok.id == Tn.T_LEFT_BRACKET) {
        ret.isArray = true;
        ret.leftBracket = tok;

        // consume peeked token
        this._t.next();

        ret.arraySize = this._parseRule(this._parseConstantExpression, this._t.next());

        if (ret.arraySize.incomplete) {
            ret.incomplete = true;
            return true;
        }

        ret.rightBracket = this._requireOneOf([Tn.T_RIGHT_BRACKET]);

        if (ret.rightBracket === null) {
            ret.incomplete = true;
            return true;
        }

        return true;
    } else {
        return false;
    }
};

Parser.prototype._parseParameterDeclarator = function(tok, m) {
    var type = this._parseTypeSpecifier(tok, m);

    var pdecl = new ParamDecl();
    pdecl.type = type;

    if (type.incomplete) {
        return pdecl;
    }

    tok = this._t.peek();

    if (tok.id == Tn.T_IDENTIFIER) {
        pdecl.name = this._t.next();
    }

    pdecl.complete();
    this._parseOptionalArraySpec(pdecl);

    return pdecl;
};

Parser.prototype._parseParameterDeclarator.match = Parser.prototype._parseTypeSpecifier.match;
Parser.prototype._parseParameterDeclarator.expected = Parser.prototype._parseTypeSpecifier.expected;

Parser.prototype._parseParameterQualifier = function(tok) {
    var ret = this._parseRule(this._parseParameterDeclarator, this._t.next());
    ret.qualifier = tok;

    return ret;
};

Parser.prototype._parseParameterQualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_IN:
    case Tn.T_OUT:
    case Tn.T_INOUT:
        return true;
    }

    return false;
};

Parser.prototype._parseParameterQualifier.expected = function() {
    return ['in', 'out', 'inout'];
};

Parser.prototype._parseParameterTypeQualifier = function(tok, m) {
    var q = tok;

    tok = this._t.next();

    m = this._match(this._parseParameterQualifier, tok);

    var decl;

    if (m) {
        decl = this._parseParameterQualifier(tok, m);
    } else {
        decl = this._parseRule(this._parseParameterDeclarator, tok);
    }

    decl.qualifier = q;
    return decl;
};

Parser.prototype._parseParameterTypeQualifier.match = function (tok) {
    return tok.id == Tn.T_CONST;
};

Parser.prototype._parseParameterTypeQualifier.expected = function() {
    return ["const"];
};

Parser.prototype._parseParameterDeclaration = function(tok, m) {
    return m(tok);
};

matchOneOf(Parser.prototype._parseParameterDeclaration, [
    Parser.prototype._parseParameterTypeQualifier,
    Parser.prototype._parseParameterQualifier,
    Parser.prototype._parseParameterDeclarator
]);

Parser.prototype._parseFunctionHeader = function(type, name) {
    var func = new FunctionHeader(type, name);
    func.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (func.leftParen === null) {
        return false;
    }

    var tok = this._t.next();
    var first = true;

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_PAREN) {
        if (!first) {
            if (tok.id != Tn.T_COMMA) {
                this._requireOneOfError([Tn.T_COMMA], tok);
                return func;
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var m = this._parseRule(this._parseParameterDeclaration, tok);
        func.parameters.push(m);

        if (m.incomplete) {
            return func;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_PAREN) {
        this._requireOneOfError([Tn.T_RIGHT_PAREN], tok);
        return func;
    }

    func.rightParen = tok;
    return func.complete();
};

Parser.prototype._syncStatement = function(tok) {
    if (this._isPrimitiveType(tok.id)) {
        return SYNC_OK;
    }

    switch (tok.id) {
    case Tn.T_SEMICOLON:
        return SYNC_OK_CONSUME;
    case Tn.T_PRECISION:
    case Tn.T_ATTRIBUTE:
    case Tn.T_CONST:
    case Tn.T_UNIFORM:
    case Tn.T_VARYING:
    case Tn.T_STRUCT:
    case Tn.T_HIGH_PRECISION:
    case Tn.T_MEDIUM_PRECISION:
    case Tn.T_LOW_PRECISION:
    case Tn.T_PRECISION:
    case Tn.T_RIGHT_BRACE:
    case Tn.T_FOR:
    case Tn.T_DO:
    case Tn.T_WHILE:
    case Tn.T_IF:
    case Tn.T_RETURN:
    case Tn.T_DISCARD:
    case Tn.T_CONTINUE:
    case Tn.T_BREAK:
        return SYNC_OK;
    }

    return SYNC_FAIL;
};

Parser.prototype._parseFunctionDefinition = function(header, lb) {
    var func = new FunctionDef(header);

    if (header.incomplete) {
        return func;
    }

    func.body = new Block();
    func.body.leftBrace = lb;

    var tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var ret = this._parseRule(this._parseStatementNoNewScope, tok);
        func.body.body.push(ret);

        if (ret.incomplete) {
            this._sync(this._syncStatement);
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._requireOneOfError([Tn.T_RIGHT_BRACE], tok);
        return func;
    }

    func.body.rightBrace = tok;
    func.body.complete();

    return func.complete();
};

Parser.prototype._parseFunctionPrototypeOrDefinition = function(type, ident) {
    var ret = this._parseFunctionHeader(type, ident);

    if (ret.incomplete) {
        // return most likely incomplete function definition
        return new FunctionDef(ret);
    }

    var n = this._requireOneOf([Tn.T_SEMICOLON, Tn.T_LEFT_BRACE]);

    if (n === null) {
        // return most likely incomplete function definition
        return new FunctionDef(ret);
    }

    if (n.id == Tn.T_SEMICOLON) {
        var proto = new FunctionProto(ret);

        proto.semi = n;
        return proto.complete();
    } else {
        return this._parseFunctionDefinition(ret, n);
    }
};

Parser.prototype._parseStatementWithScope = function(tok, m) {
    return m(tok);
};

Parser.prototype._parseSelectionRestStatement = function(tok, m) {
    var stmt = this._parseStatementWithScope(tok, m);

    var ret = {body: stmt, els: null, incomplete: true};

    if (stmt.incomplete) {
        return ret;
    }

    var n = this._t.peek();

    if (n.id == Tn.T_ELSE) {
        var selelse = new SelectionElseStmt(n);
        ret.els = selelse;

        // consume peeked token
        this._t.next();

        selelse.body = this._parseRule(this._parseStatementWithScope, this._t.next());

        if (!selelse.body.incomplete) {
            selelse.complete();
            ret.incomplete = false;
        }
    } else {
        ret.incomplete = false;
    }

    return ret;
};

Parser.prototype._parseSelectionStatement = function(tok) {
    var sel = new SelectionStmt(tok);

    sel.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (sel.leftParen === null) {
        return sel;
    }

    tok = this._t.next();

    sel.condition = this._parseRule(this._parseExpression, tok);

    if (sel.condition.incomplete) {
        return sel;
    }

    sel.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

    if (sel.rightParen === null) {
        return sel;
    }

    tok = this._t.next();

    var ret = this._parseRule(this._parseSelectionRestStatement, tok);

    if (!NoMatch.prototype.isPrototypeOf(ret)) {
        sel.body = ret.body;
        sel.els = ret.els;
    }

    if (!ret.incomplete) {
        sel.complete();
    }

    return sel;
};

Parser.prototype._parseSelectionStatement.match = function(tok) {
    return tok.id == Tn.T_IF;
};

Parser.prototype._parseSelectionStatement.expected = function() {
    return ["if"];
};

Parser.prototype._parseConditionVarInit = function(tok, m) {
    var type = this._parseFullySpecifiedType(tok, m);

    type = TypeRef.wrapDecl(type);
    var ret = new VariableDecl(type);

    if (type.incomplete) {
        return ret;
    }

    var ident = this._requireOneOf([Tn.T_IDENTIFIER]);

    if (ident === null) {
        return ret;
    }

    var equal = this._requireOneOf([Tn.T_EQUAL]);

    if (equal === null) {
        return ret;
    }

    var named = new Named(ident, ret);
    named.type = type;
    ret.names.push(named);

    named.initialAssign = equal;

    var init = this._parseRule(this._parseInitializer, this._t.next());
    named.initialValue = init;

    if (!init.incomplete) {
        named.complete();
        ret.complete();
    }

    return ret;
};

Parser.prototype._parseConditionVarInit.match = Parser.prototype._parseFullySpecifiedType.match;
Parser.prototype._parseConditionVarInit.expected = Parser.prototype._parseFullySpecifiedType.expected;

Parser.prototype._parseCondition = function(tok, m) {
    if (tok.id == Tn.T_IDENTIFIER) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            return this._parseConditionVarInit(tok, this._match(this._parseConditionVarInit, tok));
        } else {
            // go for the expression
            return this._parseRule(this._parseExpression, tok);
        }
    }

    // Go for whatever matched
    return m(tok);
};

matchOneOf(Parser.prototype._parseCondition, [
    Parser.prototype._parseConditionVarInit,
    Parser.prototype._parseExpression
]);

Parser.prototype._parseCondition.expected = function() {
    return ["condition expression"];
};

Parser.prototype._parseWhileStatement = function(tok) {
    var ret = new WhileStmt(tok);

    ret.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (ret.leftParen === null) {
        return ret;
    }

    tok = this._t.next();

    ret.condition = this._parseRule(this._parseCondition, tok);

    if (ret.condition.incomplete) {
        return ret;
    }

    ret.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

    if (ret.rightParen === null) {
        return ret;
    }

    ret.body = this._parseRule(this._parseStatementNoNewScope, this._t.next());

    if (!ret.body.incomplete) {
        ret.complete();
    }

    return ret;
};

Parser.prototype._parseWhileStatement.match = function(tok) {
    return tok.id == Tn.T_WHILE;
};

Parser.prototype._parseWhileStatement.expected = function() {
    return ["while"];
};

Parser.prototype._parseDoStatement = function(tok) {
    var ret = new DoStmt(tok);

    var stmt = this._parseRule(this._parseStatementWithScope, this._t.next());
    ret.body = stmt;

    if (stmt.incomplete) {
        return ret;
    }

    ret.whileToken = this._requireOneOf([Tn.T_WHILE]);

    if (ret.whileToken === null) {
        return ret;
    }

    ret.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (ret.leftParen === null) {
        return ret;
    }

    tok = this._t.next();

    ret.condition = this._parseRule(this._parseExpression, tok);

    if (ret.condition.incomplete) {
        return ret;
    }

    ret.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

    if (ret.rightParen === null) {
        return ret;
    }

    ret.semi = this._requireOneOf([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parseDoStatement.match = function(tok) {
    return tok.id == Tn.T_DO;
};

Parser.prototype._parseDoStatement.expected = function() {
    return ["do"];
};

Parser.prototype._parseDeclarationOrExpressionStatement = function(tok, m) {
    // Check for double identifier, should be a declaration
    if (tok.id == Tn.T_IDENTIFIER) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            return this._parseDeclaration(tok, this._match(this._parseDeclaration, tok));
        } else {
            // go for the expression
            return this._parseExpressionStatement(tok, this._match(this._parseExpressionStatement, tok));
        }
    }

    // Check to see if we start with a constructor
    if (this._match(this._parseFunctionIdentifier, tok)) {
        var n = this._t.peek();

        if (n.id == Tn.T_LEFT_PAREN) {
            return this._parseRule(this._parseExpressionStatement, tok);
        }
    }

    var m = this._match(this._parseDeclaration, tok);

    if (m) {
        return this._parseDeclaration(tok, m);
    } else {
        return this._parseRule(this._parseExpressionStatement, tok);
    }
};

Parser.prototype._parseDeclarationOrExpressionStatement.match = function(tok) {
    // Either a declaration or an expression here, but we need lookahead
    var m = this._match(this._parseDeclaration, tok);

    if (!m) {
        m = this._match(this._parseExpressionStatement, tok);
    }

    return m;
};

Parser.prototype._parseDeclarationOrExpressionStatement.expected = function() {
    return ['declaration', 'expression'];
};

Parser.prototype._parseForInitStatement = function(tok, m) {
    return this._parseDeclarationOrExpressionStatement(tok, m);
};

Parser.prototype._parseForInitStatement.match = Parser.prototype._parseDeclarationOrExpressionStatement.match;

Parser.prototype._parseConditionopt = function(tok, m) {
    m = this._match(this._parseCondition, tok);

    if (!m) {
        return null;
    }

    return this._parseCondition(tok, m);
};

Parser.prototype._parseConditionopt.match = function() {
    return true;
};

Parser.prototype._parseForRestStatement = function(tok, m) {
    var copt = this._parseRule(this._parseConditionopt, tok);
    var ret = new ForRestStmt(copt);

    if (copt !== null && copt.incomplete) {
        return ret;
    }

    ret.semi = this._requireOneOf([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    var n = this._t.peek();
    var m = this._match(this._parseExpression, n);

    if (m) {
        ret.expression = this._parseExpression(this._t.next(), m);

        if (ret.expression.incomplete) {
            return ret;
        }
    }

    return ret.complete();
};

Parser.prototype._parseForRestStatement.match = Parser.prototype._parseConditionopt.match;

Parser.prototype._parseForStatement = function(tok) {
    var ret = new ForStmt(tok);

    ret.leftParen = this._requireOneOf([Tn.T_LEFT_PAREN]);

    if (ret.leftParen === null) {
        return ret;
    }

    tok = this._t.next();

    ret.init = this._parseRule(this._parseForInitStatement, tok);

    if (ret.init.incomplete) {
        return ret;
    }

    tok = this._t.next();

    ret.rest = this._parseRule(this._parseForRestStatement, tok);

    if (ret.rest.incomplete) {
        return ret;
    }

    ret.rightParen = this._requireOneOf([Tn.T_RIGHT_PAREN]);

    if (ret.rightParen === null) {
        return ret;
    }

    ret.body = this._parseRule(this._parseStatementNoNewScope, this._t.next());

    if (ret.body.incomplete) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parseForStatement.match = function(tok) {
    return tok.id == Tn.T_FOR;
};

Parser.prototype._parseForStatement.expected = function() {
    return ["for"];
};

Parser.prototype._parseIterationStatement = function(tok, m) {
    return m(tok);
};

matchOneOf(Parser.prototype._parseIterationStatement, [
    Parser.prototype._parseWhileStatement,
    Parser.prototype._parseDoStatement,
    Parser.prototype._parseForStatement
]);

Parser.prototype._parseJumpStatement = function(tok) {
    var ret = null;

    switch (tok.id) {
    case Tn.T_CONTINUE:
        ret = new ContinueStmt(tok);
        break;
    case Tn.T_BREAK:
        ret = new BreakStmt(tok);
        break;
    case Tn.T_RETURN:
        ret = new ReturnStmt(tok);

        var n = this._t.peek();

        if (n !== null && n.id != Tn.T_SEMICOLON) {
            ret.expression = this._parseRule(this._parseExpression, this._t.next());

            if (ret.expression.incomplete) {
                return ret;
            }
        }

        break;
    case Tn.T_DISCARD:
        ret = new DiscardStmt(tok);
        ret.semi = this._requireOneOf([Tn.T_SEMICOLON]);

        if (this.type !== glsl.source.FRAGMENT) {
            this._error(tok.location, 'invalid use of discard outside of fragment shader');
            return ret;
        }

        return ret.complete();
    }

    ret.semi = this._requireOneOf([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parseJumpStatement.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONTINUE:
    case Tn.T_BREAK:
    case Tn.T_RETURN:
    case Tn.T_DISCARD:
        return true;
    }

    return false;
};

Parser.prototype._parseJumpStatement.expected = function() {
    return ['continue', 'break', 'return', 'discard'];
};

Parser.prototype._parseSimpleStatement = function(tok, m) {
    return m(tok);
};

matchOneOf(Parser.prototype._parseSimpleStatement, [
    Parser.prototype._parseDeclarationOrExpressionStatement,
    Parser.prototype._parseSelectionStatement,
    Parser.prototype._parseIterationStatement,
    Parser.prototype._parseJumpStatement
]);

Parser.prototype._parseCompoundStatement = function(tok, newscope) {
    var block = new Block();

    block.newScope = newscope;
    block.leftBrace = tok;

    tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var ret = this._parseRule(this._parseStatementNoNewScope, tok);
        block.body.push(ret);

        if (ret.incomplete) {
            return ret;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._requireOneOfError([Tn.T_RIGHT_BRACE], tok);
        return block;
    }

    block.rightBrace = tok;
    return block.complete();
};


Parser.prototype._parseCompoundStatementWithScope = function(tok) {
    return this._parseCompoundStatement(tok, true);
};

Parser.prototype._parseCompoundStatementWithScope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
};

Parser.prototype._parseCompoundStatementWithScope.expected = function() {
    return ['opening curly brace {'];
};

Parser.prototype._parseCompoundStatementNoNewScope = function(tok) {
    return this._parseCompoundStatement(tok, false);
};

Parser.prototype._parseCompoundStatementNoNewScope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
};

Parser.prototype._parseCompoundStatementNoNewScope.expected = function() {
    return ["opening scope brace {"];
};

Parser.prototype._parseStatementNoNewScope = function(tok, m) {
    return m(tok);
};

matchOneOf(Parser.prototype._parseStatementNoNewScope, [
    Parser.prototype._parseCompoundStatementWithScope,
    Parser.prototype._parseSimpleStatement
]);

matchOneOf(Parser.prototype._parseStatementWithScope, [
    Parser.prototype._parseCompoundStatementNoNewScope,
    Parser.prototype._parseSimpleStatement
]);

Parser.prototype._parseSelectionRestStatement.match = Parser.prototype._parseStatementWithScope.match;

Parser.prototype._parseSelectionRestStatement.expected = Parser.prototype._parseStatementWithScope.expected;

Parser.prototype._parseDeclarationPrecision = function(tok) {
    var ret = new PrecisionStmt(tok);

    ret.qualifier = this._parseRule(this._parsePrecisionQualifier, this._t.next());

    if (ret.qualifier.incomplete) {
        return ret;
    }

    ret.type = this._parseRule(this._parseTypeSpecifierNoPrec, this._t.next());

    if (ret.type.incomplete) {
        return ret;
    }

    ret.semi = this._requireOneOf([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parseInitializer = Parser.prototype._parseAssignmentExpression;
Parser.prototype._parseInitializer.match = Parser.prototype._parseAssignmentExpression.match;
Parser.prototype._parseInitializer.expected = Parser.prototype._parseAssignmentExpression.expected;

Parser.prototype._parseSingleDeclaration = function(type, ident) {
    type = TypeRef.wrapDecl(type);
    var decl = new VariableDecl(type);

    if (type.incomplete) {
        return decl;
    }

    var named = new Named(ident, decl);
    named.type = type;
    decl.names.push(named.complete());

    var n = this._t.peek();

    if (n.id == Tn.T_EOF) {
        return decl.complete();
    }

    if (n.id == Tn.T_EQUAL) {
        // consume peeked token
        this._t.next();

        named.initialAssign = n;
        named.initialValue = this._parseRule(this._parseInitializer, this._t.next());

        if (named.initialValue.incomplete) {
            named.incomplete = true;
            return decl;
        }
    } else {
        this._parseOptionalArraySpec(named);

        if (named.incomplete) {
            return decl;
        }
    }

    return decl.complete();
};

Parser.prototype._parseInitDeclaratorList = function(decl, opts) {
    if (decl.incomplete) {
        return decl;
    }

    decl.incomplete = true;

    var tok = this._t.peek();

    while (tok.id == Tn.T_COMMA) {
        // consume comma
        this._t.next();

        var ident = this._requireOneOf([Tn.T_IDENTIFIER]);

        if (ident === null) {
            return decl;
        }

        if (!opts.array && !opts.equal) {
            decl.names.push(ident);
        } else {

            var name = new Named(ident, decl);
            name.type = decl.type;

            decl.names.push(name);

            var isarray = false;

            tok = this._t.peek();

            if (opts.array) {
                name.complete();

                if (this._parseOptionalArraySpec(name)) {
                    isarray = true;
                }

                if (name.incomplete) {
                    return decl;
                }
            }

            if (!isarray && opts.equal && tok.id == Tn.T_EQUAL) {
                // consume peeked token
                this._t.next();

                name.initialValue = this._parseRule(this._parseInitializer, this._t.next());
                name.initialAssign = tok;

                if (name.initialValue.incomplete) {
                    return decl;
                }
            }

            name.complete();
        }

        tok = this._t.peek();
    }

    decl.semi = this._requireOneOf([Tn.T_SEMICOLON]);

    if (decl.semi === null) {
        return decl;
    }

    return decl.complete();
};

Parser.prototype._parseDeclaration = function(tok, m) {
    var decl = null;

    var opts = {equal: true, array: true};

    if (tok.id == Tn.T_PRECISION) {
        return this._parseDeclarationPrecision(tok);
    } else if (tok.id == Tn.T_INVARIANT) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            decl = new InvariantDecl(tok);

            decl.names.push(this._t.next());

            opts.equal = false;
            opts.array = false;
        }
    }

    if (decl === null) {
        // First parse the fully specified type
        var type = m(tok);

        // Then, check for an identifier and open left paren to see if this
        // is a function prototype or declaration
        var ident = this._t.peek();

        if (ident.id == Tn.T_IDENTIFIER) {
            // consume peeked token
            this._t.next();

            var n = this._t.peek();

            if (n.id == Tn.T_LEFT_PAREN) {
                return this._parseFunctionPrototypeOrDefinition(type, ident);
            } else {
                decl = this._parseSingleDeclaration(type, ident);
            }
        } else {
            decl = new TypeDecl(type);

            if (!type.incomplete) {
                decl.complete();
            }
        }
    } else {
        decl.complete();
    }

    // Finish the declarator list
    return this._parseInitDeclaratorList(decl, opts);
};

Parser.prototype._parseDeclaration.match = function(tok) {
    if (tok.id == Tn.T_PRECISION) {
        return true;
    }

    return this._match(this._parseFullySpecifiedType, tok);
};

Parser.prototype._parseDeclaration.expected = function() {
    return ['function prototype', 'function definition', 'struct declaration', 'variable declaration'];
};

Parser.prototype._parseExpressionStatement = function(tok, m) {
    if (tok.id == Tn.T_SEMICOLON) {
        return (new EmptyStmt(tok)).complete();
    } else {
        var ret = this._parseExpression(tok, m);
        var stmt = new ExpressionStmt(ret);

        if (ret.incomplete) {
            return stmt;
        }

        stmt.semi = this._requireOneOf([Tn.T_SEMICOLON]);

        if (stmt.semi === null) {
            return stmt;
        }

        return stmt.complete();
    }
};

Parser.prototype._parseExpressionStatement.match = function(tok) {
    if (tok.id == Tn.T_SEMICOLON) {
        return true;
    }

    return this._match(this._parseExpression, tok);
};

Parser.prototype._parseExternalDeclaration = function(tok, m) {
    return m(tok);
};

Parser.prototype._syncDeclaration = function(tok) {
    if (this._isPrimitiveType(tok.id)) {
        return SYNC_OK;
    }

    switch (tok.id) {
    case Tn.T_SEMICOLON:
        return SYNC_OK_CONSUME;
    case Tn.T_PRECISION:
    case Tn.T_ATTRIBUTE:
    case Tn.T_CONST:
    case Tn.T_UNIFORM:
    case Tn.T_VARYING:
    case Tn.T_STRUCT:
    case Tn.T_VOID:
    case Tn.T_INVARIANT:
    case Tn.T_HIGH_PRECISION:
    case Tn.T_MEDIUM_PRECISION:
    case Tn.T_LOW_PRECISION:
    case Tn.T_PRECISION:
        return SYNC_OK;
    }

    return SYNC_FAIL;
};

Parser.prototype._sync = function(syncer) {
    var tok = this._t.peek();

    while (tok.id != Tn.T_EOF) {
        var s = syncer.call(this, tok);

        if (s == SYNC_OK) {
            return;
        } else if (s == SYNC_OK_CONSUME) {
            this._t.next();
            return;
        }

        this._t.next();
        tok = this._t.peek();
    }
};

matchOneOf(Parser.prototype._parseExternalDeclaration, [
    Parser.prototype._parseDeclaration
]);

Parser.prototype._parseTu = function() {
    while (!this._t.eof()) {
        var tok = this._t.next();

        if (tok.id == Tn.T_EOF) {
            this.comments = tok.comments;
            break;
        }

        var node = this._parseRule(this._parseExternalDeclaration, tok);
        this.body.push(node);

        if (node.incomplete) {
            this._sync(this._syncDeclaration);
        }
    }
};

Parser.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
};

Parser.prototype._match = function(rule, tok) {
    return rule.match.call(this, tok);
};

Parser.prototype._parseRule = function(rule, tok) {
    if (typeof tok == 'undefined') {
        return false;
    }

    var m = this._match(rule, tok);

    if (!m) {
        var ex = rule.expected.call(this);

        if (ex.length > 1) {
            ex = '`' + ex.slice(0, ex.length - 1).join('\', `') + '\' or `' + ex[ex.length - 1] + '\'';
        } else {
            ex = '`' + ex[0] + '\'';
        }

        this._error(tok.location, 'expected ' + ex + ' but got `' + this._t.tokenName(tok.id) + '\'');
        this._t.unconsume(tok);

        return new NoMatch(tok);
    }

    return rule.call(this, tok, m);
};

Parser.prototype.errors = function() {
    return this._preprocessor.errors().concat(this._errors);
};

exports.Parser = Parser;

// vi:ts=4:et
