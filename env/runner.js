(function () {
    // setup mocha
    mocha.setup({
        ui: 'bdd',
    });

    mocha.reporter(IpcReporter);

    // setup chai
    chai.config.includeStack = true; // turn on stack trace
    chai.config.showDiff = true;
    chai.config.truncateThreshold = 0; // disable truncating
    window.assert = chai.assert;
    window.expect = chai.expect;
    window.sinon = require('sinon');

    var frameworkReady = false;

    // running the test cases
    function _runMocha () {
        if ( frameworkReady ) {
            if ( Tester.needCheckLeaks ) {
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
