module.exports = {
    load: function () {
    },

    unload: function () {
    },

    'tester:open': function () {
        Editor.Panel.open('tester.panel');
    },

    'tester:run-test': function ( file ) {
        var Spawn = require('child_process').spawn;
        var App = require('app');
        var Ipc = require('ipc');

        var exePath = App.getPath('exe');

        var cp = Spawn(exePath, [Editor.appPath, '--test', file, '--report-details'], {
            stdio: [ 0, 1, 2, 'ipc' ],
        });

        cp.on ( 'message', function ( data ) {
            var fn = ipcHandlers[data.channel];
            if ( fn ) fn ( data );
        });

        var ipcHandlers = {
            'runner:start': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-start' );
            },

            'runner:end': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-end' );
            },

            'runner:suite': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-suite', data.suite );
            },

            'runner:suite-end': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-suite-end', data.suite );
            },

            'runner:test': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-test', data.test );
            },

            'runner:pending': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-pending', data.test );
            },

            'runner:pass': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-pass', data.test );
            },

            'runner:fail': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-fail', data.test, data.err );
            },

            'runner:test-end': function ( data ) {
                Editor.sendToPanel( 'tester.panel', 'tester:runner-test-end', data.stats, data.test );
            },
        };
    },
};
