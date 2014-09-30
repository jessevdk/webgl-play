var glsl = require('../glsl');

var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

suite('preprocessor', function() {

    test('expand', function () {
        var unprocessed = fs.readFileSync('tests/testfiles/preprocessor.glslv', 'utf8');
        var processed = fs.readFileSync('tests/testfiles/preprocessor_result.glslv', 'utf8');

        var p = new glsl.preprocessor.Preprocessor(unprocessed, glsl.source.VERTEX);

        var errors = p.errors();

        for (var i = 0; i < errors.length; i++) {
            assert.ok(false, errors[i].formatted_message() + '\n' + errors[i]._stack);
        }

        assert.equal(p.source(), processed);
    });

    test('all', function () {
        var unprocessed = fs.readFileSync('tests/testfiles/preprocessor_all.glslv', 'utf8');
        var processed = fs.readFileSync('tests/testfiles/preprocessor_all_result.glslv', 'utf8');

        var p = new glsl.preprocessor.Preprocessor(unprocessed, glsl.source.VERTEX);

        var errors = p.errors();

        for (var i = 0; i < errors.length; i++) {
            assert.ok(false, errors[i].formatted_message() + '\n' + errors[i]._stack);
        }

        assert.equal(p.source(), processed);
    });

    test('error', function () {
        var unprocessed = fs.readFileSync('tests/testfiles/preprocessor_error.glslv', 'utf8');

        var p = new glsl.preprocessor.Preprocessor(unprocessed, glsl.source.VERTEX);
        var errors = p.errors();

        if (errors.length != 1) {
            assert.ok(false, 'expected exactly 1 error, got ' + errors.length);
            return;
        }

        assert.equal(errors[0].formatted_message(), '2.2-2.7: this is an error');
    });

    test('source_map', function() {
        var unprocessed = fs.readFileSync('tests/testfiles/preprocessor.glslv', 'utf8');
        var p = new glsl.preprocessor.Preprocessor(unprocessed, glsl.source.VERTEX);

        var expected_map = [
            [[[1, 1], [2, 1]], [[2, 1], [3, 1]], false],
            [[[2, 1], [3, 1]], [[5, 1], [6, 1]], false],
            [[[3, 1], [4, 1]], [[13, 1], [14, 1]], false],
            [[[4, 1], [5, 1]], [[14, 1], [15, 1]], false],
            [[[5, 1], [6, 1]], [[15, 1], [16, 1]], false],
            [[[6, 1], [6, 24]], [[16, 1], [16, 24]], false],
            [[[6, 24], [6, 27]], [[16, 24], [16, 26]], true],
            [[[6, 27], [7, 1]], [[16, 26], [17, 1]], false],
            [[[7, 1], [8, 1]], [[17, 1], [18, 1]], false],
            [[[8, 1], [8, 1]], [[18, 1], [18, 1]], false],
        ];

        for (var i = 0; i < p._source_mapping.length; i++) {
            var m = p._source_mapping[i];

            if (i >= expected_map.length) {
                assert.ok(false, 'unexpected source map entry ' + m);
                continue;
            }

            var e = expected_map[i];

            var c = e[0];
            var o = e[1];

            var ex = {
                current: new glsl.source.Range(new glsl.source.Location(c[0][0], c[0][1]),
                                               new glsl.source.Location(c[1][0], c[1][1])),

                original: new glsl.source.Range(new glsl.source.Location(o[0][0], o[0][1]),
                                                new glsl.source.Location(o[1][0], o[1][1])),

                macro: e[2]
            };

            assert.deepEqual(m, ex);
        }

        for (var i = p._source_mapping.length; i < expected_map.length; i++) {
            assert.ok(false, 'expected source map entry ' + expected_map[i]);
        }
    });

    test('tokenizer', function() {
        var unprocessed = fs.readFileSync('tests/testfiles/preprocessor.glslv', 'utf8');
        var p = new glsl.preprocessor.Preprocessor(unprocessed, glsl.source.VERTEX);
        var t = new glsl.tokenizer.Tokenizer(p);

        var expected_tokens = [
            [t.T_VOID, 'void', [[14, 1], [14, 5]]],
            [t.T_IDENTIFIER, 'main', [[14, 6], [14, 10]]],
            [t.T_LEFT_PAREN, '(', [[14, 10], [14, 11]]],
            [t.T_RIGHT_PAREN, ')', [[14, 11], [14, 12]]],
            [t.T_LEFT_BRACE, '{', [[15, 1], [15, 2]]],
            [t.T_IDENTIFIER, 'gl_Position', [[16, 5], [16, 16]]],
            [t.T_EQUAL, '=', [[16, 17], [16, 18]]],
            [t.T_VEC3, 'vec3', [[16, 19], [16, 23]]],
            [t.T_LEFT_PAREN, '(', [[16, 23], [16, 24]]],
            [t.T_FLOATCONSTANT, '0.1', [[16, 24], [16, 26]], {value: 0.1}],
            [t.T_COMMA, ',', [[16, 26], [16, 27]]],
            [t.T_INTCONSTANT, '0', [[16, 28], [16, 29]], {value: 0}],
            [t.T_COMMA, ',', [[16, 29], [16, 30]]],
            [t.T_INTCONSTANT, '0', [[16, 31], [16, 32]], {value: 0}],
            [t.T_RIGHT_PAREN, ')', [[16, 32], [16, 33]]],
            [t.T_SEMICOLON, ';', [[16, 33], [16, 34]]],
            [t.T_RIGHT_BRACE, '}', [[17, 1], [17, 2]]],
        ];

        var tokens = [];

        while (true) {
            var tok = t.next();

            if (tok.id == glsl.tokenizer.Tokenizer.T_EOF) {
                break;
            }

            if (expected_tokens.length === 0) {
                assert.ok(false, 'unexpected token ' + t.token_name(tok.id) + ' ' + tok.location.start.line + '.' + tok.location.start.column + '-' + tok.location.end.line + '.' + tok.location.end.column + ': ' + tok.text);
            } else {
                var def = expected_tokens[0];
                var start = def[2][0];
                var end = def[2][1];

                var rng = new glsl.source.Range(new glsl.source.Location(start[0], start[1]),
                                                new glsl.source.Location(end[0], end[1]));

                var extok = t.create_token(def[0], def[1], rng);

                if (def.length > 3) {
                    for (var k in def[3]) {
                        extok[k] = def[3][k];
                    }
                }

                assert.deepEqual(tok.for_assert(), extok);

                expected_tokens = expected_tokens.slice(1);
            }
        }
    });
});

// vi:ts=4:et
