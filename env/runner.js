(function () {
    var Ipc = require('ipc');

    // setup mocha
    mocha.setup({
        ui: 'bdd',
    });
    mocha.setup({
        ui: 'tdd',
    });

    var ipcReporter = Editor.require('packages://tester/env/ipc-reporter');
    mocha.reporter(ipcReporter);

    // setup chai
    window.assert = chai.assert;
    window.expect = chai.expect;

    var clientReady = false;
    var frameworkReady = false;
    var checkLeaks = true;

    // initialize client-side tester
    window.Tester = {
        ready: function () {
            clientReady = true;
            _runMocha ();
        },

        send: function ( channel ) {
            if ( !channel ) {
                throw new Error('Please specific a channel for your message');
            }
            var args = [].slice.call( arguments, 0 );
            args.unshift('tester:send');
            Ipc.sendToHost.apply(null,args);
        },

        checkLeaks: function ( enabled ) {
            checkLeaks = enabled;
        },

        // https://github.com/mochajs/mocha/wiki/Detecting-global-leaks
        detectLeak: function ( name_of_leaking_property ) {
            Object.defineProperty(global, name_of_leaking_property, {
                set : function(value) {
                    throw new Error('Global leak happends here!!');
                }
            });
        },
    };
    Tester.ready(); // not need for user manually call it.

    // running the test cases
    function _runMocha () {
        if ( frameworkReady && clientReady ) {
            if ( checkLeaks ) {
                mocha.checkLeaks();
            }
            mocha.globals(['Editor','Polymer']);
            mocha.run();
        }
    }

    function _whenFrameworksReady(callback) {
        // console.log('whenFrameworksReady');
        var done = function() {
            frameworkReady = true;

            // console.log('whenFrameworksReady done');
            callback();
        };

        function importsReady() {
            window.removeEventListener('WebComponentsReady', importsReady);
            // console.log('WebComponentsReady');

            if (window.Polymer && Polymer.whenReady) {
                Polymer.whenReady(function() {
                    // console.log('polymer-ready');
                    done();
                });
            } else {
                done();
            }
        }

        // All our supported framework configurations depend on imports.
        if (!window.HTMLImports) {
            done();
        } else if (HTMLImports.ready) {
            importsReady();
        } else {
            window.addEventListener('WebComponentsReady', importsReady);
        }
    }

    _whenFrameworksReady(_runMocha);
})();
