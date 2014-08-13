"use strict";

if (!(typeof window == 'undefined')) {
    if (typeof window.glsl == 'undefined') {
        window.glsl = {};
    }

    window.glsl.ast = {};
} else {
    var glsl = {
        tokenizer: require('./tokenizer'),
        preprocessor: require('./preprocessor'),
        source: require('./source')
    }

    var util = require('util');
}

(function(exports) {

var Tn = glsl.tokenizer.Tokenizer;

function Error(loc, message) {
    glsl.source.Error.call(this, loc, message);
}

Error.prototype = Object.create(glsl.source.Error.prototype);
Error.prototype.constructor = Error;

function Node() {
}

Node.create = function(name, constructor) {
    var ret = Object.create(Node.prototype);

    ret.node_name = name;
    ret.constructor = constructor;

    return ret;
}

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

    if (Array.prototype.isPrototypeOf(v) && v.length == 0) {
        return true;
    }

    return false;
}

Node.prototype._marshal_object = function(value) {
    var ret = {};

    for (var k in value) {
        if (k[0] != '_' && value.hasOwnProperty(k) && !this._value_is_empty(value[k])) {
            var name = k;
            var val = value[k];

            if (typeof val == 'object' && Node.prototype.isPrototypeOf(val)) {
                name += '(' + val.node_name + ')';
            }

            ret[name] = this._marshal_value(val);
        }
    }

    return ret;
}

Node.prototype._marshal_array = function(value) {
    var ret = new Array(value.length);

    for (var i = 0; i < value.length; i++) {
        var val = value[i];

        if (typeof val == 'object' && Node.prototype.isPrototypeOf(val)) {
            var h = {};
            h[val.node_name] = this._marshal_value(val);

            ret[i] = h;
        } else {
            ret[i] = this._marshal_value(val);
        }
    }

    return ret;
}

Node.prototype._marshal_value = function(value) {
    if (typeof value.marshal == 'function') {
        return value.marshal();
    }

    if (typeof value != 'object') {
        return value;
    }

    if (Array.prototype.isPrototypeOf(value)) {
        return this._marshal_array(value);
    }

    return this._marshal_object(value);
}

Node.prototype.marshal = function() {
    return this._marshal_object(this);
}

Node.prototype.to_json = function() {
    return JSON.stringify(this, function(key, value) {
        if (key[0] == '_') {
            return null;
        }

        return value;
    });
}

function Type(tok) {
    Node.call(this);

    this.token = tok;
    this.qualifiers = [];
    this.is_builtin = (tok.id != Tn.T_IDENTIFIER);
}

Type.prototype = Node.create('Type', Type);

exports.Type = Type;

function StructDecl(stok, name) {
    Node.call(this);

    this.token = stok;
    this.name = name;

    this.left_brace = null;
    this.right_brace = null;

    this.fields = [];
}

StructDecl.prototype = Node.create('StructDecl', StructDecl);
exports.StructDecl = StructDecl;


function FieldDecl(type) {
    Node.call(this);

    this.type = type;
    this.names = [];
    this.semi = null;
}

FieldDecl.prototype = Node.create('FieldDecl', FieldDecl);
exports.FieldDecl = FieldDecl;


function PrecisionStmt(token, qualifier, type) {
    Node.call(this);

    this.token = token;
    this.qualifier = qualifier;
    this.type = type;

    this.semi = null;
}

PrecisionStmt.prototype = Node.create('PrecisionStmt', PrecisionStmt);
exports.PrecisionStmt = PrecisionStmt;


function InvariantDecl(token) {
    Node.call(this);

    this.token = token;
    this.names = [];

    this.semi = null;
}

InvariantDecl.prototype = Node.create('InvariantDecl', InvariantDecl);
exports.InvariantDecl = InvariantDecl;


function VariableDecl(type) {
    Node.call(this);

    this.type = type;
    this.names = [];

    this.semi = null;
}

VariableDecl.prototype = Node.create('VariableDecl', VariableDecl);
exports.VariableDecl = VariableDecl;


function TypeDecl(type) {
    Node.call(this);

    this.type = type;
    this.semi = null;
}

TypeDecl.prototype = Node.create('TypeDecl', TypeDecl);
exports.TypeDecl = TypeDecl;


function ParamDecl() {
    Node.call(this);

    this.type = null;
    this.name = null;
    this.qualifier = null;

    this.is_array = false;
    this.array_size = 0;
    this.left_bracket = null;
    this.right_bracket = null;
}

ParamDecl.prototype = Node.create('ParamDecl', ParamDecl);
exports.ParamDecl = ParamDecl;


function Named(name) {
    Node.call(this);

    this.name = name;

    this.initial_assign = null;
    this.initial_value = null;

    this.is_array = false;
    this.array_size = 0;
    this.left_bracket = null;
    this.right_bracket = null;
}

Named.prototype = Node.create('Named', Named);
exports.Named = Named;


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


function FunctionProto(header) {
    Node.call(this);

    this.header = header;
    this.semi = null;
}

FunctionProto.prototype = Node.create('FunctionProto', FunctionProto);
exports.FunctionProto = FunctionProto;


function FunctionDef(header) {
    Node.call(this);

    this.header = header;
    this.body = null;
}

FunctionDef.prototype = Node.create('FunctionDef', FunctionDef);
exports.FunctionDef = FunctionDef;


function Block() {
    Node.call(this);

    this.right_brace = null;
    this.left_brace = null;
    this.body = [];
    this.new_scope = true;
}

Block.prototype = Node.create('Block', Block);
exports.Block = Block;


function EmptyStmt(semi) {
    Node.call(this);

    this.semi = semi;
}

EmptyStmt.prototype = Node.create('EmptyStmt', EmptyStmt);
exports.EmptyStmt = EmptyStmt;


function ExpressionStmt(expr) {
    Node.call(this);

    this.expression = expr;
    this.semi = null;
}

ExpressionStmt.prototype = Node.create('ExpressionStmt', ExpressionStmt);
exports.ExpressionStmt = ExpressionStmt;


function ExpressionListStmt() {
    Node.call(this);

    this.expressions = [];
    this.semi = null;
}

ExpressionListStmt.prototype = Node.create('ExpressionListStmt', ExpressionListStmt);
exports.ExpressionListStmt = ExpressionListStmt;


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


function SelectionElseStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.body = null;
}

