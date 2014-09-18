if (typeof window === 'undefined' && typeof self === 'undefined') {
    var mods = ['source', 'tokenizer', 'preprocessor', 'ast', 'builtins', 'sst'];

    for (var i = 0; i < mods.length; i++) {
        exports[mods[i]] = require('./' + mods[i]);
    }
}

// vi:ts=4:et
