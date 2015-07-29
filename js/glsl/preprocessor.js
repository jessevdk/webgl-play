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
    source: require('./source')
};

function ExpressionTokenizer(source) {
    glsl.tokenizer.Base.prototype.init.call(this, source);
}

ExpressionTokenizer.keywords = {
    'defined': 'DEFINED'
};

ExpressionTokenizer.operators = {
    '<<': 'LEFT_OP',
    '>>': 'RIGHT_OP',
    '<=': 'LE_OP',
    '>=': 'GE_OP',
    '==': 'EQ_OP',
    '!=': 'NE_OP',
    '&&': 'AND_OP',
    '||': 'OR_OP',
    '^^': 'XOR_OP',

    '(': 'LEFT_PAREN',
    ')': 'RIGHT_PAREN',

    ',': 'COMMA',
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
    '&': 'AMPERSAND'
};

ExpressionTokenizer.prototype = new glsl.tokenizer.Base(ExpressionTokenizer, {ints: true});

function Tokenizer(source) {
    glsl.tokenizer.Base.prototype.init.call(this, source);
}

Tokenizer.keywords = {
    'define' : 'DEFINE',
    'undef': 'UNDEF',
    'if': 'IF',
    'ifdef': 'IFDEF',
    'ifndef': 'IFNDEF',
    'else': 'ELSE',
    'elif': 'ELIF',
    'endif': 'ENDIF',
    'error': 'ERROR',
    'pragma': 'PRAGMA',
    'extension': 'EXTENSION',
    'version': 'VERSION',
    'line': 'LINE'
};

Tokenizer.prototype = new glsl.tokenizer.Base(Tokenizer);

function Preprocessor(source, type, options) {
    this._source = '';
    this._type = type;

    this._defines = {
        '__VERSION__': '100',
        '__LINE__': '0',
        '__FILE__': '0',
        'GL_ES': '1'
    };

    if (typeof options === 'undefined') {
        options = {};
    }

    if (typeof options.defines !== 'undefined') {
        for (var k in options.defines) {
            this._defines[k] = options.defines[k];
        }
    }

    this._sourceMapping = [];
    this._sourceLocation = new glsl.source.Location(1, 1);

    var lines = source.split('\n');

    this._pstack = [{skip: false}];
    this._errors = [];
    this._tokens = [];
    this._extensions = [];

    var incomment = false;

    for (var i = 0; i < lines.length; i++)
    {
        var line = lines[i];
        var ptr = 0;

        if (incomment) {
            var opos = line.lastIndexOf('/*');
            var cpos = line.lastIndexOf('*/');

            if (cpos != -1 && cpos > opos) {
                incomment = false;
            }

            // Do not try to handle directives
            ptr = line.length;
        } else {
            while (ptr < line.length && (line[ptr] == ' ' || line[ptr] == '\t'))
            {
                ptr++;
            }
        }

        var p = this._pstack[this._pstack.length - 1];

        if (ptr < line.length && line[ptr] == '#') {
            var lsource = new glsl.source.Source(line.slice(ptr + 1));
            lsource.offset(new glsl.source.Location(i + 1, ptr + 2));

            var tokenizer = new Tokenizer(lsource);
            var tok = tokenizer.next();

            switch (tok.id) {
            case Tokenizer.T_ENDIF:
                this._endif(tok, tokenizer);
                break;
            case Tokenizer.T_ELSE:
                this._else(tok, tokenizer);
                break;
            case Tokenizer.T_ELIF:
                this._elif(tok, tokenizer);
                break;
            }

            if (tok.id == Tokenizer.T_ENDIF || tok.id == Tokenizer.T_ELSE || tok.id == Tokenizer.ELIF || p.skip) {
                continue;
            }

            switch (tok.id) {
            case Tokenizer.T_DEFINE:
                this._define(tok, tokenizer);
                break;
            case Tokenizer.T_UNDEF:
                this._undef(tok, tokenizer);
                break;
            case Tokenizer.T_IF:
                this._if(tok, tokenizer);
                break;
            case Tokenizer.T_IFDEF:
                this._ifdef(tok, tokenizer, false);
                break;
            case Tokenizer.T_IFNDEF:
                this._ifdef(tok, tokenizer, true);
                break;
            case Tokenizer.T_ERROR:
                this._error(tok.location, tokenizer.remainder().text);
                break;
            case Tokenizer.T_PRAGMA:
                break;
            case Tokenizer.T_EXTENSION:
                this._extensions.push(tokenizer.remainder().text.trim());
                break;
            case Tokenizer.T_VERSION:
                break;
            case Tokenizer.T_LINE:
                break;
            default:
                this._error(tok.location, 'expected preprocessor directive, but got ' + tokenizer.tokenName(tok.id) + ':' + tok.text);
                break;
            }
        } else if (!p.skip) {
            if (i != lines.length - 1) {
                line += '\n';
            }

            this._addSource(line, new glsl.source.Location(i + 1, 1));
        }

        var opos = line.lastIndexOf('/*');
        var cpos = line.lastIndexOf('*/');

        if (opos != -1 && opos > cpos) {
            incomment = true;
        }
    }

    this._sourceReader = new glsl.source.Source(this._source, this._type);
    this._sourceReader._sourceMap = this._sourceMap.bind(this);
}