SelectionElseStmt.prototype = Node.create('SelectionElseStmt', SelectionElseStmt);
exports.SelectionElseStmt = SelectionElseStmt;


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


function DoStmt(dtok, wtok) {
    Node.call(this);

    this.do_token = dtok;
    this.while_token = wtok;

    this.left_paren = null;
    this.condition = null;
    this.right_paren = null;
    this.body = null;
}

DoStmt.prototype = Node.create('DoStmt', DoStmt);
exports.DoStmt = DoStmt;


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


function ForRestStmt(cond) {
    Node.call(this);

    this.condition = cond;
    this.semi = null;
    this.expression = null;
}

ForRestStmt.prototype = Node.create('ForRestStmt', ForRestStmt);
exports.ForRestStmt = ForRestStmt;


function ContinueStmt(tok) {
    Node.call(this);

    this.token = tok;
}

ContinueStmt.prototype = Node.create('ContinueStmt', ContinueStmt);
exports.ContinueStmt = ContinueStmt;


function BreakStmt(tok) {
    Node.call(this);

    this.token = tok;
}

BreakStmt.prototype = Node.create('BreakStmt', BreakStmt);
exports.BreakStmt = BreakStmt;


function ReturnStmt(tok) {
    Node.call(this);

    this.token = tok;
    this.expression = null;
}

ReturnStmt.prototype = Node.create('ReturnStmt', ReturnStmt);
exports.ReturnStmt = ReturnStmt;


function DiscardStmt(tok) {
    Node.call(this);

    this.token = tok;
}

DiscardStmt.prototype = Node.create('DiscardStmt', DiscardStmt);
exports.DiscardStmt = DiscardStmt;


function AssignmentExpr(lexpr, op, rexpr) {
    Node.call(this);

    this.lhs = lexpr;
    this.op = op;
    this.rhs = rexpr;
}

AssignmentExpr.prototype = Node.create('AssignmentExpr', AssignmentExpr);
exports.AssignmentExpr = AssignmentExpr;


function TernaryExpr(condition, qtok, trueexpr, ctok, falseexpr) {
    Node.call(this);

    this.condition = condition;
    this.question_token = qtok;
    this.true_expression = trueexpr;
    this.colon_token = ctok;
    this.false_expression = falseexpr;
}

TernaryExpr.prototype = Node.create('TernaryExpr', TernaryExpr);
exports.TernaryExpr = TernaryExpr;


function BinOpExpr(lhs, op, rhs) {
    Node.call(this);

    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
}

BinOpExpr.prototype = Node.create('BinOpExpr', BinOpExpr);
exports.BinOpExpr = BinOpExpr;


function UnaryOpExpr(op, rhs) {
    Node.call(this);

    this.op = op;
    this.expression = rhs;
}

UnaryOpExpr.prototype = Node.create('UnaryOpExpr', UnaryOpExpr);
exports.UnaryOpExpr = UnaryOpExpr;


function UnaryPostfixOpExpr(op, rhs) {
    Node.call(this);

    this.op = op;
    this.expression = rhs;
}

UnaryPostfixOpExpr.prototype = Node.create('UnaryPostfixOpExpr', UnaryPostfixOpExpr);
exports.UnaryPostfixOpExpr = UnaryPostfixOpExpr;


function ConstantExpr(token) {
    Node.call(this);

    this.token = token;
}

ConstantExpr.prototype = Node.create('ConstantExpr', ConstantExpr);
exports.ConstantExpr = ConstantExpr;


function GroupExpr(lparen, expr, rparen) {
    Node.call(this);

    this.left_paren = lparen;
    this.expression = expr;
    this.right_paren = rparen;
}

GroupExpr.prototype = Node.create('GroupExpr', GroupExpr);
exports.GroupExpr = GroupExpr;


function VariableExpr(name) {
    Node.call(this);

    this.name = name;
}

VariableExpr.prototype = Node.create('VariableExpr', VariableExpr);
exports.VariableExpr = VariableExpr;


function FunctionCallExpr(name) {
    Node.call(this);

    this.name = name;
    this.left_paren = null;
    this.right_paren = null;
    this.arguments = [];
}

FunctionCallExpr.prototype = Node.create('FunctionCallExpr', FunctionCallExpr);
exports.FunctionCallExpr = FunctionCallExpr;


function FieldSelectionExpr(expr, selector) {
    Node.call(this);

    this.expression = expr;
    this.selector = selector;
}

FieldSelectionExpr.prototype = Node.create('FieldSelectionExpr', FieldSelectionExpr);
exports.FieldSelectionExpr = FieldSelectionExpr;


function IndexExpr(expr, index) {
    Node.call(this);

    this.expression = expr;

    this.right_bracket = null;
    this.index = index;
    this.left_bracket = null;
}

IndexExpr.prototype = Node.create('IndexExpr', IndexExpr);
exports.IndexExpr = IndexExpr;


function Parser(source) {
    this._preprocessor = new glsl.preprocessor.Preprocessor(source);
    this._t = new Tn(this._preprocessor);

    this._errors = [];

    this.body = [];
    this.comments = this._t.comments();

    this._parse_tu();
}

Parser.prototype = Node.create('Parser')

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


    return false;
}

Parser.prototype._require_one_of = function(ids) {
    var tok = this._t.next();

    for (var i = 0; i < ids.length; i++) {
        if (tok.id == ids[i]) {
            return tok;
        }
    }

    return this._require_one_of_error(ids, tok);
}

