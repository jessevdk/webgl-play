var through = require('through'),
    falafel = require('falafel'),
    parse   = require('jsdoc-parse');

function makeDoc(doc) {
    var d = {
        description: doc.description,
        kind: doc.kind,
        refid: doc.longname
    };

    if ('params' in doc) {
        d.params = doc.params;
    }

    if ('members' in doc) {
        d.members = doc.members;
    }

    return JSON.stringify(d);
}

function parseJs(data, docs) {
    return falafel(data, function(node) {
        if (node.type === 'FunctionDeclaration') {
            var id = node.id.name;

            if (id in docs) {
                node.update(node.source() + '\n\n' + id + '.__doc__ = ' + makeDoc(docs[id]) + ';\n');
            }

            return;
        }

        if (node.type !== 'AssignmentExpression') {
            return;
        }

        if (node.right.type !== 'FunctionExpression') {
            return;
        }

        if (node.left.type !== 'MemberExpression' ||
            node.left.object.type !== 'MemberExpression' ||
            node.left.property.type !== 'Identifier') {
            return;
        }

        if (node.left.object.object.type !== 'Identifier' ||
            node.left.object.property.type !== 'Identifier' ||
            node.left.object.property.name !== 'prototype') {
            return;
        }

        var id = node.left.object.object.name + '.prototype.' + node.left.property.name;

        if (id in docs) {
            node.update(node.source() + '\n\n' + id + '.__doc__ = ' + makeDoc(docs[id]) + ';\n');
        }
    });
}

module.exports = function(file) {
    var data = '';
    var docs = parse(file);

    docs.resume();

    return through(function write(buf) {
        data += buf;
    }, function end() {
        docs.on('end', (function() {
            docs = JSON.parse(docs.json);
            var docmap = {};

            if (docs.length !== 0) {
                for (var i = 0; i < docs.length; i++) {
                    var doc = docs[i];

                    if (doc.kind === 'function' || doc.kind === 'class') {
                        docmap[doc.codeName] = doc;
                    } else if (doc.kind === 'member' && doc.memberof in docmap) {
                        var item = docmap[doc.memberof];

                        if (typeof item.members === 'undefined') {
                            item.members = {};
                        }

                        item.members[doc.name] = doc.description;
                    }
                }
                try {
                    this.queue(String(parseJs(data, docmap)));
                } catch (e) {
                    this.emit("error", new Error(e.toString().replace("Error: ", "") + " (" + file + ")"));
                }
            } else {
                this.queue(data);
            }

            this.queue(null);
        }).bind(this));
    });
}

// vi:ts=4:et
