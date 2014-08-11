"use strict";

if (!(typeof window == 'undefined')) {
    if (typeof window.glsl == 'undefined') {
        window.glsl = {};
    }

    window.glsl.source = {};
} else {
    var glsl = {
        tokenizer: require('./tokenizer')
    };
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

function Source(s) {
    this._source = s;
    this._remainder = this._source;
    this._location = new Location(1, 1);
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

})(typeof window == 'undefined' ? exports : window.glsl.source);

// vi:ts=4:et