Parser.prototype._match_one_of = function(matchers, tok) {
    for (var i = 0; i < matchers.length; i++) {
        var m = matchers[i];

        var ret = this._match(m, tok);

        if (ret) {
            return (function(m, tok, t) {
                return m.call(this, tok, ret);
            }).bind(this, m);
        }
    }

    return false;
}

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

    if (!ret) {
        return false;
    }

    tok = this._t.peek();

    while (opid(tok.id)) {
        var op = tok;

        // consume peeked token
        this._t.next();

        var rhs = this._parse_rule(rule, this._t.next());

        if (!rhs) {
            return false;
        }

        ret = new BinOpExpr(ret, op, rhs);
        tok = this._t.peek();
    }

    return ret;
}

Parser.prototype._parse_function_call = function(tok, m) {
    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    var cl = new FunctionCallExpr(tok);

    var n = this._t.peek();

    if (this._match(this._parse_assignment_expression, n)) {
        while (true) {
            var ret = this._parse_rule(this._parse_assignment_expression, this._t.next());
            if (!ret) {
                return false;
            }

            cl.arguments.push(ret);

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

    var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (!rp) {
        return false;
    }

    cl.left_paren = lp;
    cl.right_paren = rp;

    return cl;
}

Parser.prototype._parse_function_identifier = function(tok) {
    return tok;
}

Parser.prototype._parse_function_identifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_IDENTIFIER:
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
}

Parser.prototype._parse_primary_expression = function(tok, m) {
    if (this._parse_function_identifier.match(tok)) {
        var n = this._t.peek();

        if (n.id == Tn.T_LEFT_PAREN) {
            return this._parse_function_call(tok);
        }

        return new VariableExpr(tok);
    }

    switch (tok.id) {
    case Tn.T_INTCONSTANT:
    case Tn.T_FLOATCONSTANT:
    case Tn.T_BOOLCONSTANT:
        return new ConstantExpr(tok);
    case Tn.T_LEFT_PAREN:
        var expr = this._parse_rule(this._parse_expression, this._t.next());

        if (!expr) {
            return false;
        }

        var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

        if (!rp) {
            return false;
        }

        return new GroupExpr(tok, expr, rp);
    }
}

Parser.prototype._parse_primary_expression.match = function(tok) {
    switch (tok.id) {
    case Tn.T_INTCONSTANT:
    case Tn.T_FLOATCONSTANT:
    case Tn.T_BOOLCONSTANT:
    case Tn.T_LEFT_PAREN:
        return true;
    }

    return this._match(this._parse_function_identifier, tok);
}

Parser.prototype._parse_primary_expression.expected = function() {
    return ['identifier', 'integer', 'float', 'bool', 'grouped expression'];
}

Parser.prototype._parse_postfix_expression = function(tok, m) {
    var expr = this._parse_primary_expression(tok, m);

    if (!expr) {
        return false;
    }

    tok = this._t.peek();

    while (tok.id != Tn.T_EOF) {
        switch (tok.id) {
        case Tn.T_LEFT_BRACKET:
            // consume peeked token
            this._t.next();

            var iexpr = this._parse_rule(this._parse_expression, this._t.next());

            if (!iexpr) {
                return false;
            }

            var rb = this._require_one_of([Tn.T_RIGHT_BRACKET]);

            if (!rb) {
                return false;
            }

            expr = new IndexExpr(expr, iexpr);
            expr.left_bracket = tok;
            expr.right_bracket = rb;

            break;
        case Tn.T_DOT:
            // consume peeked token
            this._t.next();

            var name = this._require_one_of([Tn.T_IDENTIFIER]);

            if (!name) {
                return false;
            }

            expr = new FieldSelectionExpr(expr, name);
            break;
        case Tn.T_INC_OP:
        case Tn.T_DEC_OP:
            expr = new UnaryPostfixOpExpr(tok, expr);

            // consume peeked token
            this._t.next();
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
}

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

        if (!expr) {
            return false;
        }

        return new UnaryOpExpr(tok, expr);
    }

    return this._parse_postfix_expression(tok, m);
}

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
}

Parser.prototype._parse_unary_expression.expected = function() {
    return ['unary operator'].concat(this._parse_postfix_expression.expected.call(this));
}

Parser.prototype._parse_multiplicative_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_STAR ||
                                                               id == Tn.T_SLASH ||
                                                               id == Tn.T_PERCENT; },
                                        this._parse_unary_expression);
}

Parser.prototype._parse_multiplicative_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_multiplicative_expression.expected = Parser.prototype._parse_unary_expression.expected;


Parser.prototype._parse_additive_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_PLUS ||
                                                               id == Tn.T_DASH; },
                                        this._parse_multiplicative_expression);
}

Parser.prototype._parse_additive_expression.match = Parser.prototype._parse_multiplicative_expression.match;

Parser.prototype._parse_additive_expression.expected = Parser.prototype._parse_multiplicative_expression.expected;


Parser.prototype._parse_shift_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_LEFT_OP ||
                                                               id == Tn.T_RIGHT_OP; },
                                        this._parse_additive_expression);
}

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
}

Parser.prototype._parse_relational_expression.match = Parser.prototype._parse_shift_expression.match;

Parser.prototype._parse_relational_expression.expected = Parser.prototype._parse_shift_expression.expected;


Parser.prototype._parse_equality_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_EQ_OP || id == Tn.T_NE_OP; },
                                        this._parse_relational_expression);
}

Parser.prototype._parse_equality_expression.match = Parser.prototype._parse_relational_expression.match;

Parser.prototype._parse_equality_expression.expected = Parser.prototype._parse_relational_expression.expected;

Parser.prototype._parse_and_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AMPERSAND; },
                                        this._parse_equality_expression);
}


Parser.prototype._parse_and_expression.match = Parser.prototype._parse_equality_expression.match;

Parser.prototype._parse_and_expression.expected = Parser.prototype._parse_equality_expression.expected;


Parser.prototype._parse_exclusive_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_CARET; },
                                        this._parse_and_expression);
}

Parser.prototype._parse_exclusive_or_expression.match = Parser.prototype._parse_and_expression.match;

Parser.prototype._parse_exclusive_or_expression.expected = Parser.prototype._parse_and_expression.expected;


Parser.prototype._parse_inclusive_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function(id) { return id == Tn.T_VERTICAL_BAR; },
                                        this._parse_exclusive_or_expression);
}

