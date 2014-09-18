glsl = require('./glslparser');

var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

var files = fs.readdirSync('testfiles');

function has_suffix(s, suf) {
    return s.slice(s.length - suf.length) == suf;
}

function scan_files(filt) {
    var ret = [];

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var ff = 'testfiles/' + f;

        if (filt(files[i]) && (has_suffix(f, '.glslv')|| has_suffix(f, '.glslf')) && fs.existsSync(ff + '.ast')) {
            ret.push(f);
        }
    }

    return ret;
}

function test_one(f) {
    var unprocessed = fs.readFileSync('testfiles/' + f, 'utf8');
    var p = new glsl.ast.Parser(unprocessed, has_suffix(f, '.glslv') ? glsl.source.VERTEX : glsl.source.FRAGMENT);

    var astj = fs.readFileSync('testfiles/' + f + '.ast', 'utf-8');

    if (!astj) {
        astj = '{}';
    }

    var seen = {};

    var body = p.marshal();

    if (JSON.stringify(body, null, '  ') + '\n' != astj) {
        var ast = JSON.parse(astj);
        assert.deepEqual(body, ast);
    }
}

function make_suite(name, prefix, filter) {
    var files = scan_files(filter);

    suite(name, function() {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];

            test(f.slice(prefix.length, f.length - 6), test_one.bind(this, f));
        }
    });
}

make_suite('ast', 'ast_', function(f) {
    return f.indexOf('ast_') === 0 && f.indexOf('ast_error_') !== 0;
});

make_suite('ast-error', 'ast_error_', function(f) {
    return f.indexOf('ast_error_') === 0;
});

// vi:ts=4:et
