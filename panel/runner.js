(function () {
    // setup mocha
    mocha.setup({
        ui: 'bdd',
    });
    mocha.setup({
        ui: 'tdd',
    });
    mocha.reporter(require('./reporter.js'));

    // setup chai
    window.assert = chai.assert;
    window.expect = chai.expect;

    // running the test cases
    var url = 'packages://console/test/console.html';
    Polymer.Base.importHref( url, function ( event ) {
        mocha.checkLeaks();
        mocha.run();
    }, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', url, err.message );
    });
})();
