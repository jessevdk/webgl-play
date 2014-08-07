if (!(typeof window == 'undefined')) {
    if (typeof window.glsl == 'undefined') {
        window.glsl = {};
    }

    window.glsl.tokenizer = {};
}

(function(exports) {

function Token(id, text, loc) {
    this.id = id;
    this.text = text;
    this.location = loc;
}

exports.Token = Token;

function BaseTokenizer(b, options) {
    this._options = options;

    if (typeof this._options == 'undefined') {
        this._options = {floats: false, ints: false};
    }

    if (typeof b.keywords != 'undefined') {
        this._keywords = b.keywords;
    } else {
        this._keywords = {};
    }

    if (typeof b.operators != 'undefined') {
        this._operators = b.operators;
    } else {
        this._operators = {};
    }

    this._token_id_map = {};
    this._last_token_id = 0;

    this._define_token(b, 'IDENTIFIER');
    this._define_token(b, 'UNSUPPORTED');

    this._define_tokens(b, this._keywords);
    this._define_tokens(b, this._operators);

    if (this._options.floats) {
        this._add_float_constants(b);
    }

    if (this._options.ints) {
        this._add_int_constants(b);
    }

    this._extract_operators();

    this._rws = /^[ \t\n]+/;
    this._rident = /^[A-Za-z_][A-Za-z0-9_]*/;
}

BaseTokenizer.prototype.init = function(source) {
    this._source = source;
    this._cached = [];

    this._matchers = [
        {
            regex: this._roperators,
            finish_token: (function(tok) {
                tok.id = this._token(this._operators[tok.text]);
            }).bind(this)
        },
        {
            regex: this._rident,
            finish_token: (function(tok) {
                if (tok.text in this._keywords) {
                    tok.id = this._token(this._keywords[tok.text]);
                } else {
                    tok.id = this.T_IDENTIFIER;
                }
            }).bind(this)
        }
    ]

    if (this._options.floats) {
        // floating point number
        this._matchers.push({
            regex: /((\d+\.\d*|\.\d+)([eE][+-]?\d+)?|\d+[eE][+-]?\d+)/,
            finish_token: (function(tok) {
                tok.id = this._token('FLOATCONSTANT');
                tok.value = parseFloat(tok.text);
            }).bind(this)
        });
    }

    if (this._options.ints) {
        // literal hexadecimal integer
        this._matchers.push({
            regex: /^0[xX][0-9a-fA-F]+/,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text.slice(2), 16);
            }).bind(this)
        });

        // literal decimal integer
        this._matchers.push({
            regex: /^[1-9][0-9]*/,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 10);
            }).bind(this)
        });

        // literal octal integer
        this._matchers.push({
            regex: /^0[0-7]*/,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 8);
            }).bind(this)
        });
    }
}

function regex_escape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function regex_choices(l) {
    l = l.slice(0);

    l.sort(function(a, b) {
        if (a.length > b.length) {
            return -1;
        }

        if (b.length > a.length) {
            return 1;
        }

        return 0;
    });

    for (var i = 0; i < l.length; i++) {
        l[i] = regex_escape(l[i]);
    }

    return '(' + l.join('|') + ')';
}

BaseTokenizer.prototype._extract_operators = function() {
    var ops = [];

    for (var op in this._operators) {
        ops.push(op);
    }

    if (ops.length != 0) {
        this._roperators = new RegExp('^' + regex_choices(ops));
    } else {
        this._roperators = null;
    }
}

BaseTokenizer.prototype._define_token = function(b, t) {
    var id = ++this._last_token_id;

    this['T_' + t] = id;
    b['T_' + t] = id;

    this._token_id_map[id] = t;
}

BaseTokenizer.prototype.token_name = function(id) {
    return this._token_id_map[id];
}

BaseTokenizer.prototype._define_tokens = function(b, tmap) {
    for (var k in tmap) {
        this._define_token(b, tmap[k]);
    }
}

BaseTokenizer.prototype._skip_ws = function() {
    this._source.skip(this._rws);
}

BaseTokenizer.prototype.unconsume = function(tok) {
    this._cached.push(tok);
}

BaseTokenizer.prototype.next = function() {
    if (this._cached.length != 0) {
        var ret = this._cached[0];
        this._cached = this._cached.slice(1);
        return ret;
    }

    this._skip_ws();

    if (this._source.eof()) {
        return null;
    }

    for (var i = 0; i < this._matchers.length; i++) {
        var m = this._matchers[i];

        if (m.regex == null) {
            continue;
        }

        var tok = this._source.next(m.regex);

        if (tok != null) {
            m.finish_token(tok);
            return tok;
        }
    }

    var tok = this._source.next(/./);
    tok.id = this.T_UNSUPPORTED;

    return tok;
}

