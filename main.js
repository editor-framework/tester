'use strict';

module.exports = {
  load () {
  },

  unload () {
  },

  'tester:open' () {
    Editor.Panel.open('tester.panel');
  },

  'tester:query-hosts' ( reply ) {
    let hosts = Object.keys(Editor.versions);
    let idx = hosts.indexOf(Editor.App.name);
    if ( idx !== -1 ) {
      hosts.splice( idx, 1 );
    }
    reply(hosts);
  },

  'tester:run-test' ( file ) {
    var Spawn = require('child_process').spawn;
    var App = require('app');

    var exePath = App.getPath('exe');

    var cp = Spawn(exePath, [Editor.App.path, '--test', file, '--report-details'], {
      stdio: [ 0, 1, 2, 'ipc' ],
    });

    cp.on ( 'message', function ( data ) {
      var fn = ipcHandlers[data.channel];
      if ( fn ) fn ( data );
    });

    var ipcHandlers = {
      'runner:start' () {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-start' );
      },

      'runner:end' () {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-end' );
      },

      'runner:suite' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-suite', data.suite );
      },

      'runner:suite-end' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-suite-end', data.suite );
      },

      'runner:test' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-test', data.test );
      },

      'runner:pending' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-pending', data.test );
      },

      'runner:pass' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-pass', data.test );
      },

      'runner:fail' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-fail', data.test, data.err );
      },

      'runner:test-end' ( data ) {
        Editor.sendToPanel( 'tester.panel', 'tester:runner-test-end', data.stats, data.test );
      },
    };
  },
};
