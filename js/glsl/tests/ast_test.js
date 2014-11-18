var FileTests = require('./astfiletests');

var tests = new FileTests('tests/testfiles', 'ast');

tests.makeSuite('ast', 'ast_', function(f) {
    return f.indexOf('ast_') === 0 && f.indexOf('ast_error_') !== 0;
});

tests.makeSuite('ast-error', 'ast_error_', function(f) {
    return f.indexOf('ast_error_') === 0;
});

// vi:ts=4:et