BaseTokenizer.prototype.remainder = function() {
    this._skip_ws();
    return this._source.next(/.*/);
}

BaseTokenizer.prototype.eof = function() {
    return this._source.eof();
}

BaseTokenizer.prototype.location = function() {
    return this._source.location();
}

BaseTokenizer.prototype._token = function(n) {
    return this['T_' + n];
}

BaseTokenizer.prototype._add_int_constants = function(b) {
    this._define_token(b, 'INTCONSTANT');
}

BaseTokenizer.prototype._add_float_constants = function(b) {
    this._define_token(b, 'FLOATCONSTANT');
}

function Tokenizer(source) {
    BaseTokenizer.prototype.init.call(this, source);
}

Tokenizer.keywords = {
    'attribute': 'ATTRIBUTE',
    'const': 'CONST',
    'bool': 'BOOL',
    'float': 'FLOAT',
    'int': 'INT',
    'break': 'BREAK',
    'continue': 'CONTINUE',
    'do': 'DO',
    'else': 'ELSE',
    'for': 'FOR',
    'if': 'IF',
    'discard': 'DISCARD',
    'return': 'RETURN',
    'bvec2': 'BVEC2',
    'bvec3': 'BVEC3',
    'bvec4': 'BVEC4',
    'ivec2': 'IVEC2',
    'ivec3': 'IVEC3',
    'ivec4': 'IVEC4',
    'vec2': 'VEC2',
    'vec3': 'VEC3',
    'vec4': 'VEC4',
    'mat2': 'MAT2',
    'mat3': 'MAT3',
    'mat4': 'MAT4',
    'in': 'IN',
    'out': 'OUT',
    'inout': 'INOUT',
    'uniform': 'UNIFORM',
    'varying': 'VARYING',
    'sampler2d': 'SAMPLER2D',
    'samplercube': 'SAMPLERCUBE',
    'struct': 'STRUCT',
    'void': 'VOID',
    'while': 'WHILE',

    'true': 'BOOLCONSTANT',
    'false': 'BOOLCONSTANT',

    'invariant': 'INVARIANT',
    'highp': 'HIGH_PRECISION',
    'mediump': 'MEDIUM_PRECISION',
    'lowp': 'LOW_PRECISION',
    'precision': 'PRECISION'
}

Tokenizer.operators = {
    '<<': 'LEFT_OP',
    '>>': 'RIGHT_OP',
    '++': 'INC_OP',
    '--': 'DEC_OP',
    '<=': 'LE_OP',
    '>=': 'GE_OP',
    '==': 'EQ_OP',
    '!=': 'NE_OP',
    '&&': 'AND_OP',
    '||': 'OR_OP',
    '^': 'XOR_OP',

    '*=': 'MUL_ASSIGN',
    '/=': 'DIV_ASSIGN',
    '+=': 'ADD_ASSIGN',
    '%=': 'MOD_ASSIGN',
    '<<=': 'LEFT_ASSIGN',
    '>>=': 'RIGHT_ASSIGN',
    '&=': 'AND_ASSIGN',
    '^=': 'XOR_ASSIGN',
    '|=': 'OR_ASSIGN',
    '-=': 'SUB_ASSIGN',

    '(': 'LEFT_PAREN',
    ')': 'RIGHT_PAREN',
    '[': 'LEFT_BRACKET',
    ']': 'RIGHT_BRACKET',
    '{': 'LEFT_BRACE',
    '}': 'RIGHT_BRACE',

    '.': 'DOT',
    ',': 'COMMA',
    ':': 'COLON',
    '=': 'EQUAL',
    ';': 'SEMICOLON',
    '!': 'BANG',
    '-': 'DASH',
    '~': 'TILDE',
    '+': 'PLUS',
    '*': 'STAR',
    '/': 'SLASH',
    '%': 'PERCENT',

    '<': 'LEFT_ANGLE',
    '>': 'RIGHT_ANGLE',
    '|': 'VERTICAL_BAR',
    '^': 'CARET',
    '&': 'AMPERSAND',
    '?': 'QUESTION',
}

Tokenizer.prototype = new BaseTokenizer(Tokenizer, {floats: true, ints: true});

exports.Base = BaseTokenizer;
exports.Tokenizer = Tokenizer;

exports.regex_choices = regex_choices;
exports.regex_escape = regex_escape;

})(typeof window == 'undefined' ? exports : window.glsl.tokenizer);

// vi:ts=4:et
