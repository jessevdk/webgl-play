var Widget = require('./widget');

function Panel(p) {
    Widget.call(this, p);

    if (this.e.classList.contains('vertical')) {
        this._orientation = Panel.Orientation.VERTICAL;
    } else {
        this._orientation = Panel.Orientation.HORIZONTAL;
    }

    var children = this.children();

    this.child1 = children[0];
    this.sep = children[1];
    this.child2 = children[2];

    this._on_mousedown = this._on_mousedown_real.bind(this);
    this._on_mouseup = this._on_mouseup_real.bind(this);
    this._on_mousemove = this._on_mousemove_real.bind(this);

    this._on_resized = this.register_signal('resized');

    this.sep.addEventListener('mousedown', this._on_mousedown);
}

Panel.prototype = Object.create(Widget.prototype);
Panel.prototype.constructor = Panel;

Panel.Orientation = {
    HORIZONTAL: 0,
    VERTICAL: 1
};

Panel.prototype._on_mousedown_real = function(e) {
    window.addEventListener('mousemove', this._on_mousemove);
    window.addEventListener('mouseup', this._on_mouseup);

    p = this.page_position(this.sep);

    if (this._orientation == Panel.Orientation.VERTICAL) {
        this._doffset = e.pageY - p.y;
        document.body.style.cursor = 'ns-resize';
    } else {
        this._doffset = e.pageX - p.x;
        document.body.style.cursor = 'ew-resize';
    }

    e.preventDefault();
}

Panel.prototype._on_mouseup_real = function(e) {
    window.removeEventListener('mousemove', this._on_mousemove);
    window.removeEventListener('mouseup', this._on_mouseup);

    document.body.style.cursor = '';

    e.preventDefault();
}

Panel.prototype._on_mousemove_real = function(e) {
    var d;

    pagepos = this.page_position();

    if (this._orientation == Panel.Orientation.VERTICAL) {
        d = e.pageY - pagepos.y;
    } else {
        d = e.pageX - pagepos.x;
    }

    this.child1.style.flexBasis = (d - this._doffset) + 'px';

    this._on_resized();

    e.preventDefault();
}

module.exports = Panel;

// vi:ts=4:et
