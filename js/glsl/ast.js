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

    ret.node_name = name;
    ret.constructor = constructor;

    return ret;
};

Node.prototype._value_is_empty = function(v) {
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

Node.prototype._marshal_object_is_ref = function(value, inctype) {
    if (Node.prototype.isPrototypeOf(value) &&
        value.marshal_can_ref() &&
        typeof value.__marshal_ref_id != 'undefined') {

        value.__marshal_ref++;

        var ret = '';

        if (inctype) {
            ret += value.node_name;
        }

        return ret + '@' + value.__marshal_ref_id;
    }

    return null;
};

Node.prototype.marshal_node_name = function() {
    return this.node_name;
};

Node.prototype.marshal_can_ref = function() {
    return true;
};

Node.prototype._marshal_object = function(value, ctx) {
    var ret = {};

    var isref = this._marshal_object_is_ref(value, false);

    if (isref !== null) {
        return isref;
    }

    if (Node.prototype.isPrototypeOf(value) && value.marshal_can_ref()) {
        value.__marshal_ref = 1;
        value.__marshal_ref_id = ctx.__marshal_ref_id++;
        value.__marshalled = ret;

        ctx.objects.push(value);
    }

    for (var k in value) {
        if (k[0] != '_' && value.hasOwnProperty(k) && !this._value_is_empty(value[k])) {
            var name = k;
            var val = value[k];

            if (typeof val == 'object' && typeof val.marshal_node_name === 'function') {
                name += '(' + val.marshal_node_name() + ')';
            }

            ret[name] = this._marshal_value(val, ctx);
        }
    }

    return ret;
};

Node.prototype._marshal_array = function(value, ctx) {
    var ret = new Array(value.length);

    for (var i = 0; i < value.length; i++) {
        var val = value[i];

        if (typeof val == 'object' && Node.prototype.isPrototypeOf(val)) {
            var isref = this._marshal_object_is_ref(val, true);

            if (isref === null) {
                var h = {};
                h[val.node_name] = this._marshal_value(val, ctx);

                ret[i] = h;
            } else {
                ret[i] = isref;
            }
        } else {
            ret[i] = this._marshal_value(val, ctx);
        }
    }

    return ret;
};

Node.prototype._marshal_value = function(value, ctx) {
    if (typeof value === 'undefined') {
        return 'undefined';
    }

    if (typeof value != 'object') {
        return value;
    }

    if (Array.prototype.isPrototypeOf(value)) {
        return this._marshal_array(value, ctx);
    }

    var ret = this._marshal_object_is_ref(value, false);

    if (ret === null) {
        if (typeof value.marshal == 'function') {
            ret = value.marshal(ctx);
        } else {
            ret = this._marshal_object(value, ctx);
        }
    }

    return ret;
};

Node.prototype.marshal = function(ctx) {
    var owned_ctx = false;

    if (typeof ctx === 'undefined') {
        ctx = {
            __marshal_ref_id: 1,
            objects: []
        };

        owned_ctx = true;
    }

    var ret = this._marshal_object(this, ctx);

    if (owned_ctx) {
        for (var i = 0; i < ctx.objects.length; i++) {
            var obj = ctx.objects[i];

            if (obj.__marshal_ref > 1) {
                obj.__marshalled['@id'] = obj.__marshal_ref_id;
            }

            delete obj.__marshal_ref;
            delete obj.__marshalled;
            delete obj.__marshal_ref_id;
        }
    }

    return ret;
};

Node.prototype.location = function() {
    throw new Error(this.node_name + ' does not implement required location()');
};

Node.prototype.to_json = function() {
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
        this.is_primitive = (tok.id != Tn.T_IDENTIFIER);
    } else {
        this.is_primitive = false;
    }
}

TypeRef.prototype = Node.create('TypeRef', TypeRef);
exports.TypeRef = TypeRef;

TypeRef.wrap_decl = function(decl) {
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

TypeRef.prototype.has_qualifier = function(qid) {
    for (var i = 0; i < this.qualifiers.length; i++) {
        var q = this.qualifiers[i];

        if (q.id == qid) {
            return true;
        }
    }

    return false;
};

TypeRef.prototype.is_const = function() {
    return this.has_qualifier(Tn.T_CONST);
};

TypeRef.prototype.is_attribute = function() {
    return this.has_qualifier(Tn.T_ATTRIBUTE);
};

TypeRef.prototype.is_varying = function() {
    return this.has_qualifier(Tn.T_VARYING);
};

TypeRef.prototype.is_uniform = function() {
    return this.has_qualifier(Tn.T_UNIFORM);
};

function StructDecl(stok) {
    Node.call(this);

    this.token = stok;
    this.name = null;

    this.left_brace = null;
    this.right_brace = null;

    this.fields = [];
}

StructDecl.prototype = Node.create('StructDecl', StructDecl);
exports.StructDecl = StructDecl;

StructDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.name,
                                   this.fields,
                                   this.left_brace,
                                   this.right_brace);
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

    this.is_array = false;
    this.array_size = null;
    this.left_bracket = null;
    this.right_bracket = null;
}

ParamDecl.prototype = Node.create('ParamDecl', ParamDecl);
exports.ParamDecl = ParamDecl;

ParamDecl.prototype.location = function() {
    return glsl.source.Range.spans(this.type,
                                   this.name,
                                   this.qualifier,
                                   this.array_size,
                                   this.left_bracket,
                                   this.right_bracket);
};


function Named(name, decl) {
    Node.call(this);

    this.name = name;
    this.decl = decl;
    this.type = null;

    this.initial_assign = null;
    this.initial_value = null;

    this.is_array = false;
    this.array_size = null;
    this.left_bracket = null;
    this.right_bracket = null;
}

Named.prototype = Node.create('Named', Named);
exports.Named = Named;

Named.prototype.location = function() {
    return glsl.source.Range.spans(this.name,
                                   this.initial_assign,
                                   this.initial_value,
                                   this.array_size,
                                   this.left_bracket,
                                   this.right_bracket);
};


function FunctionHeader(type, name) {
    Node.call(this);

    this.type = type;
    this.name = name;
    this.parameters = [];
    this.left_paren = null;
    this.right_paren = null;
}

