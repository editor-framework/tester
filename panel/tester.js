(() => {
  'use strict';

  const Path = require('fire-path');
  const Globby = require('globby');
  const Async = require('async');
  const Hljs = require('highlight.js');

  function _escape (html) {
    return String(html)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      ;
  }

  function _clean (str) {
    str = str
      .replace(/\r\n?|[\n\u2028\u2029]/g, '\n').replace(/^\uFEFF/, '')
      .replace(/^function *\(.*\)\s*{|\(.*\) *=> *{?/, '')
      .replace(/\s+\}$/, '')
      ;

    let spaces = str.match(/^\n?( *)/)[1].length;
    let tabs = str.match(/^\n?(\t*)/)[1].length;
    let re = new RegExp('^\n?' + (tabs ? '\t' : ' ') + '{' + (tabs ? tabs : spaces) + '}', 'gm');

    str = str.replace(re, '');

    // trim
    return str.replace(/^\s+|\s+$/g, '');
  }

  function _fragment (html) {
    let args = arguments;
    let div = document.createElement('div');
    let i = 1;

    div.innerHTML = html.replace(/%([se])/g, function(_, type){
      switch (type) {
      case 's': return String(args[i++]);
      case 'e': return _escape(args[i++]);
      }
    });

    return div.firstChild;
  }

  function _makeUrl (s) {
    let search = window.location.search;

    // Remove previous grep query parameter if present
    if (search) {
      search = search.replace(/[?&]grep=[^&\s]*/g, '').replace(/^&/, '?');
    }

    return window.location.pathname + (search ? search + '&' : '?' ) + 'grep=' + encodeURIComponent(s);
  }

  function _createPassEL ( test ) {
    return _fragment('<li class="test pass %e"><h2>%e<span class="duration">%ems</span></h2></li>',
                     test.speed, test.title, test.duration);
  }

  function _createPendingEL ( test ) {
    return _fragment('<li class="test pass pending"><h2>%e</h2></li>', test.title);
  }

  function _createFailEL ( test ) {
    let err = test.err;
    let el = _fragment('<li class="test fail"><h2>%e</h2></li>', test.title, _makeUrl(test.fullTitle));
    let errText = err.stack;

    // FF / Opera do not add the message
    if ( !~errText.indexOf(err.message) ) {
      errText = err.message + '\n' + errText;
    }

    // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
    // check for the result of the stringifying.
    if ('[object Error]' === errText) {
      errText = err.message;
    }

    Polymer.dom(el).appendChild(_fragment('<pre class="error">%e</pre>', errText));
    return el;
  }

  function _appendCodePre ( el, test ) {
    let h2 = el.getElementsByTagName('h2')[0];
    let result = Hljs.highlight( 'javascript', _clean(test.fn) );
    let pre = _fragment('<pre id="code">%s</pre>', result.value);

    h2.addEventListener( 'click', function () {
      pre.style.display = 'none' === pre.style.display ? 'block' : 'none';
    });

    Polymer.dom(el).appendChild(pre);
    pre.style.display = 'none';
  }

  //
  Editor.registerPanel('tester.panel', {
    properties: {
      module: {
        value: 'packages',
        type: String,
        observer: '_moduleChanged'
      },

      pkgPath: {
        value: '',
        type: String,
        observer: '_pkgPathChanged'
      },

      file: {
        value: '',
        type: String,
      },

      mode: {
        value: 'auto', // auto, renderer
        type: String,
      },

      debug: {
        value: false,
        type: Boolean,
      },
    },

    ready: function () {
      Async.series([
        next => {
          Editor.sendRequestToCore('tester:query-hosts', hosts => {
            hosts.unshift('packages');
            hosts.unshift('app');
            this._moduleInfos = hosts.map(name => {
              return { value: name, text: EditorUI.toHumanText(name) };
            });

            next();
          });
        },

        next => {
          Editor.sendRequestToCore('package:query-infos', infos => {
            this._packages = infos.map(info => {
              return {
                value: info.path,
                text: Path.join(
                  Path.basename(Path.dirname(info.path)),
                  Path.basename(info.path)
                )
              };
            });

            this._packages.sort((a,b) => {
              return a.text.localeCompare(b.text);
            });

            if ( this._packages && this._packages.length ) {
              this.pkgPath = this._packages[0].value;
            }

            next ();
          });
        },

        next => {
          this._updateTestFiles ( next );
        },
      ]);

      this.reset();
      this._running = false;
    },

    _updateTestFiles ( cb ) {
      let path = Editor.url(`app://${this.module}/test`);

      if ( this.module === 'packages' ) {
        if ( !this.pkgPath ) {
          if ( cb ) {
            cb ();
          }
          return;
        }

        path = Path.join( this.pkgPath, 'test' );
      } else if ( this.module === 'app' ) {
        path = Editor.url(`app://test`);
      }

      this.file = '';

      Globby([
        Path.join(path,'**/*.js'),
        '!**/fixtures/**',
      ], (err,files) => {
        this._files = files.map(file => {
          return Path.relative(path,file);
        });

        if ( this._files.length ) {
          this.file = this._files[0];
        }

        if ( cb ) {
          cb ();
        }
      });
    },

    // TODO
    // 'tester:run-tests' ( pkgName ) {
    //   Editor.Panel.focus('tester.panel');
    // },

    reset () {
      this.passes = 0;
      this.failures = 0;
      this.duration = 0;
      this.progress = 0;

      let mochaReportEL = this.$['mocha-report'];
      while ( mochaReportEL.children.length ) {
        mochaReportEL.firstChild.remove();
      }
      this.stack = [mochaReportEL];

      if ( !this._tests || !this._tests.length ) {
        this._tests = [];
      }
    },

    _moduleChanged () {
      if ( !this.pkgPath && this.module === 'packages' ) {
        if ( this._packages && this._packages.length ) {
          this.pkgPath = this._packages[0].value;
        }
      }
      this._updateTestFiles();
    },

    _pkgPathChanged () {
      this._updateTestFiles();
    },

    _isPackages ( module ) {
      return module === 'packages';
    },

    _onRun () {
      if ( this._running )
        return;

      this.reset();
      this._running = true;

      Editor.sendToCore('tester:run', {
        module: this.module,
        package: this.pkgPath,
        file: this.file,
        mode: this.mode,
        debug: this.debug
      });
    },

    _onReload () {
      Editor.sendToCore('tester:reload');
    },

    _onActiveTestWindow () {
      Editor.sendToCore('tester:active-test-window');
    },

    _onClose () {
      Editor.sendToCore('tester:close');
    },

    _onRunnerClose () {
      this._running = false;
    },

    _onRunnerStart () {
      this.reset();

      let title = '';
      if ( this.module === 'app' ) {
        title = `${this.file}`;
      } else if ( this.module === 'packages' ) {
        title = `${this.file} (${Path.basename(this.pkgPath)})`;
      } else {
        title = `${this.file} (${this.module})`;
      }

      // runner
      let el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>', title);

      // container
      Polymer.dom(this.stack[0]).appendChild(el);
      this.stack.unshift(document.createElement('ul'));
      Polymer.dom(el).appendChild(this.stack[0]);
      this._scrollToEnd();
    },

    _onRunnerEnd () {
      // console.log('%s runner finish', Url.basename(this.$.runner.src));
      this.stack.shift();
    },

    _onRunnerSuite ( suite ) {
      if ( suite.root )
        return;

      // suite
      let el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>', _escape(suite.title));

      // container
      Polymer.dom(this.stack[0]).appendChild(el);
      this.stack.unshift(document.createElement('ul'));
      Polymer.dom(el).appendChild(this.stack[0]);
      this._scrollToEnd();
    },

    _onRunnerSuiteEnd ( suite ) {
      if ( suite.root )
        return;

      this.stack.shift();
    },

    _onRunnerTest () {
    },

    _onRunnerTestEnd ( test, stats ) {
      this.passes = stats.passes;
      this.failures = stats.failures;
      this.duration = stats.duration / 1000;
      this.progress = stats.progress;
    },

    _onRunnerFail ( test ) {
      let el = _createFailEL(test);
      _appendCodePre ( el, test );

      // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
      if (this.stack[0]) {
        Polymer.dom(this.stack[0]).appendChild(el);
        this._scrollToEnd();
      }
    },

    _onRunnerPass ( test ) {
      let el = _createPassEL(test);
      _appendCodePre ( el, test );

      // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
      if (this.stack[0]) {
        Polymer.dom(this.stack[0]).appendChild(el);
        this._scrollToEnd();
      }
    },

    _onRunnerPending ( test ) {
      let el = _createPendingEL(test);

      // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
      if (this.stack[0]) {
        Polymer.dom(this.stack[0]).appendChild(el);
        this._scrollToEnd();
      }
    },

    _toFixed ( number, p ) {
      return number.toFixed(p);
    },

    _scrollToEnd () {
      if ( this._scrollTaskID )
        return;

      // to make sure after layout and before render
      this._scrollTaskID = window.requestAnimationFrame ( function () {
        this._scrollTaskID = null;
        let scrollView = this.$['mocha-report-view'];
        scrollView.scrollTop = scrollView.scrollHeight;
      }.bind(this) );
    },

    // ipc
    'tester:runner-start' () {
      this._onRunnerStart();
    },

    'tester:runner-end' () {
      this._onRunnerEnd();
    },

    'tester:runner-suite' ( suite ) {
      this._onRunnerSuite(suite);
    },

    'tester:runner-suite-end' ( suite ) {
      this._onRunnerSuiteEnd(suite);
    },

    'tester:runner-test' ( test ) {
      this._onRunnerTest(test);
    },

    'tester:runner-pending' (test) {
      this._onRunnerPending(test);
    },

    'tester:runner-pass' (test) {
      this._onRunnerPass(test);
    },

    'tester:runner-fail' (test) {
      this._onRunnerFail(test);
    },

    'tester:runner-test-end' (test, stats) {
      this._onRunnerTestEnd(test, stats);
    },

    'tester:runner-close' () {
      this._onRunnerClose();
    },
  });

})();