Parser.prototype._parse_inclusive_or_expression.match = Parser.prototype._parse_exclusive_or_expression.match;

Parser.prototype._parse_inclusive_or_expression.expected = Parser.prototype._parse_exclusive_or_expression.expected;

Parser.prototype._parse_logical_and_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_AND_OP; },
                                        this._parse_inclusive_or_expression);
}

Parser.prototype._parse_logical_and_expression.match = Parser.prototype._parse_inclusive_or_expression.match;

Parser.prototype._parse_logical_and_expression.expected = Parser.prototype._parse_inclusive_or_expression.expected;

Parser.prototype._parse_logical_xor_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_XOR_OP; },
                                        this._parse_logical_and_expression);
}

Parser.prototype._parse_logical_xor_expression.match = Parser.prototype._parse_logical_and_expression.match;

Parser.prototype._parse_logical_xor_expression.expected = Parser.prototype._parse_logical_and_expression.expected;

Parser.prototype._parse_logical_or_expression = function(tok, m, expr) {
    return this._parse_binop_expression(tok,
                                        m,
                                        expr,
                                        function (id) { return id == Tn.T_OR_OP; },
                                        this._parse_logical_xor_expression);
}

Parser.prototype._parse_logical_or_expression.match = Parser.prototype._parse_logical_xor_expression.match;

Parser.prototype._parse_logical_or_expression.expected = Parser.prototype._parse_logical_xor_expression.expected;

Parser.prototype._parse_unary_conditional_expression_rest = function(expr) {
    if (!expr) {
        return false;
    }

    var n = this._t.peek();

    if (n != null && n.id == Tn.T_QUESTION) {
        var q = this._t.next();

        var trueexpr = this._parse_rule(this._parse_expression, this._t.next());

        if (!trueexpr) {
            return false;
        }

        var colon = this._require_one_of([Tn.T_COLON]);

        var falseexpr = this._parse_rule(this._parse_assignment_expression, this._t.next());

        if (!falseexpr) {
            return false;
        }

        return new TernaryExpr(expr, q, trueexpr, colon, falseexpr);
    }

    return expr;
}

Parser.prototype._parse_unary_conditional_expression = function(expr) {
    var tok, m;

    var expr = this._parse_logical_or_expression(tok, m, expr);
    return this._parse_unary_conditional_expression_rest(expr);
}

Parser.prototype._parse_conditional_expression = function(tok, m) {
    var expr = this._parse_logical_or_expression(tok, m);
    return this._parse_unary_conditional_expression_rest(expr);
}

Parser.prototype._parse_conditional_expression.match = Parser.prototype._parse_logical_or_expression.match;

Parser.prototype._parse_conditional_expression.expected = Parser.prototype._parse_logical_or_expression.expected;

Parser.prototype._parse_assignment_operator = function(tok, m) {
    return tok;
}

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
}

Parser.prototype._parse_assignment_operator.expected = function() {
    return ['assignment operator'];
}

Parser.prototype._parse_unary_assignment_expression = function(expr) {
    var op = this._parse_rule(this._parse_assignment_operator, this._t.next());

    if (!op) {
        return false;
    }

    var asexpr = this._parse_rule(this._parse_assignment_expression, this._t.next());

    if (!asexpr) {
        return false;
    }

    return new AssignmentExpr(expr, op, asexpr);
}

Parser.prototype._parse_unary_assignment_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_unary_assignment_expression.expected = Parser.prototype._parse_unary_expression.expected;

Parser.prototype._parse_assignment_expression = function(tok, m) {
    var expr = this._parse_unary_expression(tok, m);

    if (!expr) {
        return false;
    }

    var n = this._t.peek();
    var m = this._match(this._parse_assignment_operator, n);

    if (m) {
        return this._parse_unary_assignment_expression(expr);
    } else {
        return this._parse_unary_conditional_expression(expr);
    }
}

Parser.prototype._parse_assignment_expression.match = Parser.prototype._parse_unary_expression.match;

Parser.prototype._parse_assignment_expression.expected = Parser.prototype._parse_unary_expression;

Parser.prototype._parse_expression = function(tok, m) {
    var expr = this._parse_assignment_expression(tok, m);

    if (!expr) {
        return false;
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

        if (!expr) {
            return false;
        }

        ret.expressions.push(expr);
        tok = this._t.peek();
    }

    return ret;
}

Parser.prototype._parse_expression.match = Parser.prototype._parse_assignment_expression.match;
Parser.prototype._parse_expression.expected = Parser.prototype._parse_assignment_expression.expected;

Parser.prototype._parse_constant_expression = Parser.prototype._parse_conditional_expression;
Parser.prototype._parse_constant_expression.match = Parser.prototype._parse_conditional_expression.match;
Parser.prototype._parse_constant_expression.expected = Parser.prototype._parse_conditional_expression.expected;

Parser.prototype._parse_field_declaration_name = function(tok) {
    var name = tok;

    var ret = new Named(name);

    var optarr = this._parse_optional_array_spec(ret);

    if (optarr === false) {
        return false;
    }

    return ret;
}

Parser.prototype._parse_field_declaration_name.match = function(tok) {
    return tok.id == Tn.T_IDENTIFIER;
}

Parser.prototype._parse_field_declaration_name.expected = function() {
    return ['field name'];
}

