var Widget = require('./widget');
var utils = require('../utils/utils');

function Switch(options) {
    var e = this.create('table', {
        classes: 'switch',
        children: this.create('tr', {
            children: [
                this.create('td', {
                    textContent: 'On'
                }),

                this.create('td', {
                    textContent: 'Off'
                })
            ]
        })
    });

    Widget.call(this, e);

    /*this.handle = document.createElement('div');
    this.handle.classList.add('handle');

    e.appendChild(this.handle);*/
}

Switch.prototype = Object.create(Widget.prototype);
Switch.prototype.constructor = Switch;

module.exports = Switch;

// vi:ts=4:et
