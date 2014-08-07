(function(exports) {

function SourceLocation(line, column) {
    this.line = line;
    this.column = column;
}

exports.SourceLocation = SourceLocation;

SourceLocation.prototype.copy = function() {
    return new SourceLocation(this.line, this.column);
}

SourceLocation.prototype.to_range = function() {
    return new SourceRange(this, this);
}

SourceLocation.prototype.compare = function(loc) {
    if (this.line != loc.line) {
        return this.line < loc.line ? -1 : 1;
    }

    if (this.column != loc.column) {
        return this.column < loc.column ? -1 : 1;
    }

    return 0;
}

SourceLocation.prototype.advance = function(s) {
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

function SourceRange(start, end) {
    this.start = start.copy();
    this.end = end.copy();
}

exports.SourceRange = SourceRange;

SourceRange.prototype.copy = function() {
    return new SourceRange(this.start, this.end);
}

function SourceError(loc, message) {
    this.location = loc.copy();
    this.message = message;
}

SourceError.prototype.formatted_message = function() {
    var l = this.location.start.line;
    var c = this.location.start.column;

    return l + '.' + c + ': ' + this.message;
}

exports.SourceError = SourceError;

function Source(s) {
    this._source = s;
    this._remainder = this._source;
    this._location = new SourceLocation(1, 1);
}

exports.Source = Source;

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
            var rng = this._source_map(new SourceRange(start, this._location));

            return new Token(0, m[0], rng);
        }
    }

    return null;
}

})(typeof window == 'undefined' ? global : window);

// vi:ts=4:et