Parser.prototype._parse_field_declaration = function(tok, m) {
    var type = m(tok);

    if (!type) {
        return false;
    }

    tok = this._t.next();
    var first = true;

    var sdecl = new FieldDecl(type);

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_SEMICOLON) {
        if (!first) {
            if (tok.id != Tn.T_COMMA) {
                return this._require_one_of_error([Tn.T_COMMA], tok);
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var fname = this._parse_rule(this._parse_field_declaration_name, tok);

        if (!fname) {
            return false;
        }

        sdecl.names.push(fname);
        tok = this._t.next();
    }

    if (tok.id != Tn.T_SEMICOLON) {
        return this._require_one_of_error([Tn.T_SEMICOLON], tok);
    }

    sdecl.semi = tok;
    return sdecl;
}

Parser.prototype._parse_struct_specifier = function(tok) {
    var lb = this._t.next();

    if (lb.id != Tn.T_IDENTIFIER && lb.id != Tn.T_LEFT_BRACE ) {
        return this._require_one_of_error([Tn.T_IDENTIFIER, Tn.T_LEFT_BRACE], lb);
    }

    var name = null;

    if (lb.id == Tn.T_IDENTIFIER) {
        name = lb;
        lb = this._t.next();
    }

    if (lb.id != Tn.T_LEFT_BRACE) {
        return this._require_one_of_error([Tn.T_LEFT_BRACE], lb);
    }

    var sdl = new StructDecl(tok, name);
    sdl.left_brace = lb;

    tok = this._t.next();

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var decl = this._parse_rule(this._parse_field_declaration, tok);

        if (!decl) {
            return false;
        }

        sdl.fields.push(decl);
        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        return this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
    }

    sdl.right_brace = tok;
    return sdl;
}

Parser.prototype._parse_struct_specifier.match = function(tok) {
    return tok.id == Tn.T_STRUCT;
}

Parser.prototype._parse_type_specifier_no_prec_impl = function(tok) {
    return new Type(tok);
}

Parser.prototype._parse_type_specifier_no_prec = function(tok, m) {
    return m(tok);
}

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
}

Parser.prototype._parse_type_specifier_no_prec.expected = function() {
    return ['builtin type', 'user type identifier'];
}

Parser.prototype._parse_type_specifier = function(tok, m) {
    return m(tok);
}

Parser.prototype._parse_precision_qualifier = function(tok, m) {
    return tok;
}

Parser.prototype._parse_precision_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_HIGH_PRECISION:
    case Tn.T_MEDIUM_PRECISION:
    case Tn.T_LOW_PRECISION:
        return true;
    }

    return false;
}

Parser.prototype._parse_precision_qualifier.expected = function() {
    return ['highp', 'mediump', 'lowp']
}

Parser.prototype._parse_type_precision_qualifier = function(tok, m) {
    var type = this._parse_rule(this._parse_type_specifier_no_prec, this._t.next());

    if (!type) {
        return false;
    }

    type.qualifiers.unshift(tok);
    return type;
}

Parser.prototype._parse_type_precision_qualifier.match = Parser.prototype._parse_precision_qualifier.match;

Parser.prototype._parse_type_precision_qualifier.expected = Parser.prototype._parse_precision_qualifier.expected;

match_one_of(Parser.prototype._parse_type_specifier, [
    Parser.prototype._parse_type_specifier_no_prec,
    Parser.prototype._parse_type_precision_qualifier
])

Parser.prototype._parse_field_declaration.match = Parser.prototype._parse_type_specifier.match;

Parser.prototype._parse_type_qualifier = function(tok) {
    var node;

    if (tok.id == Tn.T_INVARIANT) {
        var varying = this._require_one_of([Tn.T_VARYING]);

        if (!varying) {
            return false;
        }

        node = this._parse_rule(this._parse_type_specifier, this._t.next());

        if (node) {
            node.qualifiers.unshift(varying);
        }
    } else {
        node = this._parse_rule(this._parse_type_specifier, this._t.next());
    }

    if (node) {
        node.qualifiers.unshift(tok);
    }

    return node;
}

Parser.prototype._parse_type_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONST:
    case Tn.T_ATTRIBUTE:
    case Tn.T_VARYING:
    case Tn.T_INVARIANT:
    case Tn.T_UNIFORM:
        return true;
    }
}

Parser.prototype._parse_type_qualifier.expected = function() {
    return ['const', 'attribute', 'varying', 'invariant', 'uniform'];
}

Parser.prototype._parse_fully_specified_type = function(tok, m) {
    return m(tok);
}

match_one_of(Parser.prototype._parse_fully_specified_type, [
    Parser.prototype._parse_type_specifier,
    Parser.prototype._parse_type_qualifier
])

Parser.prototype._parse_optional_array_spec = function(ret) {
   var tok = this._t.peek();

    if (tok.id == Tn.T_LEFT_BRACKET) {
        ret.is_array = true;
        ret.left_bracket = tok;

        // consume peeked token
        this._t.next();

        var expr = this._parse_rule(this._parse_constant_expression, this._t.next());

        if (!expr) {
            return false;
        }

        ret.array_size = expr;

        var rb = this._require_one_of([Tn.T_RIGHT_BRACKET]);

        if (!rb) {
            return false;
        }

        ret.right_bracket = rb;
        return ret;
    } else {
        return null;
    }
}

Parser.prototype._parse_parameter_declarator = function(tok, m) {
    var type = this._parse_type_specifier(tok, m);

    if (!type) {
        return false;
    }

    tok = this._t.peek();

    var pdecl = new ParamDecl();
    pdecl.type = type;

    if (tok.id == Tn.T_IDENTIFIER) {
        pdecl.name = this._t.next();
    }

    var optarr = this._parse_optional_array_spec(pdecl);

    if (optarr === false) {
        return false;
    }

    return pdecl;
}

Parser.prototype._parse_parameter_declarator.match = Parser.prototype._parse_type_specifier.match;
Parser.prototype._parse_parameter_declarator.expected = Parser.prototype._parse_type_specifier.expected;

Parser.prototype._parse_parameter_qualifier = function(tok) {
    var ret = this._parse_rule(this._parse_parameter_declarator, this._t.next());

    if (!ret) {
        return false;
    }

    ret.qualifier = tok;
    return ret;
}

Parser.prototype._parse_parameter_qualifier.match = function(tok) {
    switch (tok.id) {
    case Tn.T_IN:
    case Tn.T_OUT:
    case Tn.T_INOUT:
        return true;
    }

    return false;
}

Parser.prototype._parse_parameter_qualifier.expected = function(tok) {
    return ['in', 'out', 'inout'];
}