FunctionHeader.prototype = Node.create('FunctionHeader', FunctionHeader);
exports.FunctionHeader = FunctionHeader;

FunctionHeader.prototype.location = function() {
    return glsl.source.Range.spans(this.type,
                                   this.name,
                                   this.parameters,
                                   this.left_paren,
                                   this.right_paren);
};

FunctionHeader.signature_from_names = function(name, argnames) {
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

    return FunctionHeader.signature_from_names(this.name.text, argnames);
};

function FunctionProto(header) {
    Node.call(this);

    this.header = header;
    this.is_builtin = false;
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

    this.right_brace = null;
    this.left_brace = null;
    this.body = [];
    this.new_scope = true;
}

Block.prototype = Node.create('Block', Block);
exports.Block = Block;

Block.prototype.location = function() {
    return glsl.source.Range.spans(this.right_brace, this.body, this.left_brace);
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
    this.left_paren = null;
    this.condition = null;
    this.right_paren = null;
    this.body = null;
    this.els = null;
}

SelectionStmt.prototype = Node.create('SelectionStmt', SelectionStmt);
exports.SelectionStmt = SelectionStmt;

SelectionStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.left_paren,
                                   this.condition,
                                   this.right_paren,
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

    this.left_paren = null;
    this.condition = null;
    this.right_paren = null;
    this.body = null;
}

WhileStmt.prototype = Node.create('WhileStmt', WhileStmt);
exports.WhileStmt = WhileStmt;

WhileStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.left_paren,
                                   this.condition,
                                   this.right_paren,
                                   this.body);
};


function DoStmt(dtok) {
    Node.call(this);

    this.do_token = dtok;
    this.while_token = null;

    this.left_paren = null;
    this.condition = null;
    this.right_paren = null;
    this.body = null;
}

DoStmt.prototype = Node.create('DoStmt', DoStmt);
exports.DoStmt = DoStmt;

DoStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.do_token,
                                   this.while_token,
                                   this.left_paren,
                                   this.condition,
                                   this.right_paren,
                                   this.body);
};


function ForStmt(tok) {
    Node.call(this);

    this.token = tok;

    this.left_paren = null;
    this.init = null;
    this.rest = null;
    this.right_paren = null;
    this.body = null;
}

ForStmt.prototype = Node.create('ForStmt', ForStmt);
exports.ForStmt = ForStmt;

ForStmt.prototype.location = function() {
    return glsl.source.Range.spans(this.token,
                                   this.left_paren,
                                   this.init,
                                   this.rest,
                                   this.right_paren,
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
    this.question_token = null;
    this.true_expression = null;
    this.colon_token = null;
    this.false_expression = null;
}

TernaryExpr.prototype = Node.create('TernaryExpr', TernaryExpr);
exports.TernaryExpr = TernaryExpr;

TernaryExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.condition,
                                   this.question_token,
                                   this.true_expression,
                                   this.colon_token,
                                   this.false_expression);
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

    this.left_paren = null;
    this.expression = null;
    this.right_paren = null;
}

GroupExpr.prototype = Node.create('GroupExpr', GroupExpr);
exports.GroupExpr = GroupExpr;

GroupExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.left_paren, this.expression, this.right_paren);
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
    this.left_paren = null;
    this.right_paren = null;
    this.arguments = [];
}

FunctionCallExpr.prototype = Node.create('FunctionCallExpr', FunctionCallExpr);
exports.FunctionCallExpr = FunctionCallExpr;

FunctionCallExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.name, this.left_paren, this.right_paren, this.arguments);
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

    this.right_bracket = null;
    this.index = null;
    this.left_bracket = null;
}

IndexExpr.prototype = Node.create('IndexExpr', IndexExpr);
exports.IndexExpr = IndexExpr;

IndexExpr.prototype.location = function() {
    return glsl.source.Range.spans(this.expression, this.right_bracket, this.index, this.left_bracket);
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

    this._parse_tu();
    this.complete();
}

Parser.prototype = Node.create('Parser', Parser);

Parser.prototype.marshal = function(ctx) {
    var ret = Node.prototype.marshal.call(this, ctx);

    if (this._errors.length !== 0) {
        ret.errors = this._marshal_array(this._errors, ctx);
    }

    return ret;
};

