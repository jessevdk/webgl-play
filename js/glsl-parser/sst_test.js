const glsl = require('./glslparser');

var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

var files = fs.readdirSync('testfiles');

function scan_files(filt) {
    var ret = [];

    for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var ff = 'testfiles/' + f;

        if (filt(files[i]) && f.lastIndexOf('.glslv') == f.length - 6 && fs.existsSync(ff + '.sst')) {
            ret.push(f);
        }
    }

    return ret;
}

function make_suite(name, prefix, filter) {
    var files = scan_files(filter);

    suite(name, function() {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];

            test(f.slice(prefix.length, f.length - 6), (function(f) {
                var unprocessed = fs.readFileSync('testfiles/' + f, 'utf8');
                var p = new glsl.ast.Parser(unprocessed, glsl.source.VERTEX);

                glsl.sst.Annotate(p);

                var sstj = fs.readFileSync('testfiles/' + f + '.sst', 'utf-8');

                if (!sstj) {
                    sstj = '{}';
                }

                var seen = {};

                var body = p.marshal();

                if (JSON.stringify(body, null, '  ') + '\n' != sstj) {
                    var sst = JSON.parse(sstj);
                    assert.deepEqual(body, sst);
                }
            }).bind(this, f));
        }
    });
}

make_suite('sst', 'ast_', function(f) {
    return f.indexOf('ast_') == 0 && f.indexOf('ast_error_') != 0;
});

make_suite('sst-error', 'ast_error_', function(f) {
    return f.indexOf('ast_error_') == 0;
});

// vi:ts=4:et