Parser.prototype._parse_parameter_type_qualifier = function(tok, m) {
    var q = tok;

    tok = this._t.next();

    m = this._match(this._parse_parameter_qualifier, tok);

    var decl = false;

    if (m) {
        decl = this._parse_parameter_qualifier(tok, m);
    } else {
        decl = this._parse_rule(this._parse_parameter_declarator, tok);
    }

    if (!decl) {
        return false;
    }

    decl.qualifier = q;
    return decl;
}

Parser.prototype._parse_parameter_type_qualifier.match = function (tok) {
    return tok.id == Tn.T_CONST;
}

Parser.prototype._parse_parameter_type_qualifier.expected = function() {
    return ["const"];
}

Parser.prototype._parse_parameter_declaration = function(tok, m) {
    return m(tok);
}

match_one_of(Parser.prototype._parse_parameter_declaration, [
    Parser.prototype._parse_parameter_type_qualifier,
    Parser.prototype._parse_parameter_qualifier,
    Parser.prototype._parse_parameter_declarator
]);

Parser.prototype._parse_function_header = function(type, name) {
    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    var tok = this._t.next();
    var first = true;

    var func = new FunctionHeader(type, name);
    func.left_paren = lp;

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_PAREN) {
        if (!first) {
            if (tok.id != Tn.T_COMMA) {
                return this._require_one_of_error([Tn.T_COMMA], tok);
            }

            tok = this._t.next();
        } else {
            first = false;
        }

        var m = this._parse_rule(this._parse_parameter_declaration, tok);

        if (!m) {
            return false;
        }

        func.parameters.push(m);
        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_PAREN) {
        return this._require_one_of_error([Tn.T_RIGHT_PAREN], tok);
    }

    func.right_paren = tok;
    return func;
}

Parser.prototype._parse_function_prototype_or_definition = function(type, ident) {
    var ret = this._parse_function_header(type, ident);

    if (!ret) {
        return false;
    }

    var n = this._require_one_of([Tn.T_SEMICOLON, Tn.T_LEFT_BRACE]);

    if (!n) {
        return false;
    }

    if (n.id == Tn.T_SEMICOLON) {
        var proto = new FunctionProto(ret);
        proto.semi = n;
        return proto;
    } else {
        var func = new FunctionDef(ret);
        func.body = new Block();

        func.body.left_brace = n;

        var tok = this._t.next();

        while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
            var ret = this._parse_rule(this._parse_statement_no_new_scope, tok);

            if (!ret) {
                return false;
            }

            func.body.body.push(ret);
            tok = this._t.next();
        }

        if (tok.id != Tn.T_RIGHT_BRACE) {
            this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
        }

        func.body.right_brace = tok;
        return func;
    }
}

Parser.prototype._parse_statement_with_scope = function(tok, m) {
    return m(tok);
}

Parser.prototype._parse_selection_rest_statement = function(tok, m) {
    var stmt = this._parse_statement_with_scope(tok, m);

    if (!stmt) {
        return false;
    }

    var n = this._t.peek();
    var ret = {body: stmt, els: null};

    if (n.id == Tn.T_ELSE) {
        var selelse = new SelectionElseStmt(n);
        ret.els = selelse;

        // consume peeked token
        this._t.next();

        var b = this._parse_rule(this._parse_statement_with_scope, this._t.next());

        if (!b) {
            return false;
        }

        selelse.body = b;
    }

    return ret;
}

Parser.prototype._parse_selection_statement = function(tok, m) {
    var sel = new SelectionStmt(tok);

    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    sel.left_paren = lp;

    tok = this._t.next();

    var expr = this._parse_rule(this._parse_expression, tok);

    if (!expr) {
        return false;
    }

    sel.condition = expr;

    var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (!rp) {
        return false;
    }

    sel.right_paren = rp;

    tok = this._t.next();

    var ret = this._parse_rule(this._parse_selection_rest_statement, tok);

    if (!ret) {
        return false;
    }

    sel.body = ret.body;
    sel.els = ret.els;

    return sel;
}

Parser.prototype._parse_selection_statement.match = function(tok) {
    return tok.id == Tn.T_IF;
}

Parser.prototype._parse_selection_statement.expected = function() {
    return ["if"];
}

Parser.prototype._parse_condition_var_init = function(tok, m) {
    var type = this._parse_fully_specified_type(tok, m);

    if (!type) {
        return false;
    }

    var ident = this._require_one_of([Tn.T_IDENTIFIER]);

    if (!ident) {
        return false;
    }

    var equal = this._require_one_of([Tn.T_EQUAL]);

    if (!equal) {
        return false;
    }

    var init = this._parse_rule(this._parse_initializer, this._t.next());

    if (!init) {
        return false;
    }

    var ret = new VariableDecl(type);
    var named = new Named(ident);

    named.initial_assign = equal;
    named.initial_value = init;

    ret.names.push(named);

    return ret;
}

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
}

match_one_of(Parser.prototype._parse_condition, [
    Parser.prototype._parse_condition_var_init,
    Parser.prototype._parse_expression
]);

Parser.prototype._parse_condition.expected = function() {
    return ["condition expression"];
}

Parser.prototype._parse_while_statement = function(tok) {
    var wtok = tok;
    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    tok = this._t.next();

    var cond = this._parse_rule(this._parse_condition, tok);

    if (!cond) {
        return false;
    }

    var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (!rp) {
        return false;
    }

    var stmt = this._parse_rule(this._parse_statement_no_new_scope, this._t.next());

    if (!stmt) {
        return false;
    }

    var ret = new WhileStmt(wtok);
    ret.left_paren = lp;
    ret.condition = cond;
    ret.right_paren = rp;
    ret.body = stmt;

    return ret;
}

Parser.prototype._parse_while_statement.match = function(tok) {
    return tok.id == Tn.T_WHILE;
}

Parser.prototype._parse_while_statement.expected = function() {
    return ["while"];
}

