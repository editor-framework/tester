(() => {
  'use strict';

  const Path = require('fire-path');
  const Globby = require('globby');
  const Async = require('async');

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

  function _createFailEL ( test, err ) {
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

  //
  Editor.registerPanel('tester.panel', {
    properties: {
      module: {
        value: 'packages',
        type: String,
        observer: '_moduleChanged'
      },

      pkg: {
        value: '',
        type: String,
      },

      file: {
        value: '',
        type: String,
      },

      mode: {
        value: 'auto', // auto, renderer
        type: String,
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
              this.pkg = this._packages[0].value;
            }

            next ();
          });
        },

        next => {
          this._updateTestFiles ( next );
        },
      ]);

      this.reset();
    },

    _updateTestFiles ( cb ) {
      let path = Editor.url(`app://${this.module}/test`);

      if ( this.module === 'packages' ) {
        if ( !this.pkg ) {
          if ( cb ) {
            cb ();
          }
          return;
        }

        path = Path.join( this.pkg, 'test' );
      } else if ( this.module === 'app' ) {
        path = Editor.url(`app://test`);
      }

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

      this.lastPasses = 0;
      this.lastFailures = 0;
      this.lastDuration = 0;
      this.lastProgress = 0;

      this.curTestIdx = -1;

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
      if ( !this.pkg && this.module === 'packages' ) {
        if ( this._packages && this._packages.length ) {
          this.pkg = this._packages[0].value;
        }
      }
      this._updateTestFiles();
    },

    _isPackages ( module ) {
      return module === 'packages';
    },

    _onRunnerStart ( title ) {
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
      this.next();
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

    _onRunnerTestEnd ( stats, test ) {
      this.passes = this.lastPasses + stats.passes;
      this.failures = this.lastFailures + stats.failures;
      this.duration = this.lastDuration + stats.duration / 1000;
      this.progress = this.lastProgress + stats.progress/this._tests.length;

      // test
      let el;
      if ( test.state === 'passed' ) {
        el = _createPassEL(test);
      } else if (test.pending) {
        el = _createPendingEL(test);
      } else {
        el = _createFailEL(test, test.err);
      }

      // toggle code
      // TODO: defer
      if (!test.pending) {
        let h2 = el.getElementsByTagName('h2')[0];
        let pre = _fragment('<pre><code>%e</code></pre>', _clean(test.fn));

        h2.addEventListener( 'click', function () {
          pre.style.display = 'none' === pre.style.display ? 'block' : 'none';
        });

        Polymer.dom(el).appendChild(pre);
        pre.style.display = 'none';
      }

      // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
      if (this.stack[0]) {
        Polymer.dom(this.stack[0]).appendChild(el);
        this._scrollToEnd();
      }
    },

    _onRunnerFail ( test, err ) {
      if ( test.type === 'hook' ) {
        let el = _createFailEL(test, err);

        // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
        if (this.stack[0]) {
          Polymer.dom(this.stack[0]).appendChild(el);
          this._scrollToEnd();
        }
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
    'editor:dragstart' () {
      this.$.dragMask.hidden = false;
    },

    'editor:dragend' () {
      this.$.dragMask.hidden = true;
    },

    'tester:runner-start' () {
      this._onRunnerStart.apply( this, arguments );
    },

    'tester:runner-end' () {
      this._onRunnerEnd.apply( this, arguments );
    },

    'tester:runner-suite' () {
      this._onRunnerSuite.apply( this, arguments );
    },

    'tester:runner-suite-end' () {
      this._onRunnerSuiteEnd.apply( this, arguments );
    },

    'tester:runner-test' () {
    },

    'tester:runner-pending' () {
    },

    'tester:runner-pass' () {
    },

    'tester:runner-fail' () {
      this._onRunnerFail.apply( this, arguments );
    },

    'tester:runner-test-end' () {
      this._onRunnerTestEnd.apply( this, arguments );
    },
  });

})();
