#!/usr/bin/env node

const glsl = require('../glslparser');

var fs = require('fs');

if (process.argv.length > 2) {
    for (var i = 2; i < process.argv.length; i++) {
        var source = fs.readFileSync(process.argv[i], 'utf8');
        var p = new glsl.ast.Parser(source);
        var j = JSON.stringify(p.marshal(), null, '  ') + '\n';

        fs.writeFileSync(process.argv[i] + '.ast', j, {encoding: 'utf8'});
    }
} else {
    var source = '';
    process.stdin.resume();
    process.stdin.on('data', function(buf) { source += buf.toString(); });

    process.stdin.on('end', function() {
        var p = new glsl.ast.Parser(source);
        var j = JSON.stringify(p.marshal(), null, '  ') + '\n';

        process.stdout.write(j);
    });
}
// vi:ts=4:et