Parser.prototype._parse_do_statement = function(tok) {
    var dtok = tok;

    var stmt = this._parse_rule(this._parse_statement_with_scope, this._t.next());

    if (!stmt) {
        return false;
    }

    var wtok = this._require_one_of([Tn.T_WHILE]);

    if (!wtok) {
        return false;
    }

    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    tok = this._t.next();

    var cond = this._parse_rule(this._parse_expression, tok);

    if (!cond) {
        return false;
    }

    var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (!rp) {
        return false;
    }

    var semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (!semi) {
        return false;
    }

    var ret = new DoStmt(dtok, wtok);
    ret.left_paren = lp;
    ret.condition = cond;
    ret.right_paren = rp;
    ret.body = stmt;
    ret.semi = semi;

    return ret;
}

Parser.prototype._parse_do_statement.match = function(tok) {
    return tok.id == Tn.T_DO;
}

Parser.prototype._parse_do_statement.expected = function() {
    return ["do"];
}

Parser.prototype._parse_declaration_or_expression_statement = function(tok, m) {
    // Check for double identifier, should be a declaration
    if (tok.id == Tn.T_IDENTIFIER) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            return this._parse_declaration(tok, this._match(this._parse_declaration, tok));
        } else {
            // go for the expression
            var ret = this._parse_expression_statement(tok, this._match(this._parse_expression_statement, tok));
            return ret;
        }
    }

    var m = this._match(this._parse_declaration, tok);

    if (m) {
        return this._parse_declaration(tok, m);
    } else {
        return this._parse_rule(this._parse_expression_statement, tok);
    }
}

Parser.prototype._parse_declaration_or_expression_statement.match = function(tok) {
    // Either a declaration or an expression here, but we need lookahead
    var m = this._match(this._parse_declaration, tok);

    if (!m) {
        m = this._match(this._parse_expression_statement, tok);
    }

    return m;
}

Parser.prototype._parse_declaration_or_expression_statement.expected = function() {
    return ['declaration', 'expression'];
}

Parser.prototype._parse_for_init_statement = function(tok, m) {
    return this._parse_declaration_or_expression_statement(tok, m);
}

Parser.prototype._parse_for_init_statement.match = Parser.prototype._parse_declaration_or_expression_statement.match;

Parser.prototype._parse_conditionopt = function(tok, m) {
    m = this._match(this._parse_condition, tok);

    if (!m) {
        return null;
    }

    return this._parse_condition(tok, m);
}

Parser.prototype._parse_conditionopt.match = function(tok) {
    return true;
}

Parser.prototype._parse_for_rest_statement = function(tok, m) {
    var copt = this._parse_rule(this._parse_conditionopt, tok);

    if (copt == false) {
        return false;
    }

    var ret = new ForRestStmt(copt);

    var semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (!semi) {
        return false;
    }

    ret.semi = semi;

    var n = this._t.peek();
    var m = this._match(this._parse_expression, n);

    if (m) {
        var expr = this._parse_expression(this._t.next(), m);

        if (!expr) {
            return false;
        }

        ret.expression = expr;
    }

    return ret;
}

Parser.prototype._parse_for_rest_statement.match = Parser.prototype._parse_conditionopt.match;

Parser.prototype._parse_for_statement = function(tok) {
    var ftok = tok;
    var lp = this._require_one_of([Tn.T_LEFT_PAREN]);

    if (!lp) {
        return false;
    }

    tok = this._t.next();

    var init = this._parse_rule(this._parse_for_init_statement, tok);

    if (!init) {
        return false;
    }

    tok = this._t.next();

    var rest = this._parse_rule(this._parse_for_rest_statement, tok);

    if (!rest) {
        return false;
    }

    var rp = this._require_one_of([Tn.T_RIGHT_PAREN]);

    if (!rp) {
        return false;
    }

    var stmt = this._parse_rule(this._parse_statement_no_new_scope, this._t.next());

    if (!stmt) {
        return false;
    }

    var ret = new ForStmt(ftok);

    ret.left_paren = lp;
    ret.init = init;
    ret.rest = rest;
    ret.right_paren = rp;
    ret.body = stmt;

    return ret;
}

Parser.prototype._parse_for_statement.match = function(tok) {
    return tok.id == Tn.T_FOR;
}

Parser.prototype._parse_for_statement.expected = function() {
    return ["for"];
}

Parser.prototype._parse_iteration_statement = function(tok, m) {
    return m(tok);
}

match_one_of(Parser.prototype._parse_iteration_statement, [
    Parser.prototype._parse_while_statement,
    Parser.prototype._parse_do_statement,
    Parser.prototype._parse_for_statement
]);

Parser.prototype._parse_jump_statement = function(tok, m) {
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

        if (n != null && n.id != Tn.T_SEMICOLON) {
            var expr = this._parse_rule(this._parse_expression, this._t.next());

            if (!expr) {
                return false;
            }

            ret.expression = expr;
        }

        break;
    case Tn.T_DISCARD:
        ret = new DiscardStmt(tok);
        break;
    }

    var semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (!semi) {
        return false;
    }

    ret.semi = semi;
    return ret;
}

Parser.prototype._parse_jump_statement.match = function(tok) {
    switch (tok.id) {
    case Tn.T_CONTINUE:
    case Tn.T_BREAK:
    case Tn.T_RETURN:
    case Tn.T_DISCARD:
        return true;
    }

    return false;
}

Parser.prototype._parse_jump_statement.expected = function() {
    return ['continue', 'break', 'return', 'discard'];
}

Parser.prototype._parse_simple_statement = function(tok, m) {
    return m(tok);
}

match_one_of(Parser.prototype._parse_simple_statement, [
    Parser.prototype._parse_declaration_or_expression_statement,
    Parser.prototype._parse_selection_statement,
    Parser.prototype._parse_iteration_statement,
    Parser.prototype._parse_jump_statement
]);

Parser.prototype._parse_compound_statement = function(tok, newscope) {
    var lb = tok;

    tok = this._t.next();

    var block = new Block();

    block.new_scope = newscope;
    block.left_brace = lb;

    while (tok.id != Tn.T_EOF && tok.id != Tn.T_RIGHT_BRACE) {
        var ret = this._parse_rule(this._parse_statement_no_new_scope, tok);

        if (!ret) {
            return false;
        }

        block.body.push(ret);
        tok = this._t.next();
    }

    if (tok.id != Tn.T_RIGHT_BRACE) {
        return this._require_one_of_error([Tn.T_RIGHT_BRACE], tok);
    }

    block.right_brace = tok;
    return block;
}


