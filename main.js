'use strict';

const Electron = require('electron');
const Path = require('fire-path');

let _ipcHandlers = {
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
    Editor.sendToPanel( 'tester.panel', 'tester:runner-test-end', data.test, data.stats );
  },
};

let testProcess = null;

module.exports = {
  load () {
  },

  unload () {
  },

  'tester:open' () {
    Editor.Panel.open('tester.panel');
  },

  'tester:query-hosts' ( event, reply ) {
    let hosts = Object.keys(Editor.versions);
    let idx = hosts.indexOf(Editor.App.name);
    if ( idx !== -1 ) {
      hosts.splice( idx, 1 );
    }
    reply(hosts);
  },

  'tester:run' ( event, info ) {
    const Spawn = require('child_process').spawn;

    let args = [Editor.App.path, 'test', '--reporter', 'child-process'];
    let file = info.file;

    if ( info.module === 'packages' ) {
      args.push('--package');
      file = Path.join( info.package, 'test', file );
    } else if ( info.module === 'app' ) {
      file = Path.join( Editor.App.path, 'test', file );
    } else {
      file = Path.join( Editor.App.path, info.module, 'test', file );
    }

    if ( info.mode === 'renderer' ) {
      args.push('--renderer');
    }

    if ( info.debug ) {
      args.push('--detail');
    }

    args.push(file);

    let exePath = Electron.app.getPath('exe');
    testProcess = Spawn(exePath, args, {
      stdio: [ 0, 1, 2, 'ipc' ],
      // stdio: 'inherit'
    });

    testProcess.on('message', data => {
      let fn = _ipcHandlers[data.channel];
      if ( fn ) {
        fn ( data );
      }
    });

    testProcess.on('close', () => {
      testProcess = null;
      Editor.sendToPanel( 'tester.panel', 'tester:runner-close' );
    });
  },

  'tester:reload' () {
    if ( !testProcess ) {
      return;
    }

    console.log('reload');
    testProcess.send({
      channel: 'tester:reload'
    });
  },

  'tester:active-test-window' () {
    if ( !testProcess ) {
      return;
    }

    testProcess.send({
      channel: 'tester:active-window'
    });
  },

  'tester:close' () {
    if ( !testProcess ) {
      return;
    }

    testProcess.send({
      channel: 'tester:exit'
    });
  },
};