Parser.prototype._require_one_of_error = function(ids, tok) {
    var loc;
    var got;

    if (tok.id == Tn.T_EOF) {
        loc = this._t.location().to_range();
        got = 'nothing';
    } else {
        loc = tok.location;
        got = this._t.token_name(tok.id);
    }

    var choices = [];

    for (var i = 0; i < ids.length; i++) {
        choices.push(this._t.token_name(ids[i]));
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

Parser.prototype._require_one_of = function(ids) {
    var tok = this._t.next();

    for (var i = 0; i < ids.length; i++) {
        if (tok.id == ids[i]) {
            return tok;
        }
    }

    return this._require_one_of_error(ids, tok);
};

Parser.prototype._match_one_of = function(matchers, tok) {
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

function match_one_of(f, oneof) {
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
        return this._match_one_of(oneof, tok);
    };

    f.expected = function() {
        var ret = [];

        for (var i = 0; i < oneof.length; i++) {
            ret = ret.concat(oneof[i].expected.call(this));
        }

        return ret;
    };
}

Parser.prototype._parse_binop_expression = function(tok, m, expr, opid, rule) {
    var ret;

    if (rule == this._parse_unary_expression && typeof expr != 'undefined') {
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

        var rhs = this._parse_rule(rule, this._t.next());

        ret = new BinOpExpr(ret, op, rhs);

        if (rhs.incomplete) {
            return ret;
        }

        ret.complete();
        tok = this._t.peek();
    }

    return ret;
};

Parser.prototype._parse_function_call = function(tok) {
    var cl = new FunctionCallExpr(tok);

    cl.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (cl.left_paren === null) {
        return cl;
    }

    var n = this._t.peek();

    if (this._match(this._parse_assignment_expression, n)) {
        while (true) {
            var ret = this._parse_rule(this._parse_assignment_expression, this._t.next());

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

    cl.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (cl.right_paren === null) {
        return cl;
    }

    return cl.complete();
};

Parser.prototype._parse_function_identifier = function(tok) {
    return (new Named(tok, null)).complete();
};

Parser.prototype._is_primitive_type = function(id) {
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

Parser.prototype._parse_function_identifier.match = function(tok) {
    return this._is_primitive_type(tok.id) || tok.id == Tn.T_IDENTIFIER;
};

Parser.prototype._parse_primary_expression = function(tok) {
    if (this._parse_function_identifier.match.call(this, tok)) {
        var n = this._t.peek();

        if (n.id == Tn.T_LEFT_PAREN) {
            return this._parse_function_call(tok);
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

        grp.left_paren = tok;
        grp.expression = this._parse_rule(this._parse_expression, this._t.next());

        if (grp.expression.incomplete) {
            return grp;
        }

        grp.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

        if (grp.right_paren === null) {
            return grp;
        }

        return grp.complete();
    }

    return new NoMatch(tok);
};

Parser.prototype._parse_primary_expression.match = function(tok) {
    switch (tok.id) {
    case Tn.T_INTCONSTANT:
    case Tn.T_FLOATCONSTANT:
    case Tn.T_BOOLCONSTANT:
    case Tn.T_LEFT_PAREN:
        return true;
    }

    return this._match(this._parse_function_identifier, tok);
};

Parser.prototype._parse_primary_expression.expected = function() {
    return ['identifier', 'integer', 'float', 'bool', 'grouped expression'];
};

Parser.prototype._parse_postfix_expression = function(tok, m) {
    var expr = this._parse_primary_expression(tok, m);

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
            expr.left_bracket = tok;

            expr.index = this._parse_rule(this._parse_expression, this._t.next());

            if (expr.index.incomplete) {
                break;
            }

            expr.right_bracket = this._require_one_of([Tn.T_RIGHT_BRACKET]);

            if (expr.right_bracket === null) {
                break;
            }

            expr.complete();
            break;
        case Tn.T_DOT:
            // consume peeked token
            this._t.next();

            expr = new FieldSelectionExpr(expr, tok);

            expr.selector = this._require_one_of([Tn.T_IDENTIFIER]);

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

Parser.prototype._parse_postfix_expression.match = Parser.prototype._parse_primary_expression.match;

Parser.prototype._parse_postfix_expression.expected = Parser.prototype._parse_primary_expression.expected;

Parser.prototype._parse_unary_expression = function(tok, m) {
    switch (tok.id) {
    case Tn.T_INC_OP:
    case Tn.T_DEC_OP:
    case Tn.T_PLUS:
    case Tn.T_DASH:
    case Tn.T_BANG:
    case Tn.T_TILDE:
        var expr = this._parse_rule(this._parse_unary_expression, this._t.next());
        var ret = new UnaryOpExpr(tok, expr);

        if (!expr.incomplete) {
            ret.complete();
        }

        return ret;
    }

    return this._parse_postfix_expression(tok, m);
};

Parser.prototype._parse_unary_expression.match = function(tok) {
    switch (tok.id) {
    case Tn.T_INC_OP:
    case Tn.T_DEC_OP:
    case Tn.T_PLUS:
    case Tn.T_DASH:
    case Tn.T_BANG:
    case Tn.T_TILDE:
        return true;
    }

    return this._match(this._parse_postfix_expression, tok);
};

Parser.prototype._parse_unary_expression.expected = function() {
    return ['unary operator'].concat(this._parse_postfix_expression.expected.call(this));
};

Parser.prototype._parse_multiplicative_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_STAR ||
                                                               id == Tn.T_SLASH ||
                                                               id == Tn.T_PERCENT; },
                                        this._parse_unary_expression);
};

Parser.prototype._parse_multiplicative_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_multiplicative_expression.expected = Parser.prototype._parse_unary_expression.expected;


Parser.prototype._parse_additive_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_PLUS ||
                                                               id == Tn.T_DASH; },
                                        this._parse_multiplicative_expression);
};

Parser.prototype._parse_additive_expression.match = Parser.prototype._parse_multiplicative_expression.match;

Parser.prototype._parse_additive_expression.expected = Parser.prototype._parse_multiplicative_expression.expected;


Parser.prototype._parse_shift_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_LEFT_OP ||
                                                               id == Tn.T_RIGHT_OP; },
                                        this._parse_additive_expression);
};

Parser.prototype._parse_shift_expression.match = Parser.prototype._parse_additive_expression.match;

Parser.prototype._parse_shift_expression.expected = Parser.prototype._parse_additive_expression.expected;


Parser.prototype._parse_relational_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_LEFT_ANGLE ||
                                                               id == Tn.T_RIGHT_ANGLE ||
                                                               id == Tn.T_LE_OP ||
                                                               id == Tn.T_GE_OP; },
                                        this._parse_shift_expression);
};

Parser.prototype._parse_relational_expression.match = Parser.prototype._parse_shift_expression.match;

Parser.prototype._parse_relational_expression.expected = Parser.prototype._parse_shift_expression.expected;


Parser.prototype._parse_equality_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_EQ_OP || id == Tn.T_NE_OP; },
                                        this._parse_relational_expression);
};

Parser.prototype._parse_equality_expression.match = Parser.prototype._parse_relational_expression.match;

Parser.prototype._parse_equality_expression.expected = Parser.prototype._parse_relational_expression.expected;

Parser.prototype._parse_and_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AMPERSAND; },
                                        this._parse_equality_expression);
};


Parser.prototype._parse_and_expression.match = Parser.prototype._parse_equality_expression.match;

Parser.prototype._parse_and_expression.expected = Parser.prototype._parse_equality_expression.expected;


Parser.prototype._parse_exclusive_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_CARET; },
                                        this._parse_and_expression);
};

Parser.prototype._parse_exclusive_or_expression.match = Parser.prototype._parse_and_expression.match;

Parser.prototype._parse_exclusive_or_expression.expected = Parser.prototype._parse_and_expression.expected;


Parser.prototype._parse_inclusive_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_VERTICAL_BAR; },
                                        this._parse_exclusive_or_expression);
};

