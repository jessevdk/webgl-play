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

'use strict';

var glsl = {
    tokenizer: require('./tokenizer')
};

function Location(line, column) {
    this.line = line;
    this.column = column;
}

Location.prototype.copy = function() {
    return new Location(this.line, this.column);
};

Location.prototype.toRange = function() {
    var rng = new Range(this, this);
    rng.end.column++;

    return rng;
};

Location.prototype.inspect = function() {
    return this.line + '.' + this.column;
};

Location.prototype.marshal = function() {
    return this.line + '.' + this.column;
};

Location.prototype.compare = function(loc) {
    if (this.line != loc.line) {
        return this.line < loc.line ? -1 : 1;
    }

    if (this.column != loc.column) {
        return this.column < loc.column ? -1 : 1;
    }

    return 0;
};

Location.prototype.advanceChars = function(n) {
    var ret = this.copy();
    ret.column += n;

    return ret;
};

Location.prototype.advance = function(s) {
    var li = -1;

    var ret = this.copy();

    for (var i = 0; i < s.length; i++) {
        if (s[i] == '\n') {
            li = i;
            ret.line++;
        }
    }

    if (li != -1) {
        ret.column = s.length - li;
    } else {
        ret.column += s.length;
    }

    return ret;
};

function BuiltinLocation() {
    Location.call(this, 0, 0);
}

BuiltinLocation.prototype = Object.create(Location.prototype);
BuiltinLocation.prototype.constructor = BuiltinLocation;

exports.BuiltinLocation = BuiltinLocation;

BuiltinLocation.prototype.inspect = function() {
    return '(builtin)';
};

BuiltinLocation.prototype.marshal = function() {
    return '(builtin)';
};

BuiltinLocation.prototype.copy = function() {
    return new BuiltinLocation();
};

function Range(start, end) {
    this.start = start.copy();
    this.end = end.copy();
}

Range.prototype.copy = function() {
    return new Range(this.start, this.end);
};

Range.prototype.inspect = function(depth) {
    return '(' + this.start.inspect(depth + 1) + '-' + this.end.inspect(depth + 1) + ')';
};

Range.prototype.marshal = function() {
    return '(' + this.start.marshal() + '-' + this.end.marshal() + ')';
};

Range.prototype.extend = function(loc) {
    var ret = this.copy();

    if (Location.prototype.isPrototypeOf(loc)) {
        loc = loc.toRange();
    }

    if (loc.start.compare(ret.start) < 0) {
        ret.start = loc.start.copy();
    }

    if (loc.end.compare(ret.end) > 0) {
        ret.end = loc.end.copy();
    }

    return ret;
};

Range.spans = function() {
    var locs = [];
    var args = Array.prototype.slice.call(arguments);

    while (args.length > 0) {
        var arg = args.pop();

        if (arg === null) {
            continue;
        }

        if (Range.prototype.isPrototypeOf(arg)) {
            locs.push(arg);
        } else if (Location.prototype.isPrototypeOf(arg)) {
            locs.push(arg.toRange());
        } else if (Array.prototype.isPrototypeOf(arg)) {
            args.concat(arg);
        } else if (typeof arg.location === 'function') {
            args.push(arg.location());
        } else if (typeof arg.location !== 'undefined') {
            args.push(arg.location);
        }
    }

    if (locs.length === 0) {
        return new Range(new Location(0, 0), new Location(0, 0));
    }

    var ret = locs[0].copy();

    for (var i = 1; i < locs.length; i++) {
        var loc = locs[i];

        if (loc.start.compare(ret.start) < 0) {
            ret.start = loc.start.copy();
        }

        if (loc.end.compare(ret.end) > 0) {
            ret.end = loc.end.copy();
        }
    }

    return ret;
};

function BuiltinRange() {
    Range.call(this, new BuiltinLocation(), new BuiltinLocation());
}

BuiltinRange.prototype = Object.create(Range.prototype);
BuiltinRange.prototype.constructor = BuiltinRange;

BuiltinRange.prototype.inspect = function() {
    return '(builtin)';
};

BuiltinRange.prototype.marshal = function() {
    return '(builtin)';
};

BuiltinRange.prototype.copy = function() {
    return new BuiltinRange();
};

exports.BuiltinRange = BuiltinRange;

function SourceError(loc, message) {
    this.location = loc.copy();
    this.message = message;

    this._stack = (new Error()).stack;
}

SourceError.prototype.formattedMessage = function() {
    var l = this.location.start.line;
    var c = this.location.start.column;

    var ret = l + '.' + c;

    if (this.location.end.line !== l || this.location.end.column !== c) {
        ret += '-' + this.location.end.line + '.' + this.location.end.column;
    }

    return ret + ': ' + this.message;
};

function Source(s, type) {
    this._source = s;
    this._remainder = this._source;
    this._location = new Location(1, 1);
    this._type = type;
}

Source.prototype.location = function() {
    return this._location;
};

Source.prototype.offset = function(loc) {
    this._location = loc.copy();
};

Source.prototype.eof = function() {
    return this._remainder.length === 0;
};

Source.prototype._sourceMap = function(loc) {
    return loc;
};

Source.prototype.skip = function(r) {
    this._next(r, false);
};

Source.prototype.source = function() {
    return this._source;
};

Source.prototype.next = function(r) {
    return this._next(r, true);
};

Source.prototype.type = function() {
    return this._type;
};

Source.prototype._next = function(r, tokenize) {
    var m = this._remainder.match(r);

    if (m && m.index === 0) {
        var l = m[0].length;

        var start = this._location.copy();

        this._remainder = this._remainder.slice(l);
        this._location = this._location.advance(m[0]);

        if (tokenize) {
            var rng = this._sourceMap(new Range(start, this._location));

            return new glsl.tokenizer.Token(0, m[0], rng);
        }
    }

    return null;
};

exports.Error = SourceError;
exports.Location = Location;
exports.Range = Range;
exports.Source = Source;

exports.VERTEX = 0;
exports.FRAGMENT = 1;

// vi:ts=4:et
