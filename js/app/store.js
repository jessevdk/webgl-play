function Store(ready) {
    this._db = null;
    this._ready = ready;

    var version = 1;

    //indexedDB.deleteDatabase('webgl-play');
    var req = indexedDB.open('webgl-play', version);

    req.onsuccess = this._onsuccess.bind(this);
    req.onerror = this._onerror.bind(this);
    req.onupgradeneeded = this._onupgradeneeded.bind(this);
}

Store.prototype.last = function(cb) {
    var tr = this._db.transaction('documents');
    var store = tr.objectStore('documents');
    var idx = store.index('modification_time');

    var req = idx.openCursor(null, 'prev');

    req.onsuccess = function(ev) {
        if (ev.target.result !== null) {
            cb(this, ev.target.result.value);
        } else {
            cb(this, null);
        }
    }

    req.onerror = function(ev) {
        console.log('database error', ev);
        cb(this, null);
    }
}

Store.prototype.save = function(doc, cb) {
    var tr = this._db.transaction('documents', 'readwrite');
    var store = tr.objectStore('documents');

    tr.onerror = (function(ev) {
        console.log('error saving doc', ev);

        if (typeof cb === 'function') {
            cb(this, null);
        }
    }).bind(this);

    var req;

    if (!('id' in doc)) {
        req = store.add(doc);
    } else {
        req = store.put(doc);
    }

    req.onsuccess = (function(ev) {
        if (!('id' in doc)) {
            doc.id = ev.target.result;
        }

        if (typeof cb === 'function') {
            cb(this, doc);
        }
    }).bind(this);
}

Store.prototype._onsuccess = function(e) {
    this._db = e.target.result;

    if (typeof this._ready === 'function') {
        this._ready(this);
    }
}

Store.prototype._onerror = function(e) {
    console.log('Database error', e);
}

Store.prototype._onupgradeneeded = function(e) {
    var db = e.target.result;

    if (e.newVersion == 1) {
        var store = db.createObjectStore('documents', { autoIncrement: true, keyPath: 'id' });

        store.createIndex('modification_time', 'modification_time', { unique: false });
        store.createIndex('creation_time', 'creation_time', { unique: false });
        store.createIndex('title', 'title', { unique: false });
    }
}

module.exports = Store;

// vi:ts=4:et