Parser.prototype._parse_inclusive_or_expression.match = Parser.prototype._parse_exclusive_or_expression.match;

Parser.prototype._parse_inclusive_or_expression.expected = Parser.prototype._parse_exclusive_or_expression.expected;

Parser.prototype._parse_logical_and_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AND_OP; },
                                        this._parse_inclusive_or_expression);
};

Parser.prototype._parse_logical_and_expression.match = Parser.prototype._parse_inclusive_or_expression.match;

Parser.prototype._parse_logical_and_expression.expected = Parser.prototype._parse_inclusive_or_expression.expected;

Parser.prototype._parse_logical_xor_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_XOR_OP; },
                                        this._parse_logical_and_expression);
};

Parser.prototype._parse_logical_xor_expression.match = Parser.prototype._parse_logical_and_expression.match;

Parser.prototype._parse_logical_xor_expression.expected = Parser.prototype._parse_logical_and_expression.expected;

Parser.prototype._parse_logical_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_OR_OP; },
                                        this._parse_logical_xor_expression);
};

Parser.prototype._parse_logical_or_expression.match = Parser.prototype._parse_logical_xor_expression.match;

Parser.prototype._parse_logical_or_expression.expected = Parser.prototype._parse_logical_xor_expression.expected;

Parser.prototype._parse_unary_conditional_expression_rest = function(expr) {
    if (expr.incomplete) {
        return expr;
    }

    var n = this._t.peek();

    if (n.id == Tn.T_QUESTION) {
        var ret = new TernaryExpr(expr);
        ret.question_token = this._t.next();

        ret.true_expression = this._parse_rule(this._parse_expression, this._t.next());

        if (ret.true_expression.incomplete) {
            return ret;
        }

        ret.colon_token = this._require_one_of([Tn.T_COLON]);

        if (ret.colon_token === null) {
            return ret;
        }

        ret.false_expression = this._parse_rule(this._parse_assignment_expression, this._t.next());

        if (ret.false_expression.incomplete) {
            return ret;
        }

        return ret.complete();
    }

    return expr;
};

Parser.prototype._parse_unary_conditional_expression = function(expr) {
    var tok, m;

    var expr = this._parse_logical_or_expression(tok, m, expr);
    return this._parse_unary_conditional_expression_rest(expr);
};

Parser.prototype._parse_conditional_expression = function(tok, m) {
    var expr = this._parse_logical_or_expression(tok, m);
    return this._parse_unary_conditional_expression_rest(expr);
};

Parser.prototype._parse_conditional_expression.match = Parser.prototype._parse_logical_or_expression.match;

Parser.prototype._parse_conditional_expression.expected = Parser.prototype._parse_logical_or_expression.expected;

Parser.prototype._parse_assignment_operator = function(tok) {
    return {token: tok, incomplete: false};
};

Parser.prototype._parse_assignment_operator.match = function(tok) {
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

Parser.prototype._parse_assignment_operator.expected = function() {
    return ['assignment operator'];
};

Parser.prototype._parse_unary_assignment_expression = function(expr) {
    var ret = new AssignmentExpr(expr);
    var op = this._parse_rule(this._parse_assignment_operator, this._t.next());

    if (op.incomplete) {
        return ret;
    }

    ret.op = op.token;

    ret.rhs = this._parse_rule(this._parse_assignment_expression, this._t.next());

    if (!ret.rhs.incomplete) {
        ret.complete();
    }

    return ret;
};

Parser.prototype._parse_unary_assignment_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_unary_assignment_expression.expected = Parser.prototype._parse_unary_expression.expected;

Parser.prototype._parse_assignment_expression = function(tok, m) {
    var expr = this._parse_unary_expression(tok, m);

    if (expr.incomplete) {
        return expr;
    }

    var n = this._t.peek();
    var m = this._match(this._parse_assignment_operator, n);

    if (m) {
        return this._parse_unary_assignment_expression(expr);
    } else {
        return this._parse_unary_conditional_expression(expr);
    }
};

Parser.prototype._parse_assignment_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_assignment_expression.expected = Parser.prototype._parse_unary_expression.expected;

Parser.prototype._parse_expression = function(tok, m) {
    var expr = this._parse_assignment_expression(tok, m);

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

        expr = this._parse_assignment_expression(tok, m);
        ret.expressions.push(expr);

        if (expr.incomplete) {
            return expr;
        }

        tok = this._t.peek();
    }

    return ret.complete();
};

Parser.prototype._parse_expression.match = Parser.prototype._parse_assignment_expression.match;
Parser.prototype._parse_expression.expected = Parser.prototype._parse_assignment_expression.expected;

Parser.prototype._parse_constant_expression = Parser.prototype._parse_conditional_expression;
Parser.prototype._parse_constant_expression.match = Parser.prototype._parse_conditional_expression.match;
Parser.prototype._parse_constant_expression.expected = Parser.prototype._parse_conditional_expression.expected;

Parser.prototype._parse_field_declaration_name = function(tok) {
    var name = tok;

    var ret = new Named(name, null);
    ret.complete();

    this._parse_optional_array_spec(ret);

    return ret;
};

Parser.prototype._parse_field_declaration_name.match = function(tok) {
    return tok.id == Tn.T_IDENTIFIER;
};

Parser.prototype._parse_field_declaration_name.expected = function() {
    return ['field name'];
};

Parser.prototype._parse_field_declaration = function(tok, m) {
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
                this._require_one_of_error([Tn.T_COMMA], tok);
                return sdecl;
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var fname = this._parse_rule(this._parse_field_declaration_name, tok);

        fname.decl = sdecl;
        fname.type = type;

        sdecl.names.push(fname);

        if (fname.incomplete) {
            return sdecl;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_SEMICOLON) {
        this._require_one_of_error([Tn.T_SEMICOLON], tok);
        return sdecl;
    }

    sdecl.semi = tok;
    return sdecl.complete();
};

