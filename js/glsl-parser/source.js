"use strict";

var ns;

if (typeof window != 'undefined' || typeof self != 'undefined') {
    var ctx = (typeof window != 'undefined' ? window : self);

    if (typeof ctx.glsl == 'undefined') {
        ctx.glsl = {};
    }

    ctx.glsl.source = {};
    ns = ctx.glsl.source;
} else {
    // in node
    var glsl = {
        tokenizer: require('./tokenizer')
    }

    ns = exports;
}

(function(exports) {

function Location(line, column) {
    this.line = line;
    this.column = column;
}

Location.prototype.copy = function() {
    return new Location(this.line, this.column);
}

Location.prototype.to_range = function() {
    var rng = new Range(this, this);
    rng.end.column++;

    return rng;
}

Location.prototype.inspect = function(depth) {
    return this.line + '.' + this.column;
}

Location.prototype.marshal = function() {
    return this.line + '.' + this.column;
}

Location.prototype.compare = function(loc) {
    if (this.line != loc.line) {
        return this.line < loc.line ? -1 : 1;
    }

    if (this.column != loc.column) {
        return this.column < loc.column ? -1 : 1;
    }

    return 0;
}

Location.prototype.advance_chars = function(n) {
    var ret = this.copy();
    ret.column += n;

    return ret;
}

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
}

function BuiltinLocation() {
    Location.call(this, 0, 0);
}

BuiltinLocation.prototype = Object.create(Location.prototype);
BuiltinLocation.prototype.constructor = BuiltinLocation;

exports.BuiltinLocation = BuiltinLocation;

BuiltinLocation.prototype.inspect = function() {
    return '(builtin)';
}

BuiltinLocation.prototype.marshal = function() {
    return '(builtin)';
}

BuiltinLocation.prototype.copy = function() {
    return new BuiltinLocation();
}

function Range(start, end) {
    this.start = start.copy();
    this.end = end.copy();
}

Range.prototype.copy = function() {
    return new Range(this.start, this.end);
}

Range.prototype.inspect = function(depth) {
    return '(' + this.start.inspect(depth + 1) + '-' + this.end.inspect(depth + 1) + ')';
}

Range.prototype.marshal = function() {
    return '(' + this.start.marshal() + '-' + this.end.marshal() + ')';
}

Range.prototype.extend = function(loc) {
    var ret = this.copy();

    if (Location.prototype.isPrototypeOf(loc)) {
        loc = loc.to_range();
    }

    if (loc.start.compare(ret.start) < 0) {
        ret.start = loc.start.copy();
    }

    if (loc.end.compare(ret.end) > 0) {
        ret.end = loc.end.copy();
    }

    return ret;
}

Range.spans = function() {
    var q = arguments;
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
            locs.push(arg.to_range());
        } else if (Array.prototype.isPrototypeOf(arg)) {
            args.concat(arg);
        } else if (typeof arg.location === 'function') {
            args.push(arg.location());
        } else if (typeof arg.location !== 'undefined') {
            args.push(arg.location);
        }
    }

    if (locs.length == 0) {
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
}

function BuiltinRange() {
    Range.call(this, new BuiltinLocation(), new BuiltinLocation());
}

BuiltinRange.prototype = Object.create(Range.prototype);
BuiltinRange.prototype.constructor = BuiltinRange;

BuiltinRange.prototype.inspect = function() {
    return '(builtin)';
}

BuiltinRange.prototype.marshal = function() {
    return '(builtin)';
}

BuiltinRange.prototype.copy = function() {
    return new BuiltinRange();
}

exports.BuiltinRange = BuiltinRange;

function SourceError(loc, message) {
    this.location = loc.copy();
    this.message = message;

    this._stack = (new Error()).stack;
}

SourceError.prototype.formatted_message = function() {
    var l = this.location.start.line;
    var c = this.location.start.column;

    return l + '.' + c + ': ' + this.message;
}

function Source(s, type) {
    this._source = s;
    this._remainder = this._source;
    this._location = new Location(1, 1);
    this._type = type;
}

Source.prototype.location = function() {
    return this._location;
}

Source.prototype.offset = function(loc) {
    this._location = loc.copy();
}

Source.prototype.eof = function() {
    return this._remainder.length == 0;
}

Source.prototype._source_map = function(loc) {
    return loc;
}

Source.prototype.skip = function(r) {
    this._next(r, false);
}

Source.prototype.source = function() {
    return this._source;
}

Source.prototype.next = function(r) {
    return this._next(r, true);
}

Source.prototype.type = function() {
    return this._type;
}

Source.prototype._next = function(r, tokenize) {
    var m = this._remainder.match(r);

    if (m && m.index == 0) {
        var l = m[0].length;

        var start = this._location.copy();

        this._remainder = this._remainder.slice(l);
        this._location = this._location.advance(m[0]);

        if (tokenize) {
            var rng = this._source_map(new Range(start, this._location));

            return new glsl.tokenizer.Token(0, m[0], rng);
        }
    }

    return null;
}

exports.Error = SourceError;
exports.Location = Location;
exports.Range = Range;
exports.Source = Source;

exports.VERTEX = 0;
exports.FRAGMENT = 1;

})(ns);

// vi:ts=4:et
