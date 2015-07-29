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

var tokenizer = require('../glsl/tokenizer');
var source = require('../glsl/source');

var mode = function(config) {
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
        skipComments: false
    });

    var t = new T(wsource);

    function Context(indented, column, closetok, align, prev) {
        this.indented = indented;
        this.column = column;
        this.closetok = closetok;
        this.align = align;
        this.prev = prev;
    }

    Context.push = function(state, column, closetok, align) {
        state.context = new Context(state.indented, column, closetok, align, state.context);
    };

    Context.pop = function(state) {
        var tok = state.context.closetok;

        if (tok == '}' || tok == ')') {
            state.indented = state.context.indented;
        }

        state.context = state.context.prev;
    };

    return {
        lineComment: '//',
        blockCommentStart: '/*',
        blockCommentEnd: '*/',
        electricChars: '{})',

        startState: function(baseColumn) {
            return {
                context: new Context((baseColumn || 0) - config.indentUnit, 0, '', false, null),
                indented: 0,
                startOfLine: true
            };
        },

        token: function(stream, state) {
            wsource._stream = stream;

            if (stream.sol()) {
                if (state.context.align === null) {
                    state.context.align = false;
                }

                state.indented = stream.indentation();
                state.startOfLine = true;
            }

            if (stream.eatSpace()) {
                return null;
            }

            if (state.startOfLine && stream.peek() == '#') {
                stream.skipToEnd();
                return 'meta';
            }

            if (state.context.align === null) {
                state.context.align = true;
            }

            var tok = t.next();

            state.startOfLine = false;

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
            case t.T_HIGH_PRECISION:
            case t.T_MEDIUM_PRECISION:
            case t.T_LOW_PRECISION:
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
            case t.T_LEFT_BRACE:
                Context.push(state, stream.column(), '}', null);
                break;
            case t.T_LEFT_PAREN:
                Context.push(state, stream.column(), ')', null);
                break;
            case t.T_RIGHT_BRACE:
            case t.T_RIGHT_PAREN:
                if (state.context.closetok == tok.text) {
                    Context.pop(state);
                }
                break;
            }

            return null;
        },

        indent: function(state, textAfter) {
            var ctx = state.context;
            var closing = false, ret;

            if (textAfter) {
                closing = (ctx.closetok == textAfter.charAt(0));
            }

            if (ctx.align) {
                ret = ctx.column;

                if (!closing) {
                    ret += 1;
                }

                return ret;
            }

            ret = ctx.indented;

            if (!closing) {
                ret += config.indentUnit;
            }

            return ret;
        }
    };
};

var CodeMirror = window.CodeMirror;

CodeMirror.defineMode('glslv', mode);
CodeMirror.defineMode('glslf', mode);

CodeMirror.defineMIME('text/x-glslv', 'glslv');
CodeMirror.defineMIME('text/x-glslf', 'glslf');

/* vi:ts=4:et */