Parser.prototype._parse_struct_specifier = function(tok) {
    var lb = this._t.next();

    var sdl = new StructDecl(tok);

    if (lb.id != Tn.T_IDENTIFIER && lb.id != Tn.T_LEFT_BRACE ) {
        this._require_one_of_error([Tn.T_IDENTIFIER, Tn.T_LEFT_BRACE], lb);
        return sdl;
    }

    var name = null;

    if (lb.id == Tn.T_IDENTIFIER) {
        name = lb;
        lb = this._t.next();
    }

    sdl.name = name;

    if (lb.id != Tn.T_LEFT_BRACE) {
        this._require_one_of_error([Tn.T_LEFT_BRACE], lb);
        return sdl;
    }

    sdl.left_brace = lb;

    tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var decl = this._parse_rule(this._parse_field_declaration, tok);
        sdl.fields.push(decl);

        if (decl.incomplete) {
            return sdl;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
        return sdl;
    }

    sdl.right_brace = tok;
    return sdl.complete();
};

Parser.prototype._parse_struct_specifier.match = function(tok) {
    return tok.id == Tn.T_STRUCT;
};

Parser.prototype._parse_type_specifier_no_prec_impl = function(tok) {
    return (new TypeRef(tok)).complete();
};

Parser.prototype._parse_type_specifier_no_prec = function(tok, m) {
    return m(tok);
};

Parser.prototype._parse_type_specifier_no_prec.match = function(tok) {
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
        return this._parse_type_specifier_no_prec_impl;
    }

    if (this._match(this._parse_struct_specifier, tok)) {
        return this._parse_struct_specifier.bind(this);
    }
};

Parser.prototype._parse_type_specifier_no_prec.expected = function() {
    return ['builtin type', 'user type identifier'];
};

Parser.prototype._parse_type_specifier = function(tok, m) {
    return m(tok);
};

Parser.prototype._parse_precision_qualifier = function(tok) {
    return tok;
};

Parser.prototype._parse_precision_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_HIGH_PRECISION:
    case Tn.T_MEDIUM_PRECISION:
    case Tn.T_LOW_PRECISION:
        return true;
    }

    return false;
};

Parser.prototype._parse_precision_qualifier.expected = function() {
    return ['highp', 'mediump', 'lowp'];
};

Parser.prototype._parse_type_precision_qualifier = function(tok) {
    var type = this._parse_rule(this._parse_type_specifier_no_prec, this._t.next());

    type = TypeRef.wrap_decl(type);

    type.qualifiers.unshift(tok);
    return type;
};

Parser.prototype._parse_type_precision_qualifier.match = Parser.prototype._parse_precision_qualifier.match;

Parser.prototype._parse_type_precision_qualifier.expected = Parser.prototype._parse_precision_qualifier.expected;

match_one_of(Parser.prototype._parse_type_specifier, [
    Parser.prototype._parse_type_specifier_no_prec,
    Parser.prototype._parse_type_precision_qualifier
]);

Parser.prototype._parse_field_declaration.match = Parser.prototype._parse_type_specifier.match;

Parser.prototype._parse_type_qualifier = function(tok) {
    var node;

    if (tok.id == Tn.T_INVARIANT) {
        var varying = this._require_one_of([Tn.T_VARYING]);

        if (varying === null) {
            // Should have been followed by varying (invariant IDENT is handled elsewhere).
            // Create empty, incomplete TypeRef.
            node = new TypeRef(null);
        } else {
            node = this._parse_rule(this._parse_type_specifier, this._t.next());
        }

        node.qualifiers.unshift(varying);
    } else {
        node = this._parse_rule(this._parse_type_specifier, this._t.next());
        node = TypeRef.wrap_decl(node);
    }

    if (node) {
        node.qualifiers.unshift(tok);
    }

    return node;
};

Parser.prototype._parse_type_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONST:
    case Tn.T_ATTRIBUTE:
    case Tn.T_VARYING:
    case Tn.T_INVARIANT:
    case Tn.T_UNIFORM:
        return true;
    }
};

Parser.prototype._parse_type_qualifier.expected = function() {
    return ['const', 'attribute', 'varying', 'invariant', 'uniform'];
};

Parser.prototype._parse_fully_specified_type = function(tok, m) {
    return m(tok);
};

match_one_of(Parser.prototype._parse_fully_specified_type, [
    Parser.prototype._parse_type_specifier,
    Parser.prototype._parse_type_qualifier
]);

Parser.prototype._parse_optional_array_spec = function(ret) {
   var tok = this._t.peek();

    if (tok.id == Tn.T_LEFT_BRACKET) {
        ret.is_array = true;
        ret.left_bracket = tok;

        // consume peeked token
        this._t.next();

        ret.array_size = this._parse_rule(this._parse_constant_expression, this._t.next());

        if (ret.array_size.incomplete) {
            ret.incomplete = true;
            return true;
        }

        ret.right_bracket = this._require_one_of([Tn.T_RIGHT_BRACKET]);

        if (ret.right_bracket === null) {
            ret.incomplete = true;
            return true;
        }

        return true;
    } else {
        return false;
    }
};

Parser.prototype._parse_parameter_declarator = function(tok, m) {
    var type = this._parse_type_specifier(tok, m);

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
    this._parse_optional_array_spec(pdecl);

    return pdecl;
};

Parser.prototype._parse_parameter_declarator.match = Parser.prototype._parse_type_specifier.match;
Parser.prototype._parse_parameter_declarator.expected = Parser.prototype._parse_type_specifier.expected;

Parser.prototype._parse_parameter_qualifier = function(tok) {
    var ret = this._parse_rule(this._parse_parameter_declarator, this._t.next());
    ret.qualifier = tok;

    return ret;
};

Parser.prototype._parse_parameter_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_IN:
    case Tn.T_OUT:
    case Tn.T_INOUT:
        return true;
    }

    return false;
};

Parser.prototype._parse_parameter_qualifier.expected = function() {
    return ['in', 'out', 'inout'];
};

Parser.prototype._parse_parameter_type_qualifier = function(tok, m) {
    var q = tok;

    tok = this._t.next();

    m = this._match(this._parse_parameter_qualifier, tok);

    var decl;

    if (m) {
        decl = this._parse_parameter_qualifier(tok, m);
    } else {
        decl = this._parse_rule(this._parse_parameter_declarator, tok);
    }

    decl.qualifier = q;
    return decl;
};

Parser.prototype._parse_parameter_type_qualifier.match = function (tok) {
    return tok.id == Tn.T_CONST;
};

