var Widget = require('./widget');

function Popup(child, on) {
    this._child = child;
    this._on = on;
    this._build();

    Widget.call(this, this._outer);

    this._on_window_mousedown = (function(e) {
        if (e.target !== this._outer) {
            this.destroy();
        } else {
            e.preventDefault();
            e.stopPropagation();
        }
    }).bind(this);

    this._on_window_keydown = (function(e) {
        if (e.keyCode === 27) {
            this.destroy();
        }
    }).bind(this);

    window.addEventListener('mousedown', this._on_window_mousedown);
    window.addEventListener('keydown', this._on_window_keydown);
}

Popup.prototype = Object.create(Widget.prototype);
Popup.prototype.constructor = Popup;

Popup.prototype.destroy = function() {
    document.body.removeChild(this._outer);

    window.removeEventListener('mousedown', this._on_window_mousedown);
    window.removeEventListener('keydown', this._on_window_keydown);
}

Popup.prototype._build = function() {
    var outer = document.createElement('div');
    outer.classList.add('popup');

    document.body.appendChild(outer);

    var arrow = document.createElement('div');
    arrow.classList.add('arrow');

    outer.appendChild(arrow);

    var content = document.createElement('div');
    content.classList.add('content');
    content.appendChild(this._child);

    outer.appendChild(content);

    var epos = this.page_position(this._on);
    epos.width = this._on.offsetWidth;
    epos.height = this._on.offsetHeight;

    var medim = {
        width: outer.offsetWidth,
        height: outer.offsetHeight
    };

    var pagedim = {
        width: document.body.offsetWidth - 12,
        height: document.body.offsetHeight - 12
    };

    var pos = {
        x: epos.x + epos.width / 2 - medim.width / 2,
        y: epos.y + epos.height + 14
    };

    if (pos.x + medim.width > pagedim.width) {
        pos.x = pagedim.width - medim.width;
    }

    var apos = epos.x + epos.width / 2 - pos.x;

    if (apos < 24) {
        apos = 24;
    } else if (apos > medim.width - 24) {
        apos = medim.width - 24;
    }

    arrow.style.left = apos + 'px';

    if (pos.y + medim.height > pagedim.height) {
        pos.y = epos.y - medim.height - 14;
        arrow.classList.add('down');
    } else {
        arrow.classList.add('up');
    }

    outer.style.left = pos.x + 'px';
    outer.style.top = pos.y + 'px';

    this._outer = outer;

    this._outer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
    });
}

module.exports = Popup;

// vi:ts=4:et
