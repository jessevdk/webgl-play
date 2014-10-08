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

exports.merge = merge;

// vi:ts=4:et