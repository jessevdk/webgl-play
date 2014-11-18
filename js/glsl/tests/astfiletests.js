var glsl = require('../glsl');
var util = require('util');
var fs = require('fs');
var assert = require('chai').assert;

function FileTests(dirname, extension) {
    this.dirname = dirname;
    this.extension = extension;

    this.files = fs.readdirSync(dirname);
}

FileTests.prototype.hasSuffix = function(s, suf) {
    return s.slice(s.length - suf.length) == suf;
}

FileTests.prototype.scanFiles = function(filt) {
    var ret = [];

    for (var i = 0; i < this.files.length; i++) {
        var f = this.files[i];
        var ff = this.dirname + '/' + f;

        if (filt(f) && (this.hasSuffix(f, '.glslv') || this.hasSuffix(f, '.glslf')) && fs.existsSync(ff + '.' + this.extension)) {
            ret.push(f);
        }
    }

    return ret;
}

FileTests.prototype.transform = function(p) {
    return p;
}

FileTests.prototype.testOne = function(f) {
    var unprocessed = fs.readFileSync(this.dirname + '/' + f, 'utf8');
    var p = new glsl.ast.Parser(unprocessed, this.hasSuffix(f, '.glslv') ? glsl.source.VERTEX : glsl.source.FRAGMENT);

    p = this.transform(p);

    var astj = fs.readFileSync(this.dirname + '/' + f + '.' + this.extension, 'utf-8');

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

FileTests.prototype.makeSuite = function(name, prefix, filter) {
    var files = this.scanFiles(filter);

    suite(name, (function() {
        for (var i = 0; i < files.length; i++) {
            var f = files[i];

            test(f.slice(prefix.length, f.length - 6), this.testOne.bind(this, f));
        }
    }).bind(this));
}

module.exports = FileTests;

// vi:ts=4:et
