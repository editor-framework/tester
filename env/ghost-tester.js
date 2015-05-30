(function () {
    var Ipc = require('ipc');
    var _checkLeaks = true;

    function _keyboardEventFor ( type, keyCode, modifier ) {
        var event = new CustomEvent(type);

        event.keyCode = keyCode;
        event.code = keyCode;

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

        focus: function ( target ) {
            Polymer.Base.fire.call(target, 'focus');
        },

        blur: function ( target ) {
            Polymer.Base.fire.call(target, 'blur');
        },

        keyDownOn: function ( target, keyText, modifier ) {
            target.dispatchEvent(_keyboardEventFor('keydown', Editor.KeyCode(keyText), modifier));
        },

        keyUpOn: function ( target, keyText, modifier ) {
            target.dispatchEvent(_keyboardEventFor('keyup', Editor.KeyCode(keyText), modifier));
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
