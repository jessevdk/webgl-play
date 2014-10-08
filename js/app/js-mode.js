function render(element, self, data) {
    var t = data.text;
    var prev = 0;

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

function hint(editor, options) {
    var cur = editor.getCursor();
    var tok = editor.getTokenAt(cur);

    var context = {};

    if (typeof options !== 'undefined' && typeof options.context !== 'undefined') {
        context = options.context;
    }

    if (tok.type === 'string' || tok.type === 'comment') {
        return;
    }

    var ctx = [];
    var replace;

    if (tok.string === '.') {
        ctx.unshift('');

        replace = {
            start: cur.ch,
            end: cur.ch
        };

        tok = editor.getTokenAt(CodeMirror.Pos(cur.line, tok.start));
    } else {
        replace = tok;
    }

    while (tok.type === 'property' || (tok.type !== null && tok.type.indexOf('variable') === 0)) {
        ctx.unshift(tok.string);
        tok = editor.getTokenAt(CodeMirror.Pos(cur.line, tok.start));

        if (tok.string !== '.') {
            break;
        }

        tok = editor.getTokenAt(CodeMirror.Pos(cur.line, tok.start));
    }

    if (ctx.length === 0) {
        return;
    }

    var obj = context;

    for (var i = 0; i < ctx.length - 1; i++) {
        obj = obj[ctx[i]];

        if (obj === null) {
            return;
        }
    }

    var f = ctx[ctx.length - 1].toLowerCase();
    var matches = [];

    for (var k in obj) {
        var m = match(k.toLowerCase(), f);

        if (m !== false) {
            matches.push({text: k, d: m.distance, pos: m.pos});
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
            pos: matches[i].pos
        });
    }

    return {
        list: completions,
        from: CodeMirror.Pos(cur.line, replace.start),
        to: CodeMirror.Pos(cur.line, replace.end),
    };
}

CodeMirror.registerHelper("hint", "javascript", hint);

// vi:ts=4:et
