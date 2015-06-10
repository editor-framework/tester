(function () {
    var Ipc = require('ipc');
    var _checkLeaks = true;

    function _keyboardEventFor ( type, keyCode, modifier ) {
        var event = new CustomEvent(type);

        event.keyCode = keyCode;
        event.code = keyCode;
        event.which = keyCode;

        if ( modifier === 'shift')
            event.shiftKey = true;
        else if ( modifier === 'ctrl' )
            event.ctrlKey = true;
        else if ( modifier === 'command' )
            event.metaKey = true;
        else if ( modifier === 'alt' )
            event.altKey = true;

        return event;
    }

    function _mouseEventFor ( type, x, y, button ) {
        var props = {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: button ? button-1 : -1,
        };

        var event = new MouseEvent(type,props);
        return event;
    }

    var Tester = {
        send: function ( channel ) {
            if ( !channel ) {
                throw new Error('Please specific a channel for your message');
            }
            var args = [].slice.call( arguments, 0 );
            args.unshift('tester:send');
            Ipc.sendToHost.apply(null,args);
        },

        checkLeaks: function ( enabled ) {
            _checkLeaks = enabled;
        },

        // https://github.com/mochajs/mocha/wiki/Detecting-global-leaks
        detectLeak: function ( name_of_leaking_property ) {
            Object.defineProperty(global, name_of_leaking_property, {
                set : function(value) {
                    throw new Error('Global leak happends here!!');
                }
            });
        },

        // ===================
        // general focus events
        // ===================

        focus: function ( target ) {
            if ( target.setFocus ) {
                target.setFocus();
                return;
            }
            Polymer.Base.fire.call(target, 'focus');
        },

        blur: function ( target ) {
            if ( target.setBlur ) {
                target.setBlur();
                return;
            }
            Polymer.Base.fire.call(target, 'blur');
        },

        // ===================
        // general keyboard events
        // ===================

        keydown: function ( target, keyText, modifier ) {
            target.dispatchEvent(_keyboardEventFor('keydown', Editor.KeyCode(keyText), modifier));
        },

        keyup: function ( target, keyText, modifier ) {
            target.dispatchEvent(_keyboardEventFor('keyup', Editor.KeyCode(keyText), modifier));
        },

        keypress: function (target, keyText) {
            target.dispatchEvent(_keyboardEventFor('keypress', Editor.KeyCode(keyText)));
        },

        // ===================
        // general mouse events
        // ===================

        click: function ( target, x, y, button ) {
            var pos = { x: x, y: y };
            if ( typeof x !== 'number' || typeof y !== 'number' )
                pos = this.middleOfNode(target);

            Tester.mousedown(target, pos.x, pos.y);
            Tester.mouseup(target, pos.x, pos.y);

            target.dispatchEvent(_mouseEventFor('click', pos.x, pos.y, button ));
        },

        dblclick: function ( target, x, y, button ) {
            var pos = { x: x, y: y };
            if ( typeof x !== 'number' || typeof y !== 'number' )
                pos = this.middleOfNode(target);

            target.dispatchEvent(_mouseEventFor('dblclick', pos.x, pos.y, button ));
        },

        mousedown: function ( target, x, y, button ) {
            var pos = { x: x, y: y };
            if ( typeof x !== 'number' || typeof y !== 'number' )
                pos = this.middleOfNode(target);

            target.dispatchEvent(_mouseEventFor('mousedown', pos.x, pos.y, button ));
        },

        mouseup: function ( target, x, y, button ) {
            var pos = { x: x, y: y };
            if ( typeof x !== 'number' || typeof y !== 'number' )
                pos = this.middleOfNode(target);

            target.dispatchEvent(_mouseEventFor('mouseup', pos.x, pos.y, button ));
        },

        mousewheel: function ( target, x, y, delta ) {
            var pos = { x: x, y: y };
            if ( typeof x !== 'number' || typeof y !== 'number' )
                pos = this.middleOfNode(target);

            target.dispatchEvent(new WheelEvent('mousewheel',{
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                deltaY: delta,
            }));
        },

        mousemove: function ( target, from, to, button, steps ) {
            steps = steps || 5;
            var dx = Math.round((to.x - from.x) / steps);
            var dy = Math.round((to.y - from.y) / steps);
            var pos = {
                x: from.x,
                y: from.y
            };
            for ( var i = steps; i > 0; i-- ) {
                target.dispatchEvent(_mouseEventFor('mousemove', pos.x, pos.y, button ));
                pos.x += dx;
                pos.y += dy;
            }
            target.dispatchEvent(_mouseEventFor('mousemove', to.x, to.y, button ));
        },

        // ===================
        // special events
        // ===================

        mousetrack: function ( target, from, to, steps ) {
            Tester.mousedown(target, from.x, from.y, 1);
            Tester.mousemove(target, from, to, 1, steps);
            Tester.mouseup(target, to.x, to.y, 1);
        },

        pressAndReleaseKeyOn: function ( target, keyText ) {
            Tester.keydown(target, keyText);
            Polymer.Base.async(function() {
                Tester.keyup(target, keyText);
            }, 1);
        },

        pressEnter: function (target) {
            Tester.pressAndReleaseKeyOn(target, 'enter');
        },

        pressSpace: function (target) {
            Tester.pressAndReleaseKeyOn(target, 'space');
        },

        // ===================
        // helpers
        // ===================

        flushAsyncOperations: function () {
            // force distribution
            Polymer.dom.flush();

            // force lifecycle callback to fire on polyfill
            if ( window.CustomElements )
                window.CustomElements.takeRecords();
        },

        forceXIfStamp: function (target) {
            var templates = Polymer.dom(target.root).querySelectorAll('template[is=dom-if]');
            for ( var i = 0; i < templates.length; ++i ) {
                var tmpl = templates[i];
                tmpl.render();
            }

            Tester.flushAsyncOperations();
        },

        fireEvent: function(target, type, props) {
            var event = new CustomEvent(type, {
                bubbles: true,
                cancelable: true
            });
            for ( var p in props ) {
                event[p] = props[p];
            }
            target.dispatchEvent(event);
        },

        middleOfNode: function (target) {
            var bcr = target.getBoundingClientRect();
            return {
              y: bcr.top + (bcr.height / 2),
              x: bcr.left + (bcr.width / 2)
            };
        },

        topLeftOfNode: function(target) {
            var bcr = target.getBoundingClientRect();
            return {
              y: bcr.top,
              x: bcr.left
            };
        },
    };

    Object.defineProperty( Tester, 'needCheckLeaks', {
        get: function () {
            return _checkLeaks;
        }
    });

    // initialize client-side tester
    window.Tester = Tester;
})();
