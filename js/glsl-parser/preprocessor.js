(function(exports) {

function PreprocessExpressionTokenizer(source) {
    var keywords = {
        'defined': 'DEFINED'
    }

    var operators = {
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
    }

    BaseTokenizer.call(this, source, keywords, {});

    this._add_int_constants();
}

PreprocessExpressionTokenizer.prototype = new BaseTokenizer();

function PreprocessTokenizer(source) {
    var keywords = {
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

    BaseTokenizer.call(this, source, keywords, {});
}

PreprocessTokenizer.prototype = new BaseTokenizer();

function Preprocessor(source) {
    this._source = '';
    this._defines = {
        '__VERSION__': '100',
        '__LINE__': '0',
        '__FILE__': '0',
        'GL_ES': '1'
    };

    this._source_mapping = [];
    this._source_location = new SourceLocation(1, 1);

    var lines = source.split('\n');

    this._pstack = [{skip: false}];
    this._errors = [];

    for (var i = 0; i < lines.length; i++)
    {
        var line = lines[i];
        var ptr = 0;

        while (ptr < line.length && (line[ptr] == ' ' || line[ptr] == '\t'))
        {
            ptr++;
        }

        var p = this._pstack[this._pstack.length - 1];

        if (ptr < line.length && line[ptr] == '#') {
            var lsource = new Source(line.slice(ptr + 1));
            lsource.offset(new SourceLocation(i, ptr + 1));

            var tokenizer = new PreprocessTokenizer(lsource);
            var tok = tokenizer.next();

            if (tok == null) {
                this._error(tokenizer.remainder().location,
                            'expected preprocessor directive');
                continue;
            }

            switch (tok.id) {
            case tokenizer.T_ENDIF:
                this._endif(tok, tokenizer);
                break;
            case tokenizer.T_ELSE:
                this._else(tok, tokenizer);
                break;
            case tokenizer.T_ELIF:
                this._elif(tok, tokenizer);
                break;
            }

            if (tok.id == tokenizer.T_ENDIF || p.skip) {
                continue;
            }

            switch (tok.id) {
            case tokenizer.T_DEFINE:
                this._define(tok, tokenizer);
                break;
            case tokenizer.T_UNDEF:
                this._undef(tok, tokenizer);
                break;
            case tokenizer.T_IF:
                this._if(tok, tokenizer);
                break;
            case tokenizer.T_IFDEF:
                this._ifdef(tok, tokenizer, false);
                break;
            case tokenizer.T_IFNDEF:
                this._ifdef(tok, tokenizer, true);
                break;
            case tokenizer.T_ERROR:
                this._error(tok.location, tokenizer.remainder().text);
                break;
            case tokenizer.T_PRAGMA:
                break;
            case tokenizer.T_EXTENSION:
                break;
            case tokenizer.T_VERSION:
                break;
            case tokenizer.T_LINE:
                break;
            default:
                this._error(tok.location, 'expected preprocessor directive, but got ' + tokenizer.token_name(tok.id) + ':' + tok.text);
                break;
            }
        } else if (!p.skip) {
            if (i != lines.length - 1) {
                line += '\n';
            }

            this._add_source(line, new SourceLocation(i + 1, 1));
        }
    }

    this._source_reader = new Source(this._source);
    this._source_reader._source_map = this._source_map.bind(this);
}

Preprocessor.prototype._source_map = function(range) {
    return new SourceRange(this._source_map_one(range.start, false),
                           this._source_map_one(range.end, true));
}

Preprocessor.prototype._source_map_one = function(loc, isend) {
    for (var i = 0; i < this._source_mapping.length; i++) {
        var m = this._source_mapping[i];

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
}

Preprocessor.prototype.eof = function() {
    return this._source_reader.eof();
}

Preprocessor.prototype.skip = function(r) {
    this._source_reader.skip(r);
}

Preprocessor.prototype.next = function(r) {
    return this._source_reader.next(r);
}

Preprocessor.prototype.location = function() {
    return this._source_reader.location();
}

Preprocessor.prototype.errors = function() {
    return this._errors;
}

Preprocessor.prototype._add_source = function(s, orig) {
    var expanded = this._expand(s, orig, this._source_location);

    this._source += expanded.text;

    // Add source mapping
    for (var i = 0; i < expanded.mapping.length; i++) {
        this._source_mapping.push(expanded.mapping[i]);

        if (i == expanded.mapping.length - 1) {
            this._source_location = expanded.mapping[i].current.end.copy();
        }
    }
}

Preprocessor.prototype._expand = function(s, origloc, curloc) {
    // Expand any defines found in s
    var defre = [];

    var trackloc = !(typeof origloc == 'undefined');

    for (var d in this._defines) {
        defre.push(d);
    }

    defre = new RegExp('\\b' + regex_choices(defre) + '\\b', 'g');

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
                    current: new SourceRange(pnewloc, nnewloc),
                    original: new SourceRange(ploc, nloc),
                    macro: false
                });
            }

            ploc = nloc.advance(m);
            pnewloc = nnewloc.advance(d);

            poff = offset + m.length;

            smap.push({
                current: new SourceRange(nnewloc, pnewloc),
                original: new SourceRange(nloc, ploc),
                macro: true
            });
        }

        return d;
    }).bind(this));

    if (trackloc) {
        var pt = s.slice(poff);

        smap.push({
            current: new SourceRange(pnewloc, pnewloc.advance(pt)),
            original: new SourceRange(ploc, ploc.advance(pt)),
            macro: false
        });

        return {text: ret, mapping: smap};
    } else {
        return ret;
    }
}

