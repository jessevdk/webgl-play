var utils = require('../utils/utils');

function ensureObject(state, name) {
    if (state.object === null || typeof name !== 'undefined') {
        state.object = {
            name: name || 'Default',
            vertices: [],
            normals: [],
            texcoords: [],
            shared_vertices: {},

            attributes: {
                vertices: [],
                normals: [],
                texcoords: []
            }
        };

        state.objects[name] = state.object;
    }
}

function ensureGroup(state, name) {
    ensureObject(state);

    if (state.group === null || typeof name !== 'undefined') {
        state.group = {
            smooth: false,
            name: name || 'Default',
            indices: []
        };

        state.object[state.group.name] = state.group;
    }
}

function uniqueName(col, name) {
    var i = 1;
    var uname = name;

    while (uname in col) {
        uname = name + ' ' + i;
        i++;
    }

    return uname;
}

function faceNormal(p1, p2, p3) {
    var v = [0, 0, 0];
    var w = [0, 0, 0];
    var n = [0, 0, 0];

    for (var i = 0; i < 3; i++) {
        v[i] = p2[i] - p1[i];
        w[i] = p3[i] - p1[i];
    }

    // note: cross product
    n[0] = v[1] * w[2] - v[2] * w[1];
    n[1] = v[2] * w[0] - v[0] * w[2];
    n[2] = v[0] * w[1] - v[1] * w[0];

    // normalize
    var l = 1 / Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);

    n[0] *= l;
    n[1] *= l;
    n[2] *= l;

    return n;
}

function parseObj(s) {
    var i = 0;

    var lineno = 1;
    var faces = [];

    var state = {
        objects: {},
        object: null,
        group: null
    };

    while (i < s.length) {
        var nl = i;

        // Read a single line
        var isspace = true;
        var iscomment = false;
        var st = i;

        while (nl < s.length && s[nl] !== '\n') {
            if (isspace) {
                if (s[nl] === '#') {
                    iscomment = true;
                }

                if (s[nl] !== ' ') {
                   isspace = false;
                   st = nl;
                }
            }

            nl++;
        }

        i = nl + 1;

        if (iscomment) {
            lineno++;
            continue;
        }

        if (nl < s.length && nl > 0 && s[nl - 1] === '\r') {
            nl--;
        }

        var line = s.slice(st, nl);
        var parts = line.split(' ');

        switch (parts[0]) {
        case 'v':
            ensureObject(state);

            if (parts.length === 4) {
                state.object.vertices.push(parseFloat(parts[1]));
                state.object.vertices.push(parseFloat(parts[2]));
                state.object.vertices.push(parseFloat(parts[3]));
            } else {
                throw new Error('l' + lineno + ': Only 3 coordinates per vertex are currently supported');
            }
            break;
        case 'vt':
            ensureObject(state);

            if (parts.length === 3) {
                state.object.texcoords.push(parseFloat(parts[1]));
                state.object.texcoords.push(parseFloat(parts[2]));
            } else {
                throw new Error('l' + lineno + ': Only 2 coordinates per texture coordinate are currently supported');
            }
            break;
        case 'vn':
            ensureObject(state);

            if (parts.length === 4) {
                state.object.normals.push(parseFloat(parts[1]));
                state.object.normals.push(parseFloat(parts[2]));
                state.object.normals.push(parseFloat(parts[3]));
            } else {
                throw new Error('l' + lineno + ': Normals must have 3 coordinates');
            }
            break;
        case 'f':
            ensureGroup(state);

            var gv = state.group.attributes.vertices;
            var gn = state.group.attributes.normals;
            var gi = state.group.attributes.indices;

            if (parts.length === 4) {
                var p = [parts[1].split('/'), parts[2].split('/'), parts[3].split('/')];

                if (p[0].length !== p[1].length || p[0].length !== p[2].length) {
                    throw new Error('l' + lineno + ': Face must have same attributes for each vertex');
                } else if (p[0].length > 3) {
                    throw new Eerror('l' + lineno + ': Too many attributes');
                } else {
                    var v = state.object.vertices;
                    var t = state.object.texcoords;
                    var n = state.object.normals;

                    var l = p[0].length;

                    var ii = gv.length / 3;
                    var verts = [null, null, null];

                    for (var k = 0; k < 3; k++) {
                        var h = parts[k];
                        var seen = state.object.shared_vertices[h];

                        // Reuse vertices for smooth surfaces
                        if (state.group.smooth || p[0].length > 2) {
                            if (typeof seen !== 'undefined') {
                                gi.push(seen);
                                continue;
                            } else {
                                state.object.shared_vertices[h] = ii;
                            }
                        }

                        gi.push(ii++);

                        var vi = parseInt(p[k][0]) * 3;

                        // Keep verts to calculate face normal if necessary
                        verts[k] = [v[vi], v[vi + 1], v[vi + 2]];

                        gv.push(verts[k][0]);
                        gv.push(verts[k][1]);
                        gv.push(verts[k][2]);

                        if (l > 1 && p[k][1].length > 0) {
                            var ti = parseInt(p[k][1]) * 3;

                            gt.push(t[ti]);
                            gt.push(t[ti + 1]);
                            gt.push(t[ti + 2]);
                        }

                        if (l > 2 && p[k][2].length > 0) {
                            var ni = parseInt(p[k][2]) * 3;

                            gn.push(n[ni]);
                            gn.push(n[ni + 1]);
                            gn.push(n[ni + 2]);
                        }
                    }

                    if (!state.group.smooth) {
                        var n = faceNormal(verts[0], verts[1], verts[2]);

                        for (var k = 0; k < 3; k++) {
                            gn.push(n[0]);
                            gn.push(n[1]);
                            gn.push(n[2]);
                        }
                    }
                }
            } else {
                throw new Error('l' + lineno + ': Only triangular faces are currently supported');
            }
            break;
        case 'o':
            if (parts.length === 1) {
                throw new Error('l' + lineno + ': expected object name');
            }

            var name = parts[1].trim();

            if (name.length === 0) {
                throw new Error('l' + lineno + ': expected non-empty object name');
            }

            name = uniqueName(state.objects);

            state.object = {
                name: name
            };

            state.objects[name] = state.object;
            state.group = null;
            break;
        case 'g':
            if (parts.length === 1) {
                throw new Error('l' + lineno + ': expected group name');
            }

            var name = parts[1].trim();

            if (name.length === 0) {
                throw new Error('l' + lineno + ': expected non-empty group name');
            }

            if (state.object !== null) {
                name = uniqueName(state.object, name);
            }

            ensureGroup(state, name);
            break;
        case 's':
            ensureGroup(state);

            if (parts.length === 2) {
                if (parts[1] === '1' || parts[1] === 'on') {
                    state.group.smooth = true;
                } else if (parts[1] === '0' || parts[1] === 'off') {
                    state.group.smooth = false;
                }
            }
        }

        lineno++;
    }
}

exports.load = function(filename, options) {
    var req = new XMLHttpRequest();

    options = utils.merge({
        error: function() {},
        success: function() {}
    }, options);

    req.onload = function(ev) {
        var req = ev.target;
        var body = req.responseText;

        try {
            options.success(parseObj());
        } catch (e) {
            options.error(req, e.message);
        }
    }

    req.onerror = function(ev) {
        options.error(ev.target, ev.target.responseText);
    }

    req.open('get', filename, true);
    req.send();
};

// vi:ts=4:et
