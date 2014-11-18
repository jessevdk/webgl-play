var glsl = require('../glsl');
var FileTests = require('./astfiletests');

var tests = new FileTests('tests/testfiles', 'sst');

tests.transform = function(p) {
    glsl.sst.Annotate(p);
    return p;
};

tests.makeSuite('sst', 'ast_', function(f) {
    return f.indexOf('ast_') === 0 && f.indexOf('ast_error_') !== 0;
});

tests.makeSuite('sst-error', 'ast_error_', function(f) {
    return f.indexOf('ast_error_') === 0;
});

// vi:ts=4:et