Parser.prototype._parse_compound_statement_with_scope = function(tok) {
    return this._parse_compound_statement(tok, true);
}

Parser.prototype._parse_compound_statement_with_scope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
}

Parser.prototype._parse_compound_statement_with_scope.expected = function() {
    return ['opening curly brace {'];
}

Parser.prototype._parse_compound_statement_no_new_scope = function(tok) {
    return this._parse_compound_statement(tok, false);
}

Parser.prototype._parse_compound_statement_no_new_scope.match = function(tok) {
    return tok.id == Tn.T_LEFT_BRACE;
}

Parser.prototype._parse_compound_statement_no_new_scope.expected = function() {
    return ["opening scope brace {"];
}

Parser.prototype._parse_statement_no_new_scope = function(tok, m) {
    return m(tok);
}

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
    var q = this._parse_rule(this._parse_precision_qualifier, this._t.next());

    if (!q) {
        return false;
    }

    var type = this._parse_rule(this._parse_type_specifier_no_prec, this._t.next());

    if (!type) {
        return false;
    }

    var semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (!semi) {
        return false;
    }

    var ret = new PrecisionStmt(tok, q, type);
    ret.semi = semi;

    return ret;
}

Parser.prototype._parse_initializer = Parser.prototype._parse_assignment_expression;
Parser.prototype._parse_initializer.match = Parser.prototype._parse_assignment_expression.match;
Parser.prototype._parse_initializer.expected = Parser.prototype._parse_assignment_expression.expected;

Parser.prototype._parse_single_declaration = function(type, ident) {
    var decl = new VariableDecl(type);

    var named = new Named(ident);
    decl.names.push(named);

    var n = this._t.peek();

    if (n.id == Tn.T_EOF) {
        return decl;
    }

    if (n.id == Tn.T_EQUAL) {
        // consume peeked token
        this._t.next();

        var ret = this._parse_rule(this._parse_initializer, this._t.next());

        if (!ret) {
            return false;
        }

        named.initial_assign = n;
        named.initial_value = ret;
    } else {
        if (this._parse_optional_array_spec(named) === false) {
            return false;
        }
    }

    return decl;
}

Parser.prototype._parse_init_declarator_list = function(decl, opts) {
    if (!decl) {
        return false;
    }

    var tok = this._t.peek();

    while (tok.id == Tn.T_COMMA) {
        // consume comma
        this._t.next();

        var ident = this._require_one_of([Tn.T_IDENTIFIER]);

        if (!ident) {
            return false;
        }

        var name = new Named(ident);
        var isarray = false;

        tok = this._t.peek();

        if (opts.array) {
            var r = this._parse_optional_array_spec(name);

            if (r === false) {
                return false;
            }

            isarray = (r === true);
        }

        if (!isarray && opts.equal && tok.id == Tn.T_EQUAL) {
            // consume peeked token
            this._t.next();

            var init = this._parse_rule(this._parse_initializer, this._t.next());

            if (!init) {
                return false;
            }

            name.initial_assign = tok;
            name.initial_value = init;
        }

        decl.names.push(name);
        tok = this._t.peek();
    }

    var semi = this._require_one_of([Tn.T_SEMICOLON]);

    if (!semi) {
        return false;
    }

    decl.semi = semi;
    return decl;
}

Parser.prototype._parse_declaration = function(tok, m) {
    var decl;

    var opts = {equal: true, array: true};

    if (tok.id == Tn.T_PRECISION) {
        return this._parse_declaration_precision(tok);
    } else if (tok.id == Tn.T_INVARIANT) {
        var n = this._t.peek();

        if (n.id == Tn.T_IDENTIFIER) {
            decl = new InvariantDecl(tok);
            decl.names.push(new Named(this._t.next()));

            opts.equal = false;
            opts.array = false;
        }
    }

    if (!decl) {
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
        }
    }

    // Finish the declarator list
    return this._parse_init_declarator_list(decl, opts);
}

Parser.prototype._parse_declaration.match = function(tok, m) {
    if (tok.id == Tn.T_PRECISION) {
        return true;
    }

    return this._match(this._parse_fully_specified_type, tok);
}

Parser.prototype._parse_declaration.expected = function() {
    return ['function prototype', 'type declaration'];
}

Parser.prototype._parse_expression_statement = function(tok, m) {
    if (tok.id == Tn.T_SEMICOLON) {
        return new EmptyStmt(tok);
    } else {
        var ret = this._parse_expression(tok, m);

        if (!ret) {
            return false;
        }

        var semi = this._require_one_of([Tn.T_SEMICOLON]);

        if (!semi) {
            return false;
        }

        var stmt = new ExpressionStmt(ret);
        stmt.semi = semi;

        return stmt;
    }
}

Parser.prototype._parse_expression_statement.match = function(tok) {
    if (tok.id == Tn.T_SEMICOLON) {
        return true;
    }

    return this._match(this._parse_expression, tok);
}

Parser.prototype._parse_external_declaration = function(tok, m) {
    return m(tok);
}

match_one_of(Parser.prototype._parse_external_declaration, [
    Parser.prototype._parse_declaration
]);

Parser.prototype._parse_tu = function() {
    while (!this._t.eof()) {
        var tok = this._t.next();

        if (tok.id == Tn.T_EOF) {
            break;
        }

        var node = this._parse_rule(this._parse_external_declaration, tok);

        if (!node) {
            break;
        }

        this.body.push(node);
    }
}

Parser.prototype._error = function(loc, message) {
    this._errors.push(new Error(loc, message));
}

Parser.prototype._match = function(rule, tok) {
    return rule.match.call(this, tok);
}

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
        return false;
    }

    return rule.call(this, tok, m);
}

Parser.prototype.errors = function() {
    return this._preprocessor.errors().concat(this._errors);
}

exports.Parser = Parser;

})(typeof window == 'undefined' ? exports : window.glsl.ast);

// vi:ts=4:et
