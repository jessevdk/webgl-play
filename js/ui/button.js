var Widget = require('./widget');
var utils = require('../utils/utils');

function Button(e, opts) {
    if (!e) {
        e = document.createElement('div');
    }

    opts = utils.merge({
        nostyle: false
    }, opts);

    Widget.call(this, e);

    if (!opts.nostyle) {
        e.classList.add('button');
    }

    e.addEventListener('click', this._on_click.bind(this));
    e.addEventListener('dblclick', this._on_dblclick.bind(this));

    this._on_click_event = this.register_signal('click');
    this._on_dblclick_event = this.register_signal('dblclick');
}

Button.prototype = Object.create(Widget.prototype);
Button.prototype.constructor = Button;

Button.prototype._on_click = function(e) {
    this._on_click_event(e);
    e.preventDefault();
    e.stopPropagation();
}

Button.prototype._on_dblclick = function(e) {
    this._on_dblclick_event(e);
    e.preventDefault();
    e.stopPropagation();
}

module.exports = Button;

// vi:ts=4:et