Parser.prototype._parse_parameter_type_qualifier.expected = function() {
    return ["const"];
};

Parser.prototype._parse_parameter_declaration = function(tok, m) {
    return m(tok);
};

match_one_of(Parser.prototype._parse_parameter_declaration, [
    Parser.prototype._parse_parameter_type_qualifier,
    Parser.prototype._parse_parameter_qualifier,
    Parser.prototype._parse_parameter_declarator
]);

Parser.prototype._parse_function_header = function(type, name) {
    var func = new FunctionHeader(type, name);
    func.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (func.left_paren === null) {
        return false;
    }

    var tok = this._t.next();
    var first = true;

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_PAREN) {
        if (!first) {
            if (tok.id != Tn.T_COMMA) {
                this._require_one_of_error([Tn.T_COMMA], tok);
                return func;
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var m = this._parse_rule(this._parse_parameter_declaration, tok);
        func.parameters.push(m);

        if (m.incomplete) {
            return func;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_PAREN) {
        this._require_one_of_error([Tn.T_RIGHT_PAREN], tok);
        return func;
    }

    func.right_paren = tok;
    return func.complete();
};

Parser.prototype._sync_statement = function(tok) {
    if (this._is_primitive_type(tok.id)) {
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

Parser.prototype._parse_function_definition = function(header, lb) {
    var func = new FunctionDef(header);

    if (header.incomplete) {
        return func;
    }

    func.body = new Block();
    func.body.left_brace = lb;

    var tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var ret = this._parse_rule(this._parse_statement_no_new_scope, tok);
        func.body.body.push(ret);

        if (ret.incomplete) {
            this._sync(this._sync_statement);
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
        return func;
    }

    func.body.right_brace = tok;
    func.body.complete();

    return func.complete();
};

Parser.prototype._parse_function_prototype_or_definition = function(type, ident) {
    var ret = this._parse_function_header(type, ident);

    if (ret.incomplete) {
        // return most likely incomplete function definition
        return new FunctionDef(ret);
    }

    var n = this._require_one_of([Tn.T_SEMICOLON, Tn.T_LEFT_BRACE]);

    if (n === null) {
        // return most likely incomplete function definition
        return new FunctionDef(ret);
    }

    if (n.id == Tn.T_SEMICOLON) {
        var proto = new FunctionProto(ret);

        proto.semi = n;
        return proto.complete();
    } else {
        return this._parse_function_definition(ret, n);
    }
};

Parser.prototype._parse_statement_with_scope = function(tok, m) {
    return m(tok);
};

Parser.prototype._parse_selection_rest_statement = function(tok, m) {
    var stmt = this._parse_statement_with_scope(tok, m);

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

        selelse.body = this._parse_rule(this._parse_statement_with_scope, this._t.next());

        if (!selelse.body.incomplete) {
            selelse.complete();
            ret.incomplete = false;
        }
    } else {
        ret.incomplete = false;
    }

    return ret;
};

Parser.prototype._parse_selection_statement = function(tok) {
    var sel = new SelectionStmt(tok);

    sel.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (sel.left_paren === null) {
        return sel;
    }

    tok = this._t.next();

    sel.condition = this._parse_rule(this._parse_expression, tok);

    if (sel.condition.incomplete) {
        return sel;
    }

    sel.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (sel.right_paren === null) {
        return sel;
    }

    tok = this._t.next();

    var ret = this._parse_rule(this._parse_selection_rest_statement, tok);

    if (!NoMatch.prototype.isPrototypeOf(ret)) {
        sel.body = ret.body;
        sel.els = ret.els;
    }

    if (!ret.incomplete) {
        sel.complete();
    }

    return sel;
};

Parser.prototype._parse_selection_statement.match = function(tok) {
    return tok.id == Tn.T_IF;
};

Parser.prototype._parse_selection_statement.expected = function() {
    return ["if"];
};

Parser.prototype._parse_condition_var_init = function(tok, m) {
    var type = this._parse_fully_specified_type(tok, m);

    type = TypeRef.wrap_decl(type);
    var ret = new VariableDecl(type);

    if (type.incomplete) {
        return ret;
    }

    var ident = this._require_one_of([Tn.T_IDENTIFIER]);

    if (ident === null) {
        return ret;
    }

    var equal = this._require_one_of([Tn.T_EQUAL]);

    if (equal === null) {
        return ret;
    }

    var named = new Named(ident, ret);
    named.type = type;
    ret.names.push(named);

    named.initial_assign = equal;

    var init = this._parse_rule(this._parse_initializer, this._t.next());
    named.initial_value = init;

    if (!init.incomplete) {
        named.complete();
        ret.complete();
    }

    return ret;
};

Parser.prototype._parse_condition_var_init.match = Parser.prototype._parse_fully_specified_type.match;
Parser.prototype._parse_condition_var_init.expected = Parser.prototype._parse_fully_specified_type.expected;

Parser.prototype._parse_condition = function(tok, m) {
    if (tok.id == Tn.T_IDENTIFIER) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            return this._parse_condition_var_init(tok, this._match(this._parse_condition_var_init, tok));
        } else {
            // go for the expression
            return this._parse_rule(this._parse_expression, tok);
        }
    }

    // Go for whatever matched
    return m(tok);
};

match_one_of(Parser.prototype._parse_condition, [
    Parser.prototype._parse_condition_var_init,
    Parser.prototype._parse_expression
]);

Parser.prototype._parse_condition.expected = function() {
    return ["condition expression"];
};

Parser.prototype._parse_while_statement = function(tok) {
    var ret = new WhileStmt(tok);

    ret.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (ret.left_paren === null) {
        return ret;
    }

    tok = this._t.next();

    ret.condition = this._parse_rule(this._parse_condition, tok);

    if (ret.condition.incomplete) {
        return ret;
    }

    ret.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (ret.right_paren === null) {
        return ret;
    }

    ret.body = this._parse_rule(this._parse_statement_no_new_scope, this._t.next());

    if (!ret.body.incomplete) {
        ret.complete();
    }

    return ret;
};

Parser.prototype._parse_while_statement.match = function(tok) {
    return tok.id == Tn.T_WHILE;
};

Parser.prototype._parse_while_statement.expected = function() {
    return ["while"];
};

Parser.prototype._parse_do_statement = function(tok) {
    var ret = new DoStmt(tok);

    var stmt = this._parse_rule(this._parse_statement_with_scope, this._t.next());
    ret.body = stmt;

    if (stmt.incomplete) {
        return ret;
    }

    ret.while_token = this._require_one_of([Tn.T_WHILE]);

    if (ret.while_token === null) {
        return ret;
    }

    ret.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (ret.left_paren === null) {
        return ret;
    }

    tok = this._t.next();

    ret.condition = this._parse_rule(this._parse_expression, tok);

    if (ret.condition.incomplete) {
        return ret;
    }

    ret.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (ret.right_paren === null) {
        return ret;
    }

    ret.semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parse_do_statement.match = function(tok) {
    return tok.id == Tn.T_DO;
};

Parser.prototype._parse_do_statement.expected = function() {
    return ["do"];
};

Parser.prototype._parse_declaration_or_expression_statement = function(tok, m) {
    // Check for double identifier, should be a declaration
    if (tok.id == Tn.T_IDENTIFIER) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            return this._parse_declaration(tok, this._match(this._parse_declaration, tok));
        } else {
            // go for the expression
            return this._parse_expression_statement(tok, this._match(this._parse_expression_statement, tok));
        }
    }

    // Check to see if we start with a constructor
    if (this._match(this._parse_function_identifier, tok)) {
        var n = this._t.peek();

        if (n.id == Tn.T_LEFT_PAREN) {
            return this._parse_rule(this._parse_expression_statement, tok);
        }
    }

    var m = this._match(this._parse_declaration, tok);

    if (m) {
        return this._parse_declaration(tok, m);
    } else {
        return this._parse_rule(this._parse_expression_statement, tok);
    }
};

