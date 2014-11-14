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

function Store(ready) {
    this._db = null;
    this._ready = ready;

    var version = 6;

    //indexedDB.deleteDatabase('webgl-play');
    var req = indexedDB.open('webgl-play', version);

    req.onsuccess = this._onsuccess.bind(this);
    req.onerror = this._onerror.bind(this);
    req.onupgradeneeded = this._onupgradeneeded.bind(this);
}

Store.prototype.saveAppSettings = function(settings) {
    var tr = this._db.transaction('app-settings', 'readwrite');
    var store = tr.objectStore('app-settings');

    if (!('id' in settings)) {
        req = store.add(settings);
    } else {
        req = store.put(settings);
    }

    req.onsuccess = function(e) {
        if (e.target.result) {
            settings.id = e.target.result;
        }
    };
}

Store.prototype.appSettings = function(cb) {
    var tr = this._db.transaction('app-settings');
    var store = tr.objectStore('app-settings');

    var req = store.openCursor();

    req.onsuccess = (function(ev) {
        if (ev.target.result) {
            cb(this, ev.target.result.value);
        } else {
            cb(this, {});
        }
    }).bind(this);

    req.onerror = (function(ev) {
        cb(this, {});
    }).bind(this);
}

Store.prototype.objectToCache = function(url, filename, date, obj) {
    var tr = this._db.transaction('object-cache', 'readwrite');
    var store = tr.objectStore('object-cache');

    store.put({
        date: date,
        filename: filename
    }, url + '-date');

    store.put({
        object: obj,
        filename: filename
    }, url);
}

