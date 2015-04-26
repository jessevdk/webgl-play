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

var Settings = {
    backend: {
        url: function(u) {
            return 'http://webgl-play.codyn.net/' + u;
        }
    },

    frontend: {
        url: function(u) {
            return '//jessevdk.github.io/webgl-play/' + u;
        },

        dataQuery: function(hash) {
            return '//jessevdk.github.io/webgl-play/?d=' + hash;
        }
    },

    hooks: {
        about: function(ul) {
            var donate = '<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top"> \
                <input type="hidden" name="cmd" value="_s-xclick"> \
                <input type="hidden" name="hosted_button_id" value="MM6LF8RSX2UWC"> \
                <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!"> \
                <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1"> \
            </form>';

            var li = document.createElement('li');
            li.classList.add('donate');

            li.innerHTML = donate;
            ul.appendChild(li);
        },

        intro: function() {
            return "## WebGL Playground Introduction\n\nHi, and welcome! The WebGL Playground is a web-based, live editing environment primarily created to allow easy experimenting with WebGL.\nThe main editor consists of a vertex shader editor, fragment shader editor, JavaScript editor and a live view of the current rendering.\nRendering updates automatically as you type, while reporting any errors inline in the editors. A simple UI system allows you to create\ninteractive demos.\n\nThis website is very much still in beta, which means that you *will* encounter certain problems. If you do, please consider being a good\nopen source citizen and open an issue for it on the [issue tracker](https://github.com/jessevdk/webgl-play/issues). Most notable issues\nat the moment are:\n\n1. Limited amount of testing across browsers and platforms. The playground has been for the moment mostly tested on a single Mac using Chrome and to a lesser extend Firefox. It has not been tested *at all* at the moment on Internet Explorer and problems are expected to occur for untested combinations of platforms and browsers. Please file issues for any problems you encounter.\n2. There is no available documentation at the moment, neither for how to use the website, nor for the available API when writing the JavaScript code for your experiments. Please refer to the examples in the gallery for the moment while the documentation is being worked on.\n\n*Although I generally do not do this, I ask you kindly that if you find this website personally useful and valuable, to consider making a\n(very) small donation to help sustain it. There is a donate button in the **About** menu. Thanks!*\n\n[Source on github](https://github.com/jessevdk/webgl-play)\n";
        }
    }
};

// vi:ts=4:et