Parser.prototype._parse_declaration_or_expression_statement.match = function(tok) {
    // Either a declaration or an expression here, but we need lookahead
    var m = this._match(this._parse_declaration, tok);

    if (!m) {
        m = this._match(this._parse_expression_statement, tok);
    }

    return m;
};

Parser.prototype._parse_declaration_or_expression_statement.expected = function() {
    return ['declaration', 'expression'];
};

Parser.prototype._parse_for_init_statement = function(tok, m) {
    return this._parse_declaration_or_expression_statement(tok, m);
};

Parser.prototype._parse_for_init_statement.match = Parser.prototype._parse_declaration_or_expression_statement.match;

Parser.prototype._parse_conditionopt = function(tok, m) {
    m = this._match(this._parse_condition, tok);

    if (!m) {
        return null;
    }

    return this._parse_condition(tok, m);
};

Parser.prototype._parse_conditionopt.match = function() {
    return true;
};

Parser.prototype._parse_for_rest_statement = function(tok, m) {
    var copt = this._parse_rule(this._parse_conditionopt, tok);
    var ret = new ForRestStmt(copt);

    if (copt !== null && copt.incomplete) {
        return ret;
    }

    ret.semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    var n = this._t.peek();
    var m = this._match(this._parse_expression, n);

    if (m) {
        ret.expression = this._parse_expression(this._t.next(), m);

        if (ret.expression.incomplete) {
            return ret;
        }
    }

    return ret.complete();
};

Parser.prototype._parse_for_rest_statement.match = Parser.prototype._parse_conditionopt.match;

Parser.prototype._parse_for_statement = function(tok) {
    var ret = new ForStmt(tok);

    ret.left_paren = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (ret.left_paren === null) {
        return ret;
    }

    tok = this._t.next();

    ret.init = this._parse_rule(this._parse_for_init_statement, tok);

    if (ret.init.incomplete) {
        return ret;
    }

    tok = this._t.next();

    ret.rest = this._parse_rule(this._parse_for_rest_statement, tok);

    if (ret.rest.incomplete) {
        return ret;
    }

    ret.right_paren = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (ret.right_paren === null) {
        return ret;
    }

    ret.body = this._parse_rule(this._parse_statement_no_new_scope, this._t.next());

    if (ret.body.incomplete) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parse_for_statement.match = function(tok) {
    return tok.id == Tn.T_FOR;
};

Parser.prototype._parse_for_statement.expected = function() {
    return ["for"];
};

Parser.prototype._parse_iteration_statement = function(tok, m) {
    return m(tok);
};

match_one_of(Parser.prototype._parse_iteration_statement, [
    Parser.prototype._parse_while_statement,
    Parser.prototype._parse_do_statement,
    Parser.prototype._parse_for_statement
]);

Parser.prototype._parse_jump_statement = function(tok) {
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
            ret.expression = this._parse_rule(this._parse_expression, this._t.next());

            if (ret.expression.incomplete) {
                return ret;
            }
        }

        break;
    case Tn.T_DISCARD:
        ret = new DiscardStmt(tok);
        ret.semi = this._require_one_of([Tn.T_SEMICOLON]);

        if (this.type !== glsl.source.FRAGMENT) {
            this._error(tok.location, 'invalid use of discard outside of fragment shader');
            return ret;
        }

        return ret.complete();
    }

    ret.semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parse_jump_statement.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONTINUE:
    case Tn.T_BREAK:
    case Tn.T_RETURN:
    case Tn.T_DISCARD:
        return true;
    }

    return false;
};

Parser.prototype._parse_jump_statement.expected = function() {
    return ['continue', 'break', 'return', 'discard'];
};

Parser.prototype._parse_simple_statement = function(tok, m) {
    return m(tok);
};

match_one_of(Parser.prototype._parse_simple_statement, [
    Parser.prototype._parse_declaration_or_expression_statement,
    Parser.prototype._parse_selection_statement,
    Parser.prototype._parse_iteration_statement,
    Parser.prototype._parse_jump_statement
]);

Parser.prototype._parse_compound_statement = function(tok, newscope) {
    var block = new Block();

    block.new_scope = newscope;
    block.left_brace = tok;

    tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var ret = this._parse_rule(this._parse_statement_no_new_scope, tok);
        block.body.push(ret);

        if (ret.incomplete) {
            return ret;
        }

        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
        return block;
    }

    block.right_brace = tok;
    return block.complete();
};


