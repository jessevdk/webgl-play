var utils = require('../utils/utils');
var math = require('../math/math');
var Model = require('./model');
var Geometry = require('./geometry');
var RenderGroup = require('./rendergroup');
var RenderGroups = require('./rendergroups');

function ensureObject(state, name) {
    if (state.object === null || typeof name !== 'undefined') {
        state.object = {
            name: name || 'Default',
            vertices: [],
            normals: [],
            texcoords: [],
            shared_vertices: {},
            groups: [],

            attributes: {
                vertices: [],
                normals: [],
                texcoords: []
            }
        };

        state.objects.push(state.object);
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

        state.object.groups.push(state.group);
    }
}

function uniqueName(col, name) {
    var i = 1;
    var uname = name;

    while (col.indexOf(uname) !== -1) {
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

    return math.vec3.normalize(math.vec3.cross(n, v, w), n);
}

function parseObj(ctx, ret, s) {
    var i = 0;

    var lineno = 1;
    var faces = [];

    var state = {
        objects: [],
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
        var parts = line.trim().split(/ +/);

        switch (parts[0]) {
        case 'v':
            ensureObject(state);

            if (parts.length === 4) {
                state.object.vertices.push(parseFloat(parts[1]),
                                           parseFloat(parts[2]),
                                           parseFloat(parts[3]));
            } else {
                throw new Error('l' + lineno + ': Only 3 coordinates per vertex are currently supported');
            }
            break;
        case 'vt':
            ensureObject(state);

            if (parts.length === 3) {
                state.object.texcoords.push(parseFloat(parts[1]),
                                            parseFloat(parts[2]));
            } else {
                throw new Error('l' + lineno + ': Only 2 coordinates per texture coordinate are currently supported');
            }
            break;
        case 'vn':
            ensureObject(state);

            if (parts.length === 4) {
                state.object.normals.push(parseFloat(parts[1]),
                                          parseFloat(parts[2]),
                                          parseFloat(parts[3]));
            } else {
                throw new Error('l' + lineno + ': Normals must have 3 coordinates');
            }
            break;
        case 'f':
            // Check for maximum number of vertices per buffer
            if (state.object !== null && (state.object.attributes.vertices.length + (parts.length - 1)) > (1 << 16)) {
                // Create new object with the same name to hold the new vertices
                var curobj = state.object;

                ensureObject(state, state.object.name);

                state.object.vertices = curobj.vertices;
                state.object.texcoords = curobj.texcoords;
                state.object.normals = curobj.normals;

                state.group = null;
            }

            ensureGroup(state);

            var gv = state.object.attributes.vertices;
            var gn = state.object.attributes.normals;
            var gi = state.group.indices;

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

                    var hasT = (l > 1 && p[k][1].length > 0);
                    var hasN = (l > 2 && p[k][2].length !== 0);

                    for (var k = 0; k < 3; k++) {
                        var h = parts[k];

                        var vi = parseInt(p[k][0]);

                        if (vi < 0) {
                            vi = v.length - 1 + 3 * vi;
                        } else {
                            vi = (vi - 1) * 3;
                        }

                        // Keep verts to calculate face normal if necessary
                        verts[k] = [v[vi], v[vi + 1], v[vi + 2]];

                        // Reuse vertices for smooth surfaces, or those
                        // with normals defined
                        if (state.group.smooth || hasN) {
                            var seen = state.object.shared_vertices[h];

                            if (typeof seen !== 'undefined') {
                                gi.push(seen.index);
                                continue;
                            } else {
                                state.object.shared_vertices[h] = {
                                    index: ii
                                };
                            }
                        }

                        gi.push(ii);
                        gv.push(verts[k][0], verts[k][1], verts[k][2]);

                        if (hasT) {
                            var ti = (parseInt(p[k][1]) - 1) * 3;
                            gt.push(t[ti], t[ti + 1], t[ti + 2]);
                        }

                        if (hasN) {
                            var ni = (parseInt(p[k][2]) - 1) * 3;
                            gn.push(n[ni], n[ni + 1], n[ni + 2]);
                        } else if (state.group.smooth) {
                            gn.push(0, 0, 0);
                        }

                        ii++;
                    }

                    // Generate normal for non-smooth surfaces without
                    // defined normals
                    if (!hasN) {
                        var n = faceNormal(verts[0], verts[1], verts[2]);

                        // Use face normal for each vertex
                        if (state.group.smooth) {
                            for (var k = 0; k < 3; k++) {
                                var h = parts[k];
                                var idx = state.object.shared_vertices[h] * 3;

                                gn[idx + 0] += n[0];
                                gn[idx + 1] += n[1];
                                gn[idx + 2] += n[2];
                            }
                        } else {
                            for (var k = 0; k < 3; k++) {
                                gn.push(n[0], n[1], n[2]);
                            }
                        }
                    }
                }
            } else {
                throw new Error('l' + lineno + ': Only triangular faces are currently supported (got ' + (parts.length - 1) + ' face vertices)');
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
            ensureObject(state, name);
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
                name = uniqueName(state.object.groups, name);
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
            break;
        }

        lineno++;
    }

    for (var o in state.objects) {
        o = state.objects[o];

        var n = o.attributes.normals;

        for (var i = 0; i < n.length; i += 3) {
            var nn = [0, 0, 0];

            math.vec3.normalize(nn, n.slice(i, i + 3));

            n[i + 0] = nn[0];
            n[i + 1] = nn[1];
            n[i + 2] = nn[2];
        }
    }

    var namemap = {};

    for (var i = 0; i < state.objects.length; i++) {
        var o = state.objects[i];

        var m;

        if (o.name in namemap) {
            m = namemap[o.name];
        } else {
            m = new Model(ctx, o.name);
            m.geometry = new RenderGroups();

            namemap[o.name] = m;
        }

        var geom = new Geometry(ctx,
                                new Float32Array(o.attributes.vertices),
                                new Float32Array(o.attributes.normals));

        for (var gi = 0; gi < o.groups.length; gi++) {
            var g = o.groups[gi];
            m.geometry.add(new RenderGroup(ctx, geom, new Uint16Array(g.indices)));
        }

        ret.add(m);
    }

    return ret;
}

/**
 * Load a Wavefront OBJ from file. This asynchronously loads
 * the given file and constructs a model from its definition.
 * This function returns an initially empty model which will
 * be filled in with child models representing all the objects
 * from the loaded file when the file is loaded. It is valid
 * to render the returned model immediately, but it will be
 * empty until the file finishes loading.
 *
 * To be notified of the model being finished loading, you can
 * specify a 'success(model)' callback in the options parameter.
 * If an error occurred during loading, the 'error(request, message)'
 * callback will be called instead.
 *
 * @param ctx the context.
 * @param filename the filename.
 * @param options optional options.
 */
exports.load = function(ctx, filename, options) {
    var req = new XMLHttpRequest();

    options = utils.merge({
        error: function() {},
        success: function() {}
    }, options);

    var ret = new Model(ctx, filename);

    req.onload = function(ev) {
        var req = ev.target;
        var body = req.responseText;

        try {
            options.success(parseObj(ctx, ret, body));
        } catch (e) {
            console.error(e.stack);
            options.error(req, e.message);
        }
    }

    req.onerror = function(ev) {
        options.error(ev.target, ev.target.responseText);
    }

    req.open('get', filename, true);

    try {
        req.send();
    } catch (e) {
        console.error(e.stack);
    }

    return ret;
};

// vi:ts=4:et
