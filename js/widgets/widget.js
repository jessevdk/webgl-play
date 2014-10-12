var Signals = require('../signals/signals');

function Widget(e) {
    Signals.call(this);

    this.e = e;
}

Widget.prototype = Object.create(Signals.prototype);
Widget.prototype.constructor = Widget;

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
