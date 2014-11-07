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

var utils = require('../utils/utils');

function render(element, self, data) {
    var t = data.text;
    var prev = 0;

    var icon = document.createElement('span');
    icon.classList.add('icon');

    if (typeof data.obj === 'function') {
        icon.textContent = 'm';
        icon.classList.add('function');
    } else {
        icon.textContent = 'd';
        icon.classList.add('data');
    }

    element.appendChild(icon);

    var span = document.createElement('span');

    for (var i = 0; i < data.pos.length; i++) {
        var p = data.pos[i];

        if (p.start !== prev) {
            var e = document.createElement('span');
            e.textContent = t.slice(prev, p.start);

            span.appendChild(e);
        }

        var e = document.createElement('span');
        e.classList.add('match');
        e.textContent = t.slice(p.start, p.end + 1);
        span.appendChild(e);

        prev = p.end + 1;
    }

    if (prev != t.length) {
        var e = document.createElement('span');
        e.textContent = t.slice(prev);
        span.appendChild(e);
    }

    element.appendChild(span);
}

function match(item, pattern) {
    var ip = 0;
    var i = 0;
    var d = 0;
    var pos = [];

    if (item.length > 0 && item[0] === '_') {
        return false;
    }

    while (i < item.length && ip != pattern.length) {
        if (item[i] == pattern[ip]) {
            if (pos.length === 0 || pos[pos.length - 1].end != i - 1) {
                pos.push({start: i, end: i});
            } else {
                pos[pos.length - 1].end = i;
            }

            ip++;
        } else {
            d++;
        }

        i++;
    }

    if (ip !== pattern.length) {
        return false;
    }

    return {
        distance: d,
        pos: pos
    };
}

function iterPrev(iter) {
    while (true) {
        var start;

        if (iter.tok.start === 0) {
            if (iter.line === 0) {
                iter.tok = null;
                return iter;
            }

            iter.line--;

            var l = iter.editor.getLine(iter.line);
            start = l.length;
        } else {
            start = iter.tok.start;
        }

        iter.tok = iter.editor.getTokenAt(CodeMirror.Pos(iter.line, start));

        if (iter.tok.start !== 0 && !(iter.tok.type === null && iter.tok.string.match(/^\s*$/))) {
            break;
        }
    }

    return iter;
}

function sanitizeDescription(s) {
    var esc = utils.htmlEscape(s);

    var r = /\{@link.*?([^\s]+)\}/;
    return esc.replace(r, '<b>$1</b>');
}

function fillInfo(info, completion, doc) {
    while (info.firstChild) {
        info.removeChild(info.firstChild);
    }

    var description = sanitizeDescription(doc.description);

    var title = document.createElement('div');
    title.classList.add('title');

    if (doc.kind === 'class' || doc.kind === 'function') {
        var args = [];

        if (typeof doc.params !== 'undefined') {
            for (var i = 0; i < doc.params.length; i++) {
                args.push(doc.params[i].name);
            }
        }

        title.textContent = completion.text + '(' + args.join(', ') + ') - ';
    }

    var desc = description;
    var dot = desc.indexOf('.');

    if (dot !== -1) {
        title.innerHTML += desc.slice(0, dot + 1);
        desc = desc.slice(dot + 1).trimLeft().trimRight();

        if (desc.length === 0) {
            desc = null;
        }
    } else {
        title.innerHTML += desc;
        desc = null;
    }

    info.appendChild(title);

    if (desc !== null) {
        var d = document.createElement('div');
        d.classList.add('description');
        d.innerHTML = desc;

        info.appendChild(d);
    }

    if (typeof doc.params !== 'undefined' && doc.params.length > 0) {
        var table = document.createElement('table');
        table.classList.add('params');

        for (var i = 0; i < doc.params.length; i++) {
            var p = doc.params[i];

            var row = document.createElement('tr');
            var name = document.createElement('td');
            var description = document.createElement('td');

            name.textContent = p.name;
            description.textContent = p.description;

            row.appendChild(name);
            row.appendChild(description);

            table.appendChild(row);
        }

        info.appendChild(table);
    }
}

