const glsl = require('./glslparser');

var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

var files = fs.readdirSync('testfiles');

suite('ast', function() {
    for (var i = 0; i < files.length; i++) {
        var f = files[i];

        if (f.indexOf('ast_') != 0 ||
            f.lastIndexOf('.glslv') != f.length - 6) {
            continue;
        }

        if (!fs.existsSync('testfiles/' + f + '.ast')) {
            continue;
        }

        test(f.slice(4, f.length - 6), (function(f) {
            var unprocessed = fs.readFileSync('testfiles/' + f, 'utf8');
            var p = new glsl.ast.Parser(unprocessed);

            var errors = p.errors();

            for (var e = 0; e < errors.length; e++) {
                assert.ok(false, errors[e].formatted_message() + '\n' + errors[e]._stack);
            }

            var astj = fs.readFileSync('testfiles/' + f + '.ast', 'utf-8');

            if (!astj) {
                astj = '[]';
            }

            var seen = {};

            var ast = JSON.parse(astj);
            var body = p.marshal();

            assert.deepEqual(body, ast);
        }).bind(this, f));
    }
});

// vi:ts=4:et
