function merge() {
    var ret = {};

    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];

        if (typeof arg === 'undefined') {
            continue;
        }

        for (var k in arg) {
            if (arg.hasOwnProperty(k)) {
                ret[k] = arg[k];
            }
        }
    }

    return ret;
}

var escapeDiv = document.createElement('div');
var escapeElement = document.createTextNode('');
escapeDiv.appendChild(escapeElement);

function htmlEscape(s) {
    escapeElement.data = s;
    return escapeDiv.innerHTML;
}

exports.merge = merge;
exports.htmlEscape = htmlEscape;

// vi:ts=4:et
