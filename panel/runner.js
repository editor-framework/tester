(function () {
    var url = 'packages://console/test/console.html';

    mocha.setup({
        ui: 'bdd',
    });
    mocha.setup({
        ui: 'tdd',
    });

    var reporter = require('./reporter.js');
    mocha.reporter(reporter);

    Polymer.Base.importHref( url, function ( event ) {
        mocha.checkLeaks();
        mocha.run();
    }, function ( err ) {
        Editor.error( 'Failed to load %s. message: %s', url, err.message );
    });
})();