Store.prototype.objectFromCache = function(url, date, cb) {
    var tr = this._db.transaction('object-cache');
    var store = tr.objectStore('object-cache');

    var req = store.get(url + '-date');

    req.onsuccess = (function(ev) {
        if (ev.target.result) {
            var d = ev.target.result.date;

            if (d.getTime() === date.getTime()) {
                req = store.get(url);

                req.onsuccess = (function(ev) {
                    if (ev.target.result) {
                        cb(this, ev.target.result.object);
                    } else {
                        cb(this, null);
                    }
                }).bind(this);

                req.onerror = (function(ev) {
                    console.error('database error', ev);
                    cb(this, null);
                }).bind(this);
            } else {
                cb(this, null);
            }
        } else {
            cb(this, null);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.delete = function(doc, cb) {
    if (!('id' in doc)) {
        cb(this, null);
        return;
    }

    var tr = this._db.transaction('documents', 'readwrite');
    var store = tr.objectStore('documents');

    var req = store.delete(doc.id);

    req.onsuccess = (function(ev) {
        cb(this, doc);
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.byShare = function(share, cb) {
    var tr = this._db.transaction('documents');
    var store = tr.objectStore('documents');
    var idx = store.index('share');

    var req = idx.get(share);

    req.onsuccess = (function(ev) {
        if (ev.target.result) {
            cb(this, ev.target.result);
        } else {
            cb(this, null);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.byId = function(id, cb) {
    var tr = this._db.transaction('documents');
    var store = tr.objectStore('documents');
    var req = store.get(id);

    req.onsuccess = (function(ev) {
        if (ev.target.result) {
            cb(this, ev.target.result);
        } else {
            cb(this, null);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.last = function(cb) {
    var tr = this._db.transaction('documents');
    var store = tr.objectStore('documents');
    var idx = store.index('modificationTime');

    var req = idx.openCursor(null, 'prev');

    req.onsuccess = (function(ev) {
        if (ev.target.result) {
            cb(this, ev.target.result.value);
        } else {
            cb(this, null);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.all = function(cb) {
    var tr = this._db.transaction('documents');
    var store = tr.objectStore('documents');
    var idx = store.index('modificationTime');

    var req = idx.openCursor(null, 'prev');

    var ret = [];

    req.onsuccess = (function(ev) {
        var res = ev.target.result;

        if (res) {
            ret.push(res.value);
            res.continue();
        } else {
            cb(this, ret);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, ret);
    }).bind(this);
}

Store.prototype.addModel = function(model, data, cb) {
    if (!('filename' in model)) {
        cb(this, null);
        return;
    }

    var tr = this._db.transaction(['models', 'model-data'], 'readwrite');
    var models = tr.objectStore('models');
    var modelData = tr.objectStore('model-data');

    models.put(model);
    modelData.put({
        filename: model.filename,
        creationTime: model.creationTime,
        modificationTime: model.modificationTime,
        data: data
    });

    tr.oncomplete = (function(ev) {
        cb(this, model);
    }).bind(this);

    tr.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.modelData = function(filename, cb) {
    var tr = this._db.transaction('model-data');
    var store = tr.objectStore('model-data');

    var req = store.get(filename);

    req.onsuccess = (function(e) {
        if (e.target.result) {
            cb(this, e.target.result);
        } else {
            cb(this, null);
        }
    }).bind(this);

    req.onerror = (function(e) {
        console.error('database error', e);
        cb(this, null);
    }).bind(this);
}

Store.prototype.deleteModel = function(model, cb) {
    if (!('filename' in model)) {
        cb(this, null);
        return;
    }

    var tr = this._db.transaction(['models', 'model-data', 'object-cache'], 'readwrite');

    tr.objectStore('models').delete(model.filename);
    tr.objectStore('model-data').delete(model.filename);

    var cacheStore = tr.objectStore('object-cache');
    var req = cacheStore.index('filename').openCursor('local:' + model.filename);

    req.onsuccess = function(e) {
        if (e.target) {
            var cursor = e.target.result;

            if (cursor) {
                cacheStore.delete(cursor.primaryKey);
                cursor.continue();
            }
        }
    };

    tr.oncomplete = (function(ev) {
        cb(this, model);
    }).bind(this);

    tr.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, null);
    }).bind(this);
}

Store.prototype.models = function(cb) {
    var tr = this._db.transaction('models');
    var store = tr.objectStore('models');
    var req = store.openCursor();

    var ret = [];

    req.onsuccess = (function(ev) {
        var res = ev.target.result;

        if (res) {
            ret.push(res.value);
            res.continue();
        } else {
            cb(this, ret);
        }
    }).bind(this);

    req.onerror = (function(ev) {
        console.error('database error', ev);
        cb(this, ret);
    }).bind(this);
}

Store.prototype.save = function(doc, cb) {
    var tr = this._db.transaction('documents', 'readwrite');
    var store = tr.objectStore('documents');

    tr.onerror = (function(ev) {
        console.error('error saving doc', ev);

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
    console.error('Database error', e);
}

Store.prototype._onupgradeneeded = function(e) {
    var db = e.target.result;
    var tr = e.currentTarget.transaction;

    var documentsStore;
    var objectCacheStore;
    var modelsStore;
    var modelDataStore;

    // Initial database
    if (e.oldVersion <= 0) {
        documentsStore = db.createObjectStore('documents', { autoIncrement: true, keyPath: 'id' });

        documentsStore.createIndex('modificationTime', 'modificationTime', { unique: false });
        documentsStore.createIndex('creationTime', 'creationTime', { unique: false });
        documentsStore.createIndex('title', 'title', { unique: false });
    } else {
        documentsStore = tr.objectStore('documents');
    }

    // Add object cache
    if (e.oldVersion <= 1) {
        objectCacheStore = db.createObjectStore('object-cache');
    } else {
        objectCacheStore = tr.objectStore('object-cache');
    }

    // Add index on share key
    if (e.oldVersion <= 2) {
        documentsStore.createIndex('share', 'share', { unique: false });
    }

    // Add stores for local models
    if (e.oldVersion <= 3) {
        modelsStore = db.createObjectStore('models', { keyPath: 'filename' });
        modelDataStore = db.createObjectStore('model-data', { keyPath: 'filename' });
    } else {
        modelsStore = tr.objectStore('models');
        modelDataStore = tr.objectStore('model-data');
    }

    // Add index for local models
    if (e.oldVersion <= 4) {
        objectCacheStore.createIndex('filename', 'filename', { unique: false });
    }

    var appSettingsStore;

    // Add app-settings
    if (e.oldVersion <= 5) {
        appSettingsStore = db.createObjectStore('app-settings', { autoIncrement: true, keyPath: 'id' });
    }
}

module.exports = Store;

// vi:ts=4:et
