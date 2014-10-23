var passObjects = [
    Int8Array.prototype,
    Uint8Array.prototype,
    Int16Array.prototype,
    Uint16Array.prototype,
    Int32Array.prototype,
    Uint32Array.prototype,
    Float32Array.prototype,
    Float64Array.prototype,
    Array.prototype
];

function merge() {
    var ret = {};

    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];

        if (typeof arg === 'undefined') {
            continue;
        }

        for (var k in arg) {
            if (arg.hasOwnProperty(k)) {
                if (typeof ret[k] === 'object' && typeof arg[k] === 'object' && passObjects.indexOf(Object.getPrototypeOf(arg[k])) === -1) {
                    ret[k] = merge(ret[k], arg[k]);
                } else {
                    ret[k] = arg[k];
                }
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