function hint(editor, options) {
    var cur = editor.getCursor();

    var context = {};

    if (typeof options !== 'undefined' && typeof options.context !== 'undefined') {
        context = options.context;
    }

    var iter = {
        editor: editor,
        line: cur.line,
        tok: editor.getTokenAt(cur)
    };

    if (iter.tok.type === 'string' || iter.tok.type === 'comment') {
        return;
    }

    var ctx = [];
    var replace;

    if (iter.tok.string === '.') {
        ctx.unshift('');

        replace = {
            start: cur.ch,
            end: cur.ch
        };

        iterPrev(iter);
    } else {
        replace = iter.tok;
    }

    while (true) {
        if (iter.tok === null) {
            break;
        }

        if (iter.tok.type === 'property' || iter.tok.type === 'keyword' || (iter.tok.type !== null && iter.tok.type.indexOf('variable') === 0)) {
            ctx.unshift(iter.tok.string);

            iterPrev(iter);

            if (iter.tok === null || iter.tok.string !== '.') {
                break;
            }

            iterPrev(iter);
        } else {
            break;
        }
    }

    if (ctx.length === 0) {
        return;
    }

    var obj = context;

    for (var i = 0; i < ctx.length - 1; i++) {
        obj = obj[ctx[i]];

        if (obj === null || typeof obj === 'undefined') {
            return;
        }
    }

    var f = ctx[ctx.length - 1].toLowerCase();
    var matches = [];

    var names = Object.getOwnPropertyNames(obj);
    var seen = {};

    for (var i = 0; i < names.length; i++) {
        var k = names[i];
        var m = match(k.toLowerCase(), f);

        seen[k] = true;

        if (m !== false) {
            try {
                matches.push({text: k, d: m.distance, pos: m.pos, obj: obj[k]});
            } catch (e) {}
        }
    }

    for (var k in obj) {
        if (k in seen) {
            continue;
        }

        var m = match(k.toLowerCase(), f);

        if (m !== false) {
            try {
                matches.push({text: k, d: m.distance, pos: m.pos, obj: obj[k]});
            } catch (e) {}
        }
    }

    matches.sort(function(a, b) {
        if (a.d < b.d) {
            return -1;
        } else if (a.d > b.d) {
            return 1;
        }

        if (a.text < b.text) {
            return -1;
        } else if (a.text > b.text) {
            return 1;
        }

        return 0;
    });

    var completions = [];

    for (var i = 0; i < matches.length; i++) {
        completions.push({
            text: matches[i].text,
            render: render,
            pos: matches[i].pos,
            obj: matches[i].obj
        });
    }

    var ret = {
        list: completions,
        from: CodeMirror.Pos(cur.line, replace.start),
        to: CodeMirror.Pos(cur.line, replace.end),
    };

    var parent = Object.getPrototypeOf(obj).constructor;

    CodeMirror.on(ret, 'select', function(completion, element) {
        var obj = completion.obj;
        var doc = null;

        if (typeof obj !== 'undefined' &&
            obj !== null &&
            typeof obj.__doc__ !== 'undefined') {
            doc = obj.__doc__;
        } else if (typeof parent !== 'undefined' &&
                   parent !== null &&
                   typeof parent.__doc__ !== 'undefined' &&
                   typeof parent.__doc__.members !== 'undefined' &&
                   typeof parent.__doc__.members[completion.text] !== 'undefined') {
            doc = {
                description: parent.__doc__.members[completion.text]
            };
        }

        var ul = element.parentNode;
        var info = editor._infoPopup;

        if (typeof info === 'undefined') {
            info = null;
        }

        if (doc === null && info !== null) {
            document.body.removeChild(info);
            delete editor._infoPopup;

            ul.classList.remove('showing-info');
        } else if (doc !== null) {
            if (info === null) {
                info = document.createElement('div');
                info.classList.add('hints-info');

                document.body.appendChild(info);
                editor._infoPopup = info;
            }

            fillInfo(info, completion, doc);

            info.style.left = (ul.offsetLeft + ul.offsetWidth) + 'px';
            info.style.top = ul.offsetTop + 'px';

            ul.classList.add('showing-info');
        }
    });

    CodeMirror.on(ret, 'close', function() {
        if (editor._infoPopup) {
            document.body.removeChild(editor._infoPopup);
            delete editor._infoPopup;
        }
    });

    return ret;
}

CodeMirror.registerHelper("hint", "javascript", hint);

// vi:ts=4:et
