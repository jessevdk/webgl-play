// jshint worker:true

/*
 * Copyright (c) 2014 Jesse van den Kieboom. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 *      copyright notice, this list of conditions and the following disclaimer
 *      in the documentation and/or other materials provided with the
 *      distribution.
 *    * Neither the name of Google Inc. nor the names of its
 *      contributors may be used to endorse or promote products derived from
 *      this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

function ensureObject(state, name) {
    if (state.object === null || typeof name !== 'undefined') {
        state.object = {
            name: name || 'Default',
            vertices: [],
            normals: [],
            texcoords: [],
            sharedVertices: {},
            groups: [],

            attributes: {
                vertices: [],
                normals: [],
                texcoords: []
            }
        };

        state.objects.push(state.object);
        state.group = null;
    }
}

function ensureGroup(state, autosmooth, name) {
    ensureObject(state);

    if (state.group === null || typeof name !== 'undefined') {
        state.group = {
            smooth: autosmooth ? true : false,
            name: name || 'Default',
            indices: [],
            aabbox: [
                {
                    min: null,
                    max: null
                },

                {
                    min: null,
                    max: null
                },

                {
                    min: null,
                    max: null
                }
            ]
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

function cross(v, w) {
    return new Float64Array([
        v[1] * w[2] - v[2] * w[1],
        v[2] * w[0] - v[0] * w[2],
        v[0] * w[1] - v[1] * w[0]
    ]);
}

function normalize(v) {
    var l = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

    if (l > 0) {
        v[0] = v[0] / l;
        v[1] = v[1] / l;
        v[2] = v[2] / l;
    }

    return v;
}

function faceNormal(p1, p2, p3) {
    var v = new Float64Array([0, 0, 0]);
    var w = new Float64Array([0, 0, 0]);
    var n = new Float64Array([0, 0, 0]);

    for (var i = 0; i < 3; i++) {
        v[i] = p2[i] - p1[i];
        w[i] = p3[i] - p1[i];
    }

    // cross product
    n = cross(v, w);
    return normalize(n);
}

function parseIndex(idx, l) {
    if (idx < 0) {
        return l - 1 + 3 * idx;
    } else {
        return (idx - 1) * 3;
    }
}

function makeIndex(buffer, index, original, mapping) {
    var i = mapping[index];

    if (typeof i !== 'undefined') {
        return i;
    }

    i = buffer.vertices.length / 3;
    mapping[index] = i;

    var i3 = index * 3;
    var i2 = index * 2;

    if (original.vertices.length > 0) {
        buffer.vertices.push(original.vertices[i3 + 0],
                             original.vertices[i3 + 1],
                             original.vertices[i3 + 2]);
    }

    if (original.texcoords.length > 0) {
        buffer.texcoords.push(original.texcoords[i2 + 0],
                              original.texcoords[i2 + 1]);
    }

    if (original.normals.length > 0) {
        buffer.normals.push(original.normals[i3 + 0],
                            original.normals[i3 + 1],
                            original.normals[i3 + 2]);
    }

    return i;
}

function splitObj(o) {
    // Indices are uint16, and are thus limited to what they can actually index
    var indexLimit = (1 << 16) / 2;

    if (o.attributes.vertices.length / 3 <= indexLimit) {
        return {
            name: o.name,
            buffers: [o]
        };
    }

    var ret = {
        name: o.name,
        buffers: [],
        aabbox: [
            { min: 0, max: 0 },
            { min: 0, max: 0 },
            { min: 0, max: 0 }
        ]
    };

    // Iterate over groups, keep appending to the current buffer,
    // as long as its smaller than the maximum size. This might split
    // groups as well, but can't be avoided anyway.
    function makeBuffer() {
        return {
            attributes: {
                vertices: [],
                texcoords: [],
                normals: []
            },

            groups: []
        };
    }

    var buffer = makeBuffer();
    ret.buffers.push(buffer);

    var group = null;
    var indexMap = {};

    for (var gi = 0; gi < o.groups.length; gi++) {
        var g = o.groups[gi];
        group = null;

        var i;

        for (i = 0; i < 3; i++) {
            if (gi === 0) {
                ret.aabbox[i].min = g.aabbox[i].min;
                ret.aabbox[i].max = g.aabbox[i].max;
            } else {
                if (g.aabbox[i].min < ret.aabbox[i].min) {
                    ret.aabbox[i].min = g.aabbox[i].min;
                }

                if (g.aabbox[i].max < ret.aabbox[i].max) {
                    ret.aabbox[i].max = g.aabbox[i].max;
                }
            }
        }

        for (i = 0; i < g.indices.length; i += 3) {
            if ((buffer.attributes.vertices.length / 3) + 3 > indexLimit) {
                buffer = makeBuffer();
                ret.buffers.push(buffer);

                group = null;
                indexMap = {};
            }

            if (group === null) {
                group = {
                    name: g.name,
                    indices: [],
                    aabbox: [
                        { min: null, max: null },
                        { min: null, max: null },
                        { min: null, max: null }
                    ]
                };

                buffer.groups.push(group);
            }

            group.indices.push(makeIndex(buffer.attributes, g.indices[i + 0], o.attributes, indexMap),
                               makeIndex(buffer.attributes, g.indices[i + 1], o.attributes, indexMap),
                               makeIndex(buffer.attributes, g.indices[i + 2], o.attributes, indexMap));
        }
    }

    return ret;
}

function parseObj(s, options) {
    var i = 0, n, j;

    var lineno = 1;

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
        var h, k, sh, name;

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
            ensureGroup(state, options.autosmooth);

            var gv = state.object.attributes.vertices;
            var gn = state.object.attributes.normals;
            var gt = state.object.attributes.texcoords;
            var gi = state.group.indices;

            if (parts.length === 4) {
                var p = [parts[1].split('/'), parts[2].split('/'), parts[3].split('/')];

                if (p[0].length !== p[1].length || p[0].length !== p[2].length) {
                    throw new Error('l' + lineno + ': Face must have same attributes for each vertex');
                } else if (p[0].length > 3) {
                    throw new Error('l' + lineno + ': Too many attributes');
                } else {
                    var v = state.object.vertices;
                    var t = state.object.texcoords;
                    n = state.object.normals;

                    var l = p[0].length;

                    var ii = gv.length / 3;
                    var verts = [null, null, null];

                    var hasT = (l > 1 && p[k][1].length > 0);
                    var hasN = (l > 2 && p[k][2].length !== 0);

                    for (k = 0; k < 3; k++) {
                        h = parts[k + 1];

                        var vi = parseIndex(parseInt(p[k][0]), v.length);

                        // Keep verts to calculate face normal if necessary
                        verts[k] = [v[vi], v[vi + 1], v[vi + 2]];

                        var ninit = new Float64Array([0, 0, 0]);

                        // Reuse vertices for smooth surfaces, or those
                        // with normals defined
                        if (state.group.smooth || hasN) {
                            if (options.shareVertices) {
                                var seen = state.object.sharedVertices[h];

                                if (typeof seen !== 'undefined') {
                                    gi.push(seen);
                                    continue;
                                } else {
                                    state.object.sharedVertices[h] = ii;
                                }
                            } else {
                                sh = state.object.sharedVertices[h];

                                if (!sh) {
                                    state.object.sharedVertices[h] = [ii];
                                } else {
                                    var ni = sh[0] * 3;

                                    ninit = gn.slice(ni, ni + 3);
                                    state.object.sharedVertices[h].push(ii);
                                }
                            }
                        }

                        gi.push(ii);
                        gv.push(verts[k][0], verts[k][1], verts[k][2]);

                        for (j = 0; j < 3; j++) {
                            if (state.group.aabbox[j].min === null || verts[k][j] < state.group.aabbox[j].min) {
                                state.group.aabbox[j].min = verts[k][j];
                            }

                            if (state.group.aabbox[j].max === null || verts[k][j] > state.group.aabbox[j].min) {
                                state.group.aabbox[j].max = verts[k][j];
                            }
                        }

                        if (hasT) {
                            var ti = parseIndex(parseInt(p[k][1]), t.length);
                            gt.push(t[ti], t[ti + 1], t[ti + 2]);
                        }

                        if (hasN) {
                            var nii = parseIndex(parseInt(p[k][2]), n.length);
                            gn.push(n[nii], n[nii + 1], n[nii + 2]);
                        } else if (state.group.smooth) {
                            gn.push(ninit[0], ninit[1], ninit[2]);
                        }

                        ii++;
                    }

                    // Generate normal for non-smooth surfaces without
                    // defined normals
                    if (!hasN) {
                        n = faceNormal(verts[0], verts[1], verts[2]);

                        // Use face normal for each vertex
                        if (state.group.smooth) {
                            for (k = 0; k < 3; k++) {
                                h = parts[k + 1];

                                if (options.shareVertices) {
                                    sh = [state.object.sharedVertices[h]];
                                } else {
                                    sh = state.object.sharedVertices[h];
                                }

                                for (var si = 0; si < sh.length; si++) {
                                    var idx = sh[si] * 3;

                                    gn[idx + 0] += n[0];
                                    gn[idx + 1] += n[1];
                                    gn[idx + 2] += n[2];
                                }
                            }
                        } else {
                            for (k = 0; k < 3; k++) {
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

            name = parts[1].trim();

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

            name = parts[1].trim();

            if (name.length === 0) {
                throw new Error('l' + lineno + ': expected non-empty group name');
            }

            if (state.object !== null) {
                name = uniqueName(state.object.groups, name);
            }

            ensureGroup(state, options.autosmooth, name);
            break;
        case 's':
            ensureGroup(state, options.autosmooth);

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

    var ret = [];

    for (i = 0; i < state.objects.length; i++) {
        var o = state.objects[i];

        n = o.attributes.normals;

        for (j = 0; j < n.length; j += 3) {
            var nn = new Float64Array(n.slice(j, j + 3));
            nn = normalize(nn);

            n[j + 0] = nn[0];
            n[j + 1] = nn[1];
            n[j + 2] = nn[2];
        }

        ret.push(splitObj(o));
    }

    return ret;
}

self.addEventListener('message', function(e) {
    var ret = parseObj(e.data.data, e.data.options);

    postMessage({
        id: e.data.id,
        result: ret
    });
});

// vi:ts=4:et