Preprocessor.prototype._define = function(tok, tokenizer) {
    var def = tokenizer.next();

    if (def == null) {
        this._error(tok.location, 'expected identifier, but got nothing');
        return;
    }

    if (def.id != tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.token_name(def.id) + ':' + def.text);
        return;
    }

    if (def.text.indexOf('__') == 0) {
        this._error(def.location, 'defines are not allowed to start with __');
        return;
    }

    if (def.text.indexOf('GL_') == 0) {
        this._error(def.location, 'defines are not allowed to start with GL_');
        return;
    }

    var rest = tokenizer.remainder();
    this._defines[def.text] = this._expand(rest.text);
}

Preprocessor.prototype._undef = function(tok, tokenizer) {
    var def = tokenizer.next();

    if (def == null) {
        this._error(tok.location, 'expected identifier, but got nothing');
        return;
    }

    if (def.id != tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.token_name(def.id) + ':' + def.text);
        return;
    }

    var next = tokenizer.next();

    if (next != null) {
        this._error(next.location, 'unexpected input after defined');
        return;
    } else if (!tokenizer.eof()) {
        this._error(tokenizer.remainder().location, 'unexpected input after defined');
        return;
    } else {
        delete this._defines(def.text);
    }
}

Preprocessor.prototype._if = function(tok, tokenizer) {
    var rest = tokenizer.remainder();

    var exprtok = new PreprocessExpressionTokenizer(new Source(rest.text));

    var expr = this._parse_expression(exprtok, -1);

    if (expr == null) {
        return;
    }

    this._pstack.push({
        skip: !expr,
        condition: expr
    });
}

Preprocessor.prototype._ifdef = function(tok, tokenizer, negate) {
    var def = tokenizer.next();

    if (def == null) {
        this._error(tok.location, 'expected identifier, but got nothing');
        return;
    }

    if (def.id != tokenizer.T_IDENTIFIER) {
        this._error(def.location, 'expected identifier, but got ' + tokenizer.token_name(def.id) + ':' + def.text);
        return;
    }

    var next = tokenizer.next();

    if (next != null) {
        this._error(next.location, 'unexpected input after defined');
        return;
    } else if (!tokenizer.eof()) {
        this._error(tokenizer.remainder().location, 'unexpected input after defined');
        return;
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
}

Preprocessor.prototype._else = function(tok, tokenizer) {
    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #else without opening #if, #ifdef, or #ifndef')
        return;
    }

    var p = this._pstack[this._pstack.length - 1];

    if (!p.condition) {
        p.skip = false;
        p.condition = true;
    } else {
        p.skip = true;
    }
}

Preprocessor.prototype._elif = function(tok, tokenizer) {
    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #elif without opening #if, #ifdef, or #ifndef')
        return;
    }

    var p = this._pstack[this._pstack.length - 1];

    if (p.condition) {
        p.skip = true;
        return;
    }

    var rest = tokenizer.remainder();
    var exprtok = new PreprocessExpressionTokenizer(new Source(this._expand(rest.text)));

    var expr = this._parse_expression(exprtok, -1);

    if (expr == null) {
        p.skip = true;
        return;
    }

    this._pstack.push({
        skip: !expr,
        condition: expr
    });
}

Preprocessor.prototype._endif = function(tok, tokenizer) {
    if (!tokenizer.eof()) {
        this._error(tok.location, 'unexpected input after #endif');
        return;
    }

    if (this._pstack.length == 1) {
        this._error(tok.location, 'unexpected #endif without opening #if, #ifdef, or #ifndef')
        return;
    }

    this._pstack.pop();
}

