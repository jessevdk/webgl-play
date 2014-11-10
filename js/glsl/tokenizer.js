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

function Token(id, text, loc, comments) {
    this.id = id;
    this.text = text;
    this.location = loc;

    this._tokenizer = null;

    if (typeof comments === 'undefined') {
        this.comments = [];
    } else {
        this.comments = comments;
    }
}

Token.prototype.marshal = function () {
    var ret = this._tokenizer.tokenIdName(this.id) + ':' + this.text + '@' + this.location.marshal();

    if (this.comments.length > 0) {
        var c = [ret];

        for (var i = 0; i < this.comments.length; i++) {
            c.push(this.comments[i].marshal());
        }

        return c;
    } else {
        return ret;
    }
};

Token.prototype.forAssert = function () {
    var ret = new Token(this.id, this.text, this.location);
    ret._tokenizer = this._tokenizer;

    for (var k in this) {
        var val = this[k];

        if (this.hasOwnProperty(k) && !ret.hasOwnProperty(k) && typeof val != 'function') {
            ret[k] = val;
        }
    }

    return ret;
};

exports.Token = Token;

function BaseTokenizer(b, options) {
    this._options = this._mergeOptions({
        floats: false,
        ints: false,
        bools: false,
        comments: false,
        skipComments: true,
        whitespaceClass: /^[ \t\n]+/,
        identifierClass: /^[A-Za-z_][A-Za-z0-9_]*/,
        floatClass: /((\d+\.\d*|\.\d+)([eE][+-]?\d+)?|\d+[eE][+-]?\d+)/,
        lineCommentClass: /^\/\/.*/,
        multilineCommentClass: /^\/\*(.|\n)*?\*\//,
        boolClass: /^(true|false)\b/,
        hexadecimalClass: /^0[xX][0-9a-fA-F]+/,
        octalClass: /^0[0-7]*/,
        decimalClass: /^[1-9][0-9]*/
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

    this._tokenIdMap = {};
    this._tokenNameMap = {};
    this._lastTokenId = 0;

    this._defineToken(b, 'identifier', 'IDENTIFIER');
    this._defineToken(b, 'unsupported', 'UNSUPPORTED');
    this._defineToken(b, 'eof', 'EOF');

    this._defineTokens(b, this._keywords);
    this._defineTokens(b, this._operators);

    if (this._options.floats) {
        this._defineToken(b, 'floating point number', 'FLOATCONSTANT');
    }

    if (this._options.ints) {
        this._defineToken(b, 'integer number', 'INTCONSTANT');
    }

    if (this._options.bools) {
        this._defineToken(b, 'boolean value', 'BOOLCONSTANT');
    }

    if (this._options.comments) {
        this._defineToken(b, 'comment', 'COMMENT');
    }

    this._extractOperators();

    b.tokenName = this.tokenName.bind(this);
    b.tokenIdName = this.tokenIdName.bind(this);
}

BaseTokenizer.prototype._mergeOptions = function(defs, options) {
    if (typeof options == 'undefined') {
        return defs;
    }

    for (var k in options) {
        defs[k] = options[k];
    }

    return defs;
};

BaseTokenizer.prototype.init = function(source) {
    this._source = source;
    this._cached = [];

    this._matchers = [];

    if (this._options.comments) {
        this._matchers.push({
            regex: this._options.lineCommentClass,
            finishToken: (function(tok) {
                tok.id = this._token('COMMENT');
                tok.multi = false;
                tok.value = tok.text.slice(2);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ', multi:' + this.multi + ' = ' + this.value;
                };
            }).bind(this)
        });

        this._matchers.push({
            regex: this._options.multilineCommentClass,
            finishToken: (function(tok) {
                tok.id = this._token('COMMENT');
                tok.multi = true;
                tok.value = tok.text.slice(2, tok.text.length - 2);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ', multi:' + this.multi + ' = ' + this.value;
                };
            }).bind(this)
        });
    }

    this._matchers.push({
        regex: this._roperators,
        finishToken: (function(tok) {
            tok.id = this._token(this._operators[tok.text]);
        }).bind(this)
    });

    if (this._options.bools) {
        // bools
        this._matchers.push({
            regex: this._options.boolClass,
            finishToken: (function(tok) {
                tok.id = this._token('BOOLCONSTANT');
                tok.value = (tok.text == 'true');

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });
    }

    this._matchers.push({
        regex: this._options.identifierClass,
        finishToken: (function(tok) {
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
            regex: this._options.floatClass,
            finishToken: (function(tok) {
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
            regex: this._options.hexadecimalClass,
            finishToken: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text.slice(2), 16);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });

        // literal decimal integer
        this._matchers.push({
            regex: this._options.decimalClass,
            finishToken: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 10);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });

        // literal octal integer
        this._matchers.push({
            regex: this._options.octalClass,
            finishToken: (function(tok) {
                tok.id = this._token('INTCONSTANT');
                tok.value = parseInt(tok.text, 8);

                tok.marshal = function() {
                    return Token.prototype.marshal.call(this) + ' = ' + this.value;
                };
            }).bind(this)
        });
    }
};

BaseTokenizer.prototype.createToken = function(id, text, location) {
    var tok = new Token(id, text, location);
    tok._tokenizer = this;

    return tok;
};

function regexEscape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function regexChoices(l) {
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
        l[i] = regexEscape(l[i]);
    }

    return '(' + l.join('|') + ')';
}

BaseTokenizer.prototype._extractOperators = function() {
    var ops = [];

    for (var op in this._operators) {
        ops.push(op);
    }

    if (ops.length !== 0) {
        this._roperators = new RegExp('^' + regexChoices(ops));
    } else {
        this._roperators = null;
    }
};

BaseTokenizer.prototype._defineToken = function(b, name, t) {
    var id = ++this._lastTokenId;

    this['T_' + t] = id;
    b['T_' + t] = id;

    this._tokenIdMap[id] = t;
    this._tokenNameMap[id] = name;
};

BaseTokenizer.prototype.tokenName = function(id) {
    return this._tokenNameMap[id];
};

BaseTokenizer.prototype.tokenIdName = function(id) {
    return this._tokenIdMap[id];
};

BaseTokenizer.prototype._defineTokens = function(b, tmap) {
    var ids = [];

    for (var k in tmap) {
        ids.push(k);
    }

    ids.sort();

    for (var i = 0; i < ids.length; i++) {
        this._defineToken(b, ids[i], tmap[ids[i]]);
    }
};

BaseTokenizer.prototype._skipWs = function() {
    this._source.skip(this._options.whitespaceClass);
};

BaseTokenizer.prototype.peek = function() {
    return this.unconsume(this.next());
};

BaseTokenizer.prototype.unconsume = function(tok) {
    this._cached.unshift(tok);
    return tok;
};

BaseTokenizer.prototype._postComments = function(tok) {
    this._options.skipComments = false;

    while (true) {
        var ntok = this.peek();

        if (ntok.id == this.T_COMMENT) {
            if (ntok.location.start.line == tok.location.start.line) {
                tok.comments.push(ntok);
                this.next();
            } else {
                break;
            }
        } else {
            break;
        }
    }

    this._options.skipComments = true;
    return tok;
};

BaseTokenizer.prototype.next = function() {
    var comments = [];

    if (this._options.comments && this._options.skipComments) {
        while (this._cached.length > 0 && this._cached[0].id == this.T_COMMENT) {
            comments.push(this._cached.shift());
        }
    }

    if (this._cached.length !== 0) {
        var ret = this._cached.shift();
        ret.comments = ret.comments.concat(comments);

        return ret;
    }

    var processingComments = true;

    while (processingComments) {
        processingComments = false;
        this._skipWs();

        if (this._source.eof()) {
            var tok = new Token(this.T_EOF, '', this.location().toRange(), comments);
            tok._tokenizer = this;

            return tok;
        }

        for (var i = 0; i < this._matchers.length; i++) {
            var m = this._matchers[i];

            if (m.regex === null) {
                continue;
            }

            var tok = this._source.next(m.regex);

            if (tok !== null) {
                tok._tokenizer = this;

                m.finishToken(tok);

                if (tok.id == this.T_COMMENT) {
                    if (this._options.comments && this._options.skipComments) {
                        comments.push(tok);
                        processingComments = true;
                    } else {
                        return tok;
                    }
                } else {
                    tok.comments = comments;

                    if (this._options.comments && this._options.skipComments) {
                        return this._postComments(tok);
                    }

                    return tok;
                }

                break;
            }
        }
    }

    var tok = this._source.next(/./);
    tok.id = this.T_UNSUPPORTED;

    return tok;
};

BaseTokenizer.prototype.remainder = function() {
    this._skipWs();
    return this._source.next(/.*/);
};

BaseTokenizer.prototype.eof = function() {
    return this._source.eof();
};

BaseTokenizer.prototype.location = function() {
    return this._source.location();
};

BaseTokenizer.prototype._token = function(n) {
    return this['T_' + n];
};

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
};

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
};

Tokenizer.prototype = new BaseTokenizer(Tokenizer, {
    floats: true,
    ints: true,
    bools: true,
    comments: true
});

exports.Base = BaseTokenizer;
exports.Tokenizer = Tokenizer;

exports.regexChoices = regexChoices;
exports.regexEscape = regexEscape;

// vi:ts=4:et