Preprocessor.optionsFromContext = function(c) {
    var defines = {};

    var nmap = {
        'WEBGL_draw_buffers': 'GL_EXT_draw_buffers',
        'OES_standard_derivatives': 'GL_OES_standard_derivatives'
    };

    if (c !== null) {
        var exts = c.getSupportedExtensions();

        for (var i = 0; i < exts.length; i++) {
            var e = exts[i];

            defines[e] = '1';

            if (e in nmap) {
                defines[nmap[e]] = '1';
            }
        }
    }

    return {
        defines: defines
    };
};

Preprocessor.prototype.type = function() {
    return this._source.type();
};

Preprocessor.prototype.extensions = function() {
    return this._extensions.slice(0);
};

Preprocessor.prototype._sourceMap = function(range) {
    return new glsl.source.Range(this._sourceMapOne(range.start, false),
                                 this._sourceMapOne(range.end, true));
};

Preprocessor.prototype._sourceMapOne = function(loc, isend) {
    for (var i = 0; i < this._sourceMapping.length; i++) {
        var m = this._sourceMapping[i];

        if (m.current.start.compare(loc) > 0) {
            break;
        }

        if (isend && m.current.end.compare(loc) < 0) {
            continue;
        }

        if (!isend && m.current.end.compare(loc) <= 0) {
            continue;
        }

        if (m.macro) {
            return isend ? m.original.end.copy() : m.original.start.copy();
        }

        var mapped = m.original.start.copy();

        mapped.line += loc.line - m.current.start.line;

        if (loc.line == m.current.start.line) {
            mapped.column += loc.column - m.current.start.column;
        }

        return mapped;
    }

    return loc;
};

Preprocessor.prototype.eof = function() {
    return this._sourceReader.eof();
};

Preprocessor.prototype.skip = function(r) {
    this._sourceReader.skip(r);
};

Preprocessor.prototype.next = function(r) {
    return this._sourceReader.next(r);
};

Preprocessor.prototype.location = function() {
    return this._sourceReader.location();
};

Preprocessor.prototype.errors = function() {
    return this._errors;
};

Preprocessor.prototype._addSource = function(s, orig) {
    var expanded = this._expand(s, orig, this._sourceLocation);

    this._source += expanded.text;

    // Add source mapping
    for (var i = 0; i < expanded.mapping.length; i++) {
        this._sourceMapping.push(expanded.mapping[i]);

        if (i == expanded.mapping.length - 1) {
            this._sourceLocation = expanded.mapping[i].current.end.copy();
        }
    }
};

Preprocessor.prototype._expand = function(s, origloc, curloc) {
    // Expand any defines found in s
    var defre = [];

    var trackloc = (typeof origloc !== 'undefined');

    for (var d in this._defines) {
        defre.push(d);
    }

    defre = new RegExp('\\b' + glsl.tokenizer.regexChoices(defre) + '\\b', 'g');

    var smap = [];

    var ploc = origloc;
    var poff = 0;

    var pnewloc = curloc;

    var ret = s.replace(defre, (function(m, p1, offset) {
        var d = this._defines[m];

        if (trackloc) {
            var pt = s.slice(poff, offset);

            var nloc = ploc.advance(pt);
            var nnewloc = pnewloc.advance(pt);

            if (poff != offset) {
                smap.push({
                    current: new glsl.source.Range(pnewloc, nnewloc),
                    original: new glsl.source.Range(ploc, nloc),
                    macro: false
                });
            }

            ploc = nloc.advance(m);
            pnewloc = nnewloc.advance(d);

            poff = offset + m.length;

            smap.push({
                current: new glsl.source.Range(nnewloc, pnewloc),
                original: new glsl.source.Range(nloc, ploc),
                macro: true
            });
        }

        return d;
    }).bind(this));

    if (trackloc) {
        var pt = s.slice(poff);

        smap.push({
            current: new glsl.source.Range(pnewloc, pnewloc.advance(pt)),
            original: new glsl.source.Range(ploc, ploc.advance(pt)),
            macro: false
        });

        return {text: ret, mapping: smap};
    } else {
        return ret;
    }
};

Preprocessor.prototype._stripComments = function(s) {
    var cpos = s.indexOf('//');

    if (cpos != -1) {
        return s.slice(0, cpos);
    }

    return s;
};