Parser.prototype._parse_compound_statement_with_scope = function(tok) {
    return this._parse_compound_statement(tok, true);
};

Parser.prototype._parse_compound_statement_with_scope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
};

Parser.prototype._parse_compound_statement_with_scope.expected = function() {
    return ['opening curly brace {'];
};

Parser.prototype._parse_compound_statement_no_new_scope = function(tok) {
    return this._parse_compound_statement(tok, false);
};

Parser.prototype._parse_compound_statement_no_new_scope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
};

Parser.prototype._parse_compound_statement_no_new_scope.expected = function() {
    return ["opening scope brace {"];
};

Parser.prototype._parse_statement_no_new_scope = function(tok, m) {
    return m(tok);
};

match_one_of(Parser.prototype._parse_statement_no_new_scope, [
    Parser.prototype._parse_compound_statement_with_scope,
    Parser.prototype._parse_simple_statement
]);

match_one_of(Parser.prototype._parse_statement_with_scope, [
    Parser.prototype._parse_compound_statement_no_new_scope,
    Parser.prototype._parse_simple_statement
]);

Parser.prototype._parse_selection_rest_statement.match = Parser.prototype._parse_statement_with_scope.match;

Parser.prototype._parse_selection_rest_statement.expected = Parser.prototype._parse_statement_with_scope.expected;

Parser.prototype._parse_declaration_precision = function(tok) {
    var ret = new PrecisionStmt(tok);

    ret.qualifier = this._parse_rule(this._parse_precision_qualifier, this._t.next());

    if (ret.qualifier.incomplete) {
        return ret;
    }

    ret.type = this._parse_rule(this._parse_type_specifier_no_prec, this._t.next());

    if (ret.type.incomplete) {
        return ret;
    }

    ret.semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (ret.semi === null) {
        return ret;
    }

    return ret.complete();
};

Parser.prototype._parse_initializer = Parser.prototype._parse_assignment_expression;
Parser.prototype._parse_initializer.match = Parser.prototype._parse_assignment_expression.match;
Parser.prototype._parse_initializer.expected = Parser.prototype._parse_assignment_expression.expected;

Parser.prototype._parse_single_declaration = function(type, ident) {
    type = TypeRef.wrap_decl(type);
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

        named.initial_assign = n;
        named.initial_value = this._parse_rule(this._parse_initializer, this._t.next());

        if (named.initial_value.incomplete) {
            named.incomplete = true;
            return decl;
        }
    } else {
        this._parse_optional_array_spec(named);

        if (named.incomplete) {
            return decl;
        }
    }

    return decl.complete();
};

Parser.prototype._parse_init_declarator_list = function(decl, opts) {
    if (decl.incomplete) {
        return decl;
    }

    decl.incomplete = true;

    var tok = this._t.peek();

    while (tok.id == Tn.T_COMMA) {
        // consume comma
        this._t.next();

        var ident = this._require_one_of([Tn.T_IDENTIFIER]);

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

                if (this._parse_optional_array_spec(name)) {
                    isarray = true;
                }

                if (name.incomplete) {
                    return decl;
                }
            }

            if (!isarray && opts.equal && tok.id == Tn.T_EQUAL) {
                // consume peeked token
                this._t.next();

                name.initial_value = this._parse_rule(this._parse_initializer, this._t.next());
                name.initial_assign = tok;

                if (name.initial_value.incomplete) {
                    return decl;
                }
            }

            name.complete();
        }

        tok = this._t.peek();
    }

    decl.semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (decl.semi === null) {
        return decl;
    }

    return decl.complete();
};

Parser.prototype._parse_declaration = function(tok, m) {
    var decl = null;

    var opts = {equal: true, array: true};

    if (tok.id == Tn.T_PRECISION) {
        return this._parse_declaration_precision(tok);
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
                return this._parse_function_prototype_or_definition(type, ident);
            } else {
                decl = this._parse_single_declaration(type, ident);
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
    return this._parse_init_declarator_list(decl, opts);
};

Parser.prototype._parse_declaration.match = function(tok) {
    if (tok.id == Tn.T_PRECISION) {
        return true;
    }

    return this._match(this._parse_fully_specified_type, tok);
};

Parser.prototype._parse_declaration.expected = function() {
    return ['function prototype', 'function definition', 'struct declaration', 'variable declaration'];
};

Parser.prototype._parse_expression_statement = function(tok, m) {
    if (tok.id == Tn.T_SEMICOLON) {
        return (new EmptyStmt(tok)).complete();
    } else {
        var ret = this._parse_expression(tok, m);
        var stmt = new ExpressionStmt(ret);

        if (ret.incomplete) {
            return stmt;
        }

        stmt.semi = this._require_one_of([Tn.T_SEMICOLON]);

        if (stmt.semi === null) {
            return stmt;
        }

        return stmt.complete();
    }
};

Parser.prototype._parse_expression_statement.match = function(tok) {
    if (tok.id == Tn.T_SEMICOLON) {
        return true;
    }

    return this._match(this._parse_expression, tok);
};

Parser.prototype._parse_external_declaration = function(tok, m) {
    return m(tok);
};

Parser.prototype._sync_declaration = function(tok) {
    if (this._is_primitive_type(tok.id)) {
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

match_one_of(Parser.prototype._parse_external_declaration, [
    Parser.prototype._parse_declaration
]);

Parser.prototype._parse_tu = function() {
    while (!this._t.eof()) {
        var tok = this._t.next();

        if (tok.id == Tn.T_EOF) {
            this.comments = tok.comments;
            break;
        }

        var node = this._parse_rule(this._parse_external_declaration, tok);
        this.body.push(node);

        if (node.incomplete) {
            this._sync(this._sync_declaration);
        }
    }
};

Parser.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
};

Parser.prototype._match = function(rule, tok) {
    return rule.match.call(this, tok);
};

Parser.prototype._parse_rule = function(rule, tok) {
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

        this._error(tok.location, 'expected ' + ex + ' but got `' + this._t.token_name(tok.id) + '\'');
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