Preprocessor.prototype._parse_expression_primary = function(tokenizer, p) {
    var tok = tokenizer.next();

    if (tok == null) {
        // TODO this._error()
        return null;
    }

    switch (tok.id) {
    case tokenizer.T_INTCONSTANT:
        return tok.value;
    case tokenizer.T_IDENTIFIER:
        if (tok.text in this._defines) {
            return this._defines[tok.text];
        }

        return null;
    case tokenizer.T_LEFT_PAREN:
        var ret = this._parse_expression(tokenizer);

        if (ret == null) {
            return null;
        }

        tok = tokenizer.next();

        if (tok == null) {
            // TODO: error
            return null;
        }

        if (tok.id != tokenizer.T_RIGHT_PAREN) {
            // TODO: error
            return null;
        }
        break;
    case tokenizer.T_DEFINED:
        var id = tokenizer.next();

        var expect = null;

        if (id != null && id.id == tokenizer.T_LEFT_PAREN) {
            expect = tokenizer.T_RIGHT_PAREN;
            id = tokenizer.next();
        }

        if (id == null) {
            // TODO: error
            return null;
        }

        if (id.id != tokenizer.T_IDENTIFIER) {
            // TODO: error
            return null;
        }

        if (expect) {
            var e = tokenizer.next();

            if (e == null || e.id != expect) {
                // TODO: error
                return null;
            }
        }

        return (id.text in this._defines);
    case tokenizer.T_PLUS:
    case tokenizer.T_DASH:
    case tokenizer.T_TILDE:
    case tokenizer.T_BANG:
        var ret = this._parse_expression(tokenizer, 2);

        if (ret == null) {
            return null;
        }

        switch (tok.id) {
            case tokenizer.T_PLUS:
                return ret;
            case tokenizer.T_DASH:
                return -ret;
            case tokenizer.T_TILDE:
                return ~ret;
            case tokenizer.T_BANG:
                return !ret;
        }

        break;
    }

    this._error(tok.location, 'expected expression, but got ' + tokenizer.token_name(tok.id) + ':' + tok.text);

    return null;
}

Preprocessor.prototype._parse_expression_binop = function(tokenizer, p, lhs) {
    var tok = tokenizer.next();

    if (tok == null) {
        return null;
    }

    var prec = 0;

    switch (tok.id) {
    case tokenizer.T_STAR:
    case tokenizer.T_SLASH:
    case tokenizer.T_PERCENT:
        prec = 3;
        break;
    case tokenizer.T_PLUS:
    case tokenizer.T_DASH:
        prec = 4;
        break;
    case tokenizer.T_LEFT_OP:
    case tokenizer.T_RIGHT_OP:
        prec = 5;
        break;
    case tokenizer.T_LEFT_ANGLE:
    case tokenizer.T_RIGHT_ANGLE:
    case tokenizer.T_LE_OP:
    case tokenizer.T_GE_OP:
        prec = 6;
        break;
    case tokenizer.T_EQ_OP:
    case tokenizer.T_NE_OP:
        prec = 7;
        break;
    case tokenizer.T_AMPERSAND:
        prec = 8;
        break;
    case tokenizer.T_XOR_OP:
        prec = 9;
        break;
    case tokenizer.T_VERTICAL_BAR:
        prec = 10;
        break;
    case tokenizer.T_AND_OP:
        prec = 11;
        break;
    case tokenizer.T_OR_OP:
        prec = 12;
        break;
    default:
        tokenizer.unconsume(tok);
        return null;
    }

    if (p != -1 && !(prec < p)) {
        tokenizer.unconsume(tok);
        return null;
    }

    var rhs = this._parse_expression(tokenizer, prec);

    if (rhs == null) {
        return null;
    }

    switch (tok.id) {
    case tokenizer.T_STAR:
        return lhs * rhs;
    case tokenizer.T_SLASH:
        return lhs / rhs;
    case tokenizer.T_PERCENT:
        return lhs % rhs;
    case tokenizer.T_PLUS:
        return lhs + rhs;
    case tokenizer.T_DASH:
        return lhs - rhs;
    case tokenizer.T_LEFT_OP:
        return lhs << rhs;
    case tokenizer.T_RIGHT_OP:
        return lhs >> rhs;
    case tokenizer.T_LEFT_ANGLE:
        return lhs < rhs;
    case tokenizer.T_RIGHT_ANGLE:
        return lhs > rhs;
    case tokenizer.T_LE_OP:
        return lhs <= rhs;
    case tokenizer.T_GE_OP:
        return lhs >= rhs;
    case tokenizer.T_EQ_OP:
        return lhs == rhs;
    case tokenizer.T_NE_OP:
        return lhs != rhs;
    case tokenizer.T_AMPERSAND:
        return lhs & rhs;
    case tokenizer.T_XOR_OP:
        return lhs ^ rhs;
    case tokenizer.T_VERTICAL_BAR:
        return lhs | rhs;
    case tokenizer.T_AND_OP:
        return lhs && rhs;
    case tokenizer.T_OR_OP:
        return lhs || rhs;
    }

    return null;
}

Preprocessor.prototype._parse_expression_rhs = function(tokenizer, p, lhs) {
    return this._parse_expression_binop(tokenizer, p, lhs);
}

Preprocessor.prototype._parse_expression = function(tokenizer, p) {
    var lhs = this._parse_expression_primary(tokenizer);

    if (lhs == null) {
        return;
    }

    while (true) {
        ret = this._parse_expression_rhs(tokenizer, p, lhs);

        if (ret == null) {
            return lhs;
        } else {
            lhs = ret;
        }
    }
}

Preprocessor.prototype._error = function(loc, text) {
    this._errors.push(new SourceError(loc, text));
}

Preprocessor.prototype.source = function() {
    return this._source;
}

exports.Preprocessor = Preprocessor;

})(typeof window == 'undefined' ? global : window);

// vi:ts=4:et