Preprocessor.prototype._define = function(tok, tokenizer) {
    var def = tokenizer.next();

    if (def.id != Tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.tokenName(def.id) + ':' + def.text);
        return;
    }

    if (def.text.indexOf('__') === 0) {
        this._error(def.location, 'defines are not allowed to start with __');
        return;
    }

    if (def.text.indexOf('GL_') === 0) {
        this._error(def.location, 'defines are not allowed to start with GL_');
        return;
    }

    var rest = tokenizer.remainder();
    this._defines[def.text] = this._expand(this._stripComments(rest.text));
};

Preprocessor.prototype._undef = function(tok, tokenizer) {
    var def = tokenizer.next();

    if (def.id != Tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.tokenName(def.id) + ':' + def.text);
        return;
    }

    var next = tokenizer.next();

    if (next.id != Tokenizer.T_EOF) {
        this._error(next.location, 'unexpected input after defined, got ' + tokenizer.tokenName(next.id) + ':' + next.text);
    } else {
        delete this._defines[def.text];
    }
};

Preprocessor.prototype._makeExpressionTokenizer = function(tok, s) {
    var source = new glsl.source.Source(s);
    source.offset(tok.location.end);

    return new ExpressionTokenizer(source);
};

Preprocessor.prototype._if = function(tok, tokenizer) {
    var rest = tokenizer.remainder();

    var exprtok = this._makeExpressionTokenizer(tok, rest.text);
    var expr = this._parseExpression(exprtok, -1);

    if (expr === null) {
        return;
    }

    this._pstack.push({
        skip: !expr,
        condition: expr
    });
};

Preprocessor.prototype._ifdef = function(tok, tokenizer, negate) {
    var def = tokenizer.next();

    if (def.id != Tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.tokenName(def.id) + ':' + def.text);
        return;
    }

    var next = tokenizer.next();

    if (next.id != Tokenizer.T_EOF) {
        this._error(next.location, 'unexpected input after defined, got ' + tokenizer.tokenName(next.id) + ':' + next.text);
    } else {
        var skip = !(def.text in this._defines);

        if (negate) {
            skip = !skip;
        }

        this._pstack.push({
            skip: skip,
            condition: !skip
        });
    }
};

Preprocessor.prototype._else = function(tok) {
    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #else without opening #if, #ifdef, or #ifndef');
        return;
    }

    var p = this._pstack[this._pstack.length - 1];

    if (!p.condition) {
        p.skip = false;
        p.condition = true;
    } else {
        p.skip = true;
    }
};

Preprocessor.prototype._elif = function(tok, tokenizer) {
    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #elif without opening #if, #ifdef, or #ifndef');
        return;
    }

    var p = this._pstack[this._pstack.length - 1];

    if (p.condition) {
        p.skip = true;
        return;
    }

    var rest = tokenizer.remainder();
    var s = this._expand(this._stripComments(rest.text));
    var exprtok = this._makeExpressionTokenizer(tok, s);

    var expr = this._parseExpression(exprtok, -1);

    if (expr === null) {
        p.skip = true;
        return;
    }

    p.skip = !expr;
    p.condition = expr;
};

Preprocessor.prototype._endif = function(tok, tokenizer) {
    if (!tokenizer.eof()) {
        this._error(tok.location, 'unexpected input after #endif');
        return;
    }

    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #endif without opening #if, #ifdef, or #ifndef');
        return;
    }

    this._pstack.pop();
};

Preprocessor.prototype._parseExpressionPrimary = function(tokenizer) {
    var tok = tokenizer.next();

    switch (tok.id) {
    case ExpressionTokenizer.T_INTCONSTANT:
        return tok.value;
    case ExpressionTokenizer.T_IDENTIFIER:
        if (tok.text in this._defines) {
            return this._defines[tok.text];
        }

        return null;
    case ExpressionTokenizer.T_LEFT_PAREN:
        var ret = this._parseExpression(tokenizer);

        if (ret === null) {
            return null;
        }

        tok = tokenizer.next();

        if (tok.id != ExpressionTokenizer.T_RIGHT_PAREN) {
            // TODO: error
            return null;
        }

        return ret;
    case ExpressionTokenizer.T_DEFINED:
        var id = tokenizer.next();

        var expect = null;

        if (id.id == ExpressionTokenizer.T_LEFT_PAREN) {
            expect = ExpressionTokenizer.T_RIGHT_PAREN;
            id = tokenizer.next();
        }

        if (id.id != ExpressionTokenizer.T_IDENTIFIER) {
            // TODO: error
            return null;
        }

        if (expect) {
            var e = tokenizer.next();

            if (e.id != expect) {
                // TODO: error
                return null;
            }
        }

        return (id.text in this._defines);
    case ExpressionTokenizer.T_PLUS:
    case ExpressionTokenizer.T_DASH:
    case ExpressionTokenizer.T_TILDE:
    case ExpressionTokenizer.T_BANG:
        var ret = this._parseExpression(tokenizer, 2);

        if (ret === null) {
            return null;
        }

        switch (tok.id) {
            case ExpressionTokenizer.T_PLUS:
                return ret;
            case ExpressionTokenizer.T_DASH:
                return -ret;
            case ExpressionTokenizer.T_TILDE:
                return ~ret;
            case ExpressionTokenizer.T_BANG:
                return !ret;
        }

        break;
    }

    this._error(tok.location, 'expected expression, but got ' + ExpressionTokenizer.tokenName(tok.id) + ':' + tok.text);
    return null;
};

