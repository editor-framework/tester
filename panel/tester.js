(function () {
var Url = require('fire-url');
var Fs = require('fire-fs');
var Path = require('fire-path');

function _escape(html) {
  return String(html)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _clean(str) {
  str = str
    .replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '')
    .replace(/^function *\(.*\)\s*{|\(.*\) *=> *{?/, '')
    .replace(/\s+\}$/, '');

  var spaces = str.match(/^\n?( *)/)[1].length,
      tabs = str.match(/^\n?(\t*)/)[1].length,
      re = new RegExp('^\n?' + (tabs ? '\t' : ' ') + '{' + (tabs ? tabs : spaces) + '}', 'gm');

  str = str.replace(re, '');

  // trim
  return str.replace(/^\s+|\s+$/g, '');
}

function _fragment(html) {
    var args = arguments,
        div = document.createElement('div'),
        i = 1;

    div.innerHTML = html.replace(/%([se])/g, function(_, type){
        switch (type) {
            case 's': return String(args[i++]);
            case 'e': return _escape(args[i++]);
        }
    });

    return div.firstChild;
}

function _makeUrl(s) {
    var search = window.location.search;

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
    var el = _fragment('<li class="test fail"><h2>%e</h2></li>', test.title, _makeUrl(test.fullTitle));
    var errText = err.stack;

    // FF / Opera do not add the message
    if ( !~errText.indexOf(err.message) ) {
        errText = err.message + '\n' + errText;
    }

    // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
    // check for the result of the stringifying.
    if ('[object Error]' === errText) errText = err.message;

    Polymer.dom(el).appendChild(_fragment('<pre class="error">%e</pre>', errText));
    return el;
}

//
Editor.registerPanel( 'tester.panel', {
    properties: {
    },

    ready: function () {
        this._ipcList = [];

        this.reset();
    },

    'panel:open': function ( argv ) {
        if ( !argv || !argv.name ) {
            this._tests = [];
            this.reset();
            this.next();
            return;
        }

        this.runTests(argv.name);
    },

    'tester:run-tests': function ( pkgName ) {
        Editor.Panel.focus('tester.panel');
        this.runTests(pkgName);
    },

    reset: function () {
        this.passes = 0;
        this.failures = 0;
        this.duration = 0;
        this.progress = 0;

        this.lastPasses = 0;
        this.lastFailures = 0;
        this.lastDuration = 0;
        this.lastProgress = 0;

        this.curTestIdx = -1;

        var mochaReportEL = this.$['mocha-report'];
        while ( mochaReportEL.children.length ) {
            mochaReportEL.firstChild.remove();
        }
        this.stack = [mochaReportEL];

        if ( !this._tests || !this._tests.length ) {
            this._tests = [];
        }
    },

    next: function () {
        this.lastPasses = this.passes;
        this.lastFailures = this.failures;
        this.lastDuration = this.duration;
        this.lastProgress = this.progress;

        this.curTestIdx += 1;
        if ( this.curTestIdx < this._tests.length ) {
            this._run(this._tests[this.curTestIdx]);
        }
        else {
            this._end();
        }
    },

    resetRunner: function () {
        // NOTE: The reason I don't use this.$.runner.src directly is because it will not stop
        //       the current running tests, even if I call runner.stop(). So destroy the webview is
        //       and recreate it is better than give him a source.
        if ( this.$.runner ) {
            Polymer.dom(this.$.webviewWrapper).removeChild(this.$.runner);
            this.$.runner = null;
        }

        var webview = document.createElement('webview');
        webview.setAttribute( 'id', 'runner' );
        // webview.setAttribute( 'src', Editor.url(url) );
        webview.setAttribute( 'nodeintegration', '' );
        webview.setAttribute( 'disablewebsecurity', '' );
        webview.setAttribute( 'autosize', 'on' );
        webview.setAttribute( 'maxheight', '200' );
        webview.addEventListener( 'console-message', this._onRunnerConsole.bind(this) );
        webview.addEventListener( 'ipc-message', this._onRunnerIpc.bind(this) );
        webview.addEventListener( 'crashed', function ( event ) {
            console.error( 'webview crashed!' );
        });
        webview.addEventListener( 'gpu-crashed', function ( event ) {
            console.error( 'webview gpu-crashed!' );
        });
        webview.addEventListener( 'plugin-crashed', function ( event ) {
            console.error( 'webview plugin-crashed!' );
        });
        this.$.runner = webview;

        Polymer.dom(this.$.webviewWrapper).appendChild(this.$.runner);
    },

    runTests: function ( pkgName ) {
        //
        Editor.Package.queryInfo( pkgName, function ( result ) {
            var pkgInfo = result.info;
            var tests = pkgInfo.tests || [];
            this._tests = tests.map( function ( path ) {
                if ( pkgInfo.build )
                    return Url.join( 'packages://', pkgInfo.name, 'bin', 'dev', path );

                return Url.join( 'packages://', pkgInfo.name, path );
            });
            this.reset();
            this.next();

        }.bind(this));
    },

    reload: function () {
        this.reset();
        this.next();
    },

    _run: function ( url ) {
        this.resetRunner();
        if ( this.$.runner ) {
            var src = Editor.url(url);
            if ( Fs.existsSync(src) ) {
                var extname = Path.extname(src);
                if ( extname === '.html' ) {
                    this.$.runner.src = src;
                }
                else if ( extname === '.js') {
                    this.$.runner.src = Editor.url('packages://tester/env/env-core.html');
                    Editor.sendToCore( 'tester:run-test', src );
                }
                this.$.runner.title = Path.basename(src);
            } else {
                this.$.runner.src = Editor.url('packages://tester/env/empty.html');
                this.$.runner.title = Path.basename(this.$.runner.src);
            }
        }
    },

    _end: function () {
        if ( this.$.runner ) {
            Polymer.dom(this.$.webviewWrapper).removeChild(this.$.runner);
            this.$.runner = null;
        }

        var div = document.createElement('div');
        div.setAttribute( 'id', 'runner' );
        div.classList.add('fit');
        this.$.runner = div;

        var h1 = document.createElement('h1');
        h1.innerText = 'No Test';
        div.appendChild(h1);

        Polymer.dom(this.$.webviewWrapper).appendChild(this.$.runner);
    },

    _sendToView: function () {
        var args = [].slice.call(arguments, 0);
        this.$.runner.send.apply(this.$.runner,args);
    },

    _onReload: function ( event ) {
        this.reload();
    },

    _onRunnerConsole: function ( event ) {
        switch ( event.level ) {
        case 0:
            console.log('[runner-console]: ', event.message);
            break;

        case 1:
            console.warn('[runner-console]: ', event.message);
            break;

        case 2:
            console.error('[runner-console]: ', event.message);
            break;
        }
    },

    _onRunnerIpc: function ( event ) {
        var stats, suite, test, err, errText, el, url;

        switch ( event.channel ) {
        case 'tester:send':
            // NOTE: this will prevent us send back ipc message
            //       in ipc callstack which will make ipc event in reverse order
            if ( !this._timeoutID ) {
                this._timeoutID = setTimeout( function () {
                    for ( var i = 0; i < this._ipcList.length; ++i ) {
                        this._sendToView.apply( this, this._ipcList[i] );
                    }
                    this._ipcList = [];
                    this._timeoutID = null;
                }.bind(this),1);
            }
            this._ipcList.push( event.args );
            break;

        case 'runner:start': this._onRunnerStart(); break;
        case 'runner:end': this._onRunnerEnd(); break;
        case 'runner:suite': this._onRunnerSuite( event.args[0] ); break;
        case 'runner:suite-end': this._onRunnerSuiteEnd( event.args[0] ); break;
        case 'runner:test': break;
        case 'runner:test-end': this._onRunnerTestEnd( event.args[0],  event.args[1] ); break;
        case 'runner:pending': break;
        case 'runner:pass': break;
        case 'runner:fail': this._onRunnerFail( event.args[0],  event.args[1] ); break;
        }
    },

    _onRunnerStart: function () {
        // runner
        var el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>', this.$.runner.title);

        // container
        Polymer.dom(this.stack[0]).appendChild(el);
        this.stack.unshift(document.createElement('ul'));
        Polymer.dom(el).appendChild(this.stack[0]);
        this._scrollToEnd();
    },

    _onRunnerEnd: function () {
        // console.log('%s runner finish', Url.basename(this.$.runner.src));
        this.stack.shift();
        this.next();
    },

    _onRunnerSuite: function ( suite ) {
        if ( suite.root )
            return;

        // suite
        var el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>', _escape(suite.title));

        // container
        Polymer.dom(this.stack[0]).appendChild(el);
        this.stack.unshift(document.createElement('ul'));
        Polymer.dom(el).appendChild(this.stack[0]);
        this._scrollToEnd();
    },

    _onRunnerSuiteEnd: function ( suite ) {
        if ( suite.root )
            return;

        this.stack.shift();
    },

    _onRunnerTestEnd: function ( stats, test ) {
        this.passes = this.lastPasses + stats.passes;
        this.failures = this.lastFailures + stats.failures;
        this.duration = this.lastDuration + stats.duration / 1000;
        this.progress = this.lastProgress + stats.progress/this._tests.length;

        // test
        var el;
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
            var h2 = el.getElementsByTagName('h2')[0];

            h2.addEventListener( 'click', function () {
                pre.style.display = 'none' == pre.style.display ? 'block' : 'none';
            });

            var pre = _fragment('<pre><code>%e</code></pre>', _clean(test.fn));
            Polymer.dom(el).appendChild(pre);
            pre.style.display = 'none';
        }

        // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
        if (this.stack[0]) {
            Polymer.dom(this.stack[0]).appendChild(el);
            this._scrollToEnd();
        }
    },

    _onRunnerFail: function ( test, err ) {
        if ( test.type === 'hook' ) {
            var el = _createFailEL(test, err);

            // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
            if (this.stack[0]) {
                Polymer.dom(this.stack[0]).appendChild(el);
                this._scrollToEnd();
            }
        }
    },

    _toFixed: function ( number, p ) {
        return number.toFixed(p);
    },

    _scrollToEnd: function () {
        if ( this._scrollTaskID )
            return;

        // to make sure after layout and before render
        this._scrollTaskID = window.requestAnimationFrame ( function () {
            this._scrollTaskID = null;
            var scrollView = this.$['mocha-report-view'];
            scrollView.scrollTop = scrollView.scrollHeight;
        }.bind(this) );
    },

    // ipc
    'editor:dragstart': function () {
        this.$.dragMask.hidden = false;
    },

    'editor:dragend': function () {
        this.$.dragMask.hidden = true;
    },

    'tester:runner-start': function () {
        this._onRunnerStart.apply( this, arguments );
    },

    'tester:runner-end': function () {
        this._onRunnerEnd.apply( this, arguments );
    },

    'tester:runner-suite': function () {
        this._onRunnerSuite.apply( this, arguments );
    },

    'tester:runner-suite-end': function () {
        this._onRunnerSuiteEnd.apply( this, arguments );
    },

    'tester:runner-test': function () {
    },

    'tester:runner-pending': function () {
    },

    'tester:runner-pass': function () {
    },

    'tester:runner-fail': function () {
        this._onRunnerFail.apply( this, arguments );
    },

    'tester:runner-test-end': function () {
        this._onRunnerTestEnd.apply( this, arguments );
    },
});

})();
