#!/usr/bin/env node

const glsl = require('../glslparser');

var fs = require('fs');

if (process.argv.length > 2) {
    for (var i = 2; i < process.argv.length; i++) {
        var source = fs.readFileSync(process.argv[i], 'utf8');

        var start = Date.now();
        var p = new glsl.ast.Parser(source);
        var end = Date.now();

        var parsems = (end - start);

        start = end;
        glsl.sst.Annotate(p);
        end = Date.now();

        var annotatems = (end - start);

        process.stderr.write(process.argv[i] + '.sst, parse: ' + parsems + 'ms, annotate: ' + annotatems + 'ms\n');

        var j = JSON.stringify(p.marshal(), null, '  ') + '\n';

        fs.writeFileSync(process.argv[i] + '.sst', j, {encoding: 'utf8'});
    }
} else {
    var source = '';
    process.stdin.resume();
    process.stdin.on('data', function(buf) { source += buf.toString(); });

    process.stdin.on('end', function() {
        var p = new glsl.ast.Parser(source);
        glsl.sst.Annotate(p);

        var j = JSON.stringify(p.marshal(), null, '  ') + '\n';

        process.stdout.write(j);
    });
}
// vi:ts=4:et
