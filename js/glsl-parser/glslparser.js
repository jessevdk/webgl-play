if (typeof window == 'undefined') {
    var mods = ['source', 'tokenizer', 'preprocessor'];

    for (var i = 0; i < mods.length; i++) {
        require('./' + mods[i]);
    }
}

// vi:ts=4:et
