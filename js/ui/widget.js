var Signals = require('../signals/signals');

function Widget(e) {
    Signals.call(this);

    this.e = e;
}

Widget.prototype = Object.create(Signals.prototype);
Widget.prototype.constructor = Widget;

Widget.prototype.create = function(name, attributes) {
    var ret = document.createElement(name);

    for (var a in attributes) {
        var v = attributes[a];

        if (a === 'classes') {
            if (typeof v === 'string') {
                ret.classList.add(v);
            } else {
                for (var i = 0; i < v.length; i++) {
                    ret.classList.add(v[i]);
                }
            }
        } else if (a === 'parent') {
            v.appendChild(ret);
        } else if (a === 'children') {
            if (typeof v === 'object' && Array.prototype.isPrototypeOf(v)) {
                for (var i = 0; i < v.length; i++) {
                    ret.appendChild(v[i]);
                }
            } else {
                ret.appendChild(v);
            }
        } else {
            ret[a] = v;
        }
    }

    return ret;
}

Widget.prototype.children = function(e) {
    if (typeof e === 'undefined') {
        e = this.e;
    }

    var ret = [];

    for (var i = 0; i < e.childNodes.length; i++) {
        var c = e.childNodes[i];

        if (c.nodeType == document.ELEMENT_NODE) {
            ret.push(c);
        }
    }

    return ret;
}

Widget.prototype.page_position = function(e) {
    if (typeof e === 'undefined') {
        e = this.e;
    }

    var ret = {x: 0, y: 0};

    do {
        ret.x += e.offsetLeft;
        ret.y += e.offsetTop;

        e = e.offsetParent;
    } while (e !== null);

    return ret;
}

module.exports = Widget;

// vi:ts=4:et
