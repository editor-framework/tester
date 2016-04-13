'use strict';

const Electron = require('electron');
const Path = require('fire-path');

let _ipcHandlers = {
  'runner:start' () {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-start' );
  },

  'runner:end' () {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-end' );
  },

  'runner:suite' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-suite', data.suite );
  },

  'runner:suite-end' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-suite-end', data.suite );
  },

  'runner:test' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-test', data.test );
  },

  'runner:pending' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-pending', data.test );
  },

  'runner:pass' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-pass', data.test );
  },

  'runner:fail' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-fail', data.test, data.err );
  },

  'runner:test-end' ( data ) {
    Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-test-end', data.test, data.stats );
  },
};

let testProcess = null;

module.exports = {
  load () {
  },

  unload () {
  },

  messages: {
    open () {
      Editor.Panel.open('tester.panel');
    },

    'query-hosts' ( event ) {
      let hosts = Object.keys(Editor.versions);
      let idx = hosts.indexOf(Editor.App.name);
      if ( idx !== -1 ) {
        hosts.splice( idx, 1 );
      }
      event.reply(null,hosts);
    },

    run ( event, info ) {
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
        Editor.Ipc.sendToPanel( 'tester.panel', 'tester:runner-close' );
      });
    },

    reload () {
      if ( !testProcess ) {
        return;
      }

      console.log('reload');
      testProcess.send({
        channel: 'tester:reload'
      });
    },

    'active-test-window' () {
      if ( !testProcess ) {
        return;
      }

      testProcess.send({
        channel: 'tester:active-window'
      });
    },

    close () {
      if ( !testProcess ) {
        return;
      }

      testProcess.send({
        channel: 'tester:exit'
      });
    },
  },
};
