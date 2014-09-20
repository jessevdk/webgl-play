var tokenizer = require('../glsl/tokenizer');
var source = require('../glsl/source');

CodeMirror.defineMode('glsl', function(config, modeopts) {
    var wsource = {
        _stream: null,

        eof: function() {
            return this._stream.eol();
        },

        skip: function(r) {
            this._stream.eatWhile(r);
        },

        next: function(r) {
            var m = this._stream.match(r);

            if (m) {
                var start = this.location().copy();
                var end = start.advance(m[0]);

                return new tokenizer.Token(0, m[0], new source.Range(start, end));
            }

            return null;
        },

        location: function() {
            return new source.Location(this._stream.line, this._stream.column);
        },

        source: function() {
            return this._stream.current();
        }
    };

    function T(source) {
        tokenizer.Base.prototype.init.call(this, source);
    }

    T.prototype = new tokenizer.Base(tokenizer.Tokenizer, {
        floats: true,
        ints: true,
        bools: true,
        comments: true,
        skip_comments: false
    });

    var t = new T(wsource);

    return {
        lineComment: '//',
        blockCommentStart: '/*',
        blockCommentEnd: '*/',

        token: function(stream) {
            wsource._stream = stream;

            var issol = stream.sol();

            stream.eatSpace();

            if (issol && stream.peek() == '#') {
                stream.skipToEnd();
                return 'meta';
            }

            var tok = t.next();

            switch (tok.id) {
            case t.T_IDENTIFIER:
                return 'identifier';
            case t.T_COMMENT:
                return 'comment';
            case t.T_FLOATCONSTANT:
            case t.T_INTCONSTANT:
            case t.T_BOOLCONSTANT:
                return 'number';
            case t.T_CONST:
            case t.T_UNIFORM:
            case t.T_VARYING:
            case t.T_ATTRIBUTE:
            case t.T_PRECISION:
            case t.T_INVARIANT:
            case t.T_IN:
            case t.T_OUT:
            case t.T_INOUT:
            case t.T_HIGHP:
            case t.T_MEDIUMP:
            case t.T_LOWP:
                return 'qualifier';
            case t.T_BOOL:
            case t.T_INT:
            case t.T_FLOAT:
            case t.T_VEC2:
            case t.T_VEC3:
            case t.T_VEC4:
            case t.T_IVEC2:
            case t.T_IVEC3:
            case t.T_IVEC4:
            case t.T_BVEC2:
            case t.T_BVEC3:
            case t.T_BVEC4:
            case t.T_MAT2:
            case t.T_MAT3:
            case t.T_MAT4:
            case t.T_SAMPLER2D:
            case t.T_SAMPLERCUBE:
            case t.T_VOID:
                return 'builtin';
            case t.T_FOR:
            case t.T_WHILE:
            case t.T_DO:
            case t.T_IF:
            case t.T_ELSE:
            case t.T_STRUCT:
            case t.T_FOR:
            case t.T_RETURN:
            case t.T_DISCARD:
            case t.T_BREAK:
            case t.T_CONTINUE:
                return 'keyword';
            case t.T_PLUS:
            case t.T_DASH:
            case t.T_STAR:
            case t.T_SLASH:
            case t.T_EQUAL:
            case t.T_EQ_OP:
            case t.T_NE_OP:
            case t.T_LE_OP:
            case t.T_GE_OP:
            case t.T_ANGLE_RIGHT:
            case t.T_ANGLE_LEFT:
            case t.T_INC_OP:
            case t.T_DEC_OP:
            case t.T_MUL_ASSIGN:
            case t.T_DIV_ASSIGN:
            case t.T_ADD_ASSIGN:
            case t.T_SUB_ASSIGN:
            case t.T_AND_OP:
            case t.T_OR_OP:
            case t.T_XOR_OP:
            case t.T_DOT:
            case t.T_QUESTION:
            case t.T_COLON:
                return 'operator';
            }

            return null;
        }
    };
});

/* vi:ts=4:et */
