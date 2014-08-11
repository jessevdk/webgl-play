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

    this._tokenizer = null;
}

Token.prototype.marshal = function() {
    return this._tokenizer.token_id_name(this.id) + ':' + this.text + '@' + this.location.marshal();
}

Token.prototype.for_assert = function() {
    var ret = new Token(this.id, this.text, this.location);
    ret._tokenizer = this._tokenizer;

    for (var k in this) {
        var val = this[k];

        if (this.hasOwnProperty(k) && !ret.hasOwnProperty(k) && typeof val != 'function') {
            ret[k] = val;
        }
    }

    return ret;
}

exports.Token = Token;

function BaseTokenizer(b, options) {
    this._options = this._merge_options({
        floats: false,
        ints: false,
        bools: false,
        comments: false,
        skip_comments: true,
        whitespace_class: /^[ \t\n]+/,
        identifier_class: /^[A-Za-z_][A-Za-z0-9_]*/,
        float_class: /((\d+\.\d*|\.\d+)([eE][+-]?\d+)?|\d+[eE][+-]?\d+)/,
        line_comment_class: /^\/\/.*/,
        multiline_comment_class: /^\/\*(.|\n)*?\*\//,
        bool_class: /^(true|false)\b/,
        hexadecimal_class: /^0[xX][0-9a-fA-F]+/,
        octal_class: /^0[0-7]*/,
        decimal_class: /^[1-9][0-9]*/
    }, options);

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
    this._token_name_map = {};
    this._last_token_id = 0;

    this._define_token(b, 'identifier', 'IDENTIFIER');
    this._define_token(b, 'unsupported', 'UNSUPPORTED');
    this._define_token(b, 'eof', 'EOF');

    this._define_tokens(b, this._keywords);
    this._define_tokens(b, this._operators);

    if (this._options.floats) {
        this._define_token(b, 'floating point number', 'FLOATCONSTANT');
    }

    if (this._options.ints) {
        this._define_token(b, 'integer number', 'INTCONSTANT');
    }

    if (this._options.bools) {
        this._define_token(b, 'boolean value', 'BOOLCONSTANT');
    }

    if (this._options.comments) {
        this._define_token(b, 'comment', 'COMMENT');
    }

    this._extract_operators();
}

BaseTokenizer.prototype._merge_options = function(defs, options) {
    if (typeof options == 'undefined') {
        return defs;
    }

    for (var k in options) {
        defs[k] = options[k];
    }

    return defs;
}

BaseTokenizer.prototype.init = function(source) {
    this._source = source;
    this._cached = [];
    this._comments = [];

    this._matchers = [];

    if (this._options.comments) {
        this._matchers.push({
            regex: this._options.line_comment_class,
            finish_token: (function(tok) {
                tok.id = this._token('COMMENT');
                tok.multi = false;
                tok.value = tok.text.slice(2);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ', multi:' + this.multi + ' = ' + this.value;
                };
            }).bind(this)
        })

        this._matchers.push({
            regex: this._options.multiline_comment_class,
            finish_token: (function(tok) {
                tok.id = this._token('COMMENT');
                tok.multi = true;
                tok.value = tok.text.slice(2, tok.text.length - 2);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ', multi:' + this.multi + ' = ' + this.value;
                };
            }).bind(this)
        })
    }

    this._matchers.push({
        regex: this._roperators,
        finish_token: (function(tok) {
            tok.id = this._token(this._operators[tok.text]);
        }).bind(this)
    });

    if (this._options.bools) {
        // bools
        this._matchers.push({
            regex: this._options.bool_class,
            finish_token: (function(tok) {
                tok.id = this._token('BOOLCONSTANT');
                tok.value = (tok.text == 'true');

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });
    }

    this._matchers.push({
        regex: this._options.identifier_class,
        finish_token: (function(tok) {
            if (tok.text in this._keywords) {
                tok.id = this._token(this._keywords[tok.text]);
            } else {
                tok.id = this.T_IDENTIFIER;
            }
        }).bind(this)
    });

    if (this._options.floats) {
        // floating point number
        this._matchers.push({
            regex: this._options.float_class,
            finish_token: (function(tok) {
                tok.id = this._token('FLOATCONSTANT');
                tok.value = parseFloat(tok.text);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });
    }

    if (this._options.ints) {
        // literal hexadecimal integer
        this._matchers.push({
            regex: this._options.hexadecimal_class,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text.slice(2), 16);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });

        // literal decimal integer
        this._matchers.push({
            regex: this._options.decimal_class,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 10);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });

        // literal octal integer
        this._matchers.push({
            regex: this._options.octal_class,
            finish_token: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 8);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                }
            }).bind(this)
        });
    }
}

BaseTokenizer.prototype.create_token = function(id, text, location) {
    var tok = new Token(id, text, location);
    tok._tokenizer = this;

    return tok;
}

BaseTokenizer.prototype.comments = function() {
    return this._comments;
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

BaseTokenizer.prototype._define_token = function(b, name, t) {
    var id = ++this._last_token_id;

    this['T_' + t] = id;
    b['T_' + t] = id;

    this._token_id_map[id] = t;
    this._token_name_map[id] = name;
}

BaseTokenizer.prototype.token_name = function(id) {
    return this._token_name_map[id];
}

BaseTokenizer.prototype.token_id_name = function(id) {
    return this._token_id_map[id];
}

BaseTokenizer.prototype._define_tokens = function(b, tmap) {
    var ids = [];

    for (var k in tmap) {
        ids.push(k);
    }

    ids.sort();

    for (var i = 0; i < ids.length; i++) {
        this._define_token(b, ids[i], tmap[ids[i]]);
    }
}

BaseTokenizer.prototype._skip_ws = function() {
    this._source.skip(this._options.whitespace_class);
}

BaseTokenizer.prototype.peek = function() {
    if (this._cached.length != 0) {
        return this._cached[0];
    }

    return this.unconsume(this.next());
}

BaseTokenizer.prototype.unconsume = function(tok) {
    this._cached.push(tok);
    return tok;
}

BaseTokenizer.prototype.next = function() {
    if (this._cached.length != 0) {
        var ret = this._cached[0];
        this._cached = this._cached.slice(1);
        return ret;
    }

    var processing_comments = true;

    while (processing_comments) {
        processing_comments = false;
        this._skip_ws();

        if (this._source.eof()) {
            var tok = new Token(this.T_EOF, '', this.location().to_range());
            tok._tokenizer = this;

            return tok;
        }

        for (var i = 0; i < this._matchers.length; i++) {
            var m = this._matchers[i];

            if (m.regex == null) {
                continue;
            }

            var tok = this._source.next(m.regex);

            if (tok != null) {
                tok._tokenizer = this;

                m.finish_token(tok);

                if (this._options.comments && this._options.skip_comments && tok.id == this.T_COMMENT) {
                    this._comments.push(tok);
                    processing_comments = true;
                    break;
                } else {
                    return tok;
                }
            }
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
    'sampler2D': 'SAMPLER2D',
    'samplerCube': 'SAMPLERCUBE',
    'struct': 'STRUCT',
    'void': 'VOID',
    'while': 'WHILE',
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
    '^^': 'XOR_OP',

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

Tokenizer.prototype = new BaseTokenizer(Tokenizer, {
    floats: true,
    ints: true,
    bools: true,
    comments: true
});

exports.Base = BaseTokenizer;
exports.Tokenizer = Tokenizer;

exports.regex_choices = regex_choices;
exports.regex_escape = regex_escape;

})(typeof window == 'undefined' ? exports : window.glsl.tokenizer);

// vi:ts=4:et
