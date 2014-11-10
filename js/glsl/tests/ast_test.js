var glsl = require('../glsl');

var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

var files = fs.readdirSync('tests/testfiles');

function hasSuffix(s, suf) {
    return s.slice(s.length - suf.length) == suf;
}

function scanFiles(filt) {
    var ret = [];

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var ff = 'tests/testfiles/' + f;

        if (filt(files[i]) && (hasSuffix(f, '.glslv')|| hasSuffix(f, '.glslf')) && fs.existsSync(ff + '.ast')) {
            ret.push(f);
        }
    }

    return ret;
}

function testOne(f) {
    var unprocessed = fs.readFileSync('tests/testfiles/' + f, 'utf8');
    var p = new glsl.ast.Parser(unprocessed, hasSuffix(f, '.glslv') ? glsl.source.VERTEX : glsl.source.FRAGMENT);

    var astj = fs.readFileSync('tests/testfiles/' + f + '.ast', 'utf-8');

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

function makeSuite(name, prefix, filter) {
    var files = scanFiles(filter);

    suite(name, function() {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];

            test(f.slice(prefix.length, f.length - 6), testOne.bind(this, f));
        }
    });
}

makeSuite('ast', 'ast_', function(f) {
    return f.indexOf('ast_') === 0 && f.indexOf('ast_error_') !== 0;
});

makeSuite('ast-error', 'ast_error_', function(f) {
    return f.indexOf('ast_error_') === 0;
});

// vi:ts=4:et