Preprocessor.prototype._parseExpressionBinop = function(tokenizer, p, lhs) {
    var tok = tokenizer.peek();

    var prec = 0;

    switch (tok.id) {
    case ExpressionTokenizer.T_STAR:
    case ExpressionTokenizer.T_SLASH:
    case ExpressionTokenizer.T_PERCENT:
        prec = 3;
        break;
    case ExpressionTokenizer.T_PLUS:
    case ExpressionTokenizer.T_DASH:
        prec = 4;
        break;
    case ExpressionTokenizer.T_LEFT_OP:
    case ExpressionTokenizer.T_RIGHT_OP:
        prec = 5;
        break;
    case ExpressionTokenizer.T_LEFT_ANGLE:
    case ExpressionTokenizer.T_RIGHT_ANGLE:
    case ExpressionTokenizer.T_LE_OP:
    case ExpressionTokenizer.T_GE_OP:
        prec = 6;
        break;
    case ExpressionTokenizer.T_EQ_OP:
    case ExpressionTokenizer.T_NE_OP:
        prec = 7;
        break;
    case ExpressionTokenizer.T_AMPERSAND:
        prec = 8;
        break;
    case ExpressionTokenizer.T_XOR_OP:
        prec = 9;
        break;
    case ExpressionTokenizer.T_VERTICAL_BAR:
        prec = 10;
        break;
    case ExpressionTokenizer.T_AND_OP:
        prec = 11;
        break;
    case ExpressionTokenizer.T_OR_OP:
        prec = 12;
        break;
    default:
        return null;
    }

    if (p !== -1 && prec >= p) {
        return null;
    }

    // Consume peeked token
    tokenizer.next();

    var rhs = this._parseExpression(tokenizer, prec);

    if (rhs === null) {
        return null;
    }

    switch (tok.id) {
    case ExpressionTokenizer.T_STAR:
        return lhs * rhs;
    case ExpressionTokenizer.T_SLASH:
        return lhs / rhs;
    case ExpressionTokenizer.T_PERCENT:
        return lhs % rhs;
    case ExpressionTokenizer.T_PLUS:
        return lhs + rhs;
    case ExpressionTokenizer.T_DASH:
        return lhs - rhs;
    case ExpressionTokenizer.T_LEFT_OP:
        return lhs << rhs;
    case ExpressionTokenizer.T_RIGHT_OP:
        return lhs >> rhs;
    case ExpressionTokenizer.T_LEFT_ANGLE:
        return lhs < rhs;
    case ExpressionTokenizer.T_RIGHT_ANGLE:
        return lhs > rhs;
    case ExpressionTokenizer.T_LE_OP:
        return lhs <= rhs;
    case ExpressionTokenizer.T_GE_OP:
        return lhs >= rhs;
    case ExpressionTokenizer.T_EQ_OP:
        return lhs == rhs;
    case ExpressionTokenizer.T_NE_OP:
        return lhs != rhs;
    case ExpressionTokenizer.T_AMPERSAND:
        return lhs & rhs;
    case ExpressionTokenizer.T_XOR_OP:
        return lhs ^ rhs;
    case ExpressionTokenizer.T_VERTICAL_BAR:
        return lhs | rhs;
    case ExpressionTokenizer.T_AND_OP:
        return lhs && rhs;
    case ExpressionTokenizer.T_OR_OP:
        return lhs || rhs;
    }

    return null;
};

Preprocessor.prototype._parseExpressionRhs = function(tokenizer, p, lhs) {
    return this._parseExpressionBinop(tokenizer, p, lhs);
};

Preprocessor.prototype._parseExpression = function(tokenizer, p) {
    var lhs = this._parseExpressionPrimary(tokenizer);

    if (lhs === null) {
        return null;
    }

    while (true) {
        var ret = this._parseExpressionRhs(tokenizer, p, lhs);

        if (ret === null) {
            return lhs;
        } else {
            lhs = ret;
        }
    }
};

Preprocessor.prototype._error = function(loc, text) {
    this._errors.push(new glsl.source.Error(loc, text));
};

Preprocessor.prototype.source = function() {
    return this._source;
};

exports.Preprocessor = Preprocessor;

// vi:ts=4:et
