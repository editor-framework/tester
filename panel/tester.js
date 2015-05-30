(function () {
var Url = require('fire-url');

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
    is: 'editor-tester',

    properties: {
    },

    ready: function () {
        this.reset();
    },

    'panel:open': function ( argv ) {
        if ( !argv || !argv.name ) {
            this._tests = ['packages://tester/env/empty.html'];
            this.reset();
            this.next();
            return;
        }

        this.runTests(argv.name);
    },

    'tester:run-tests': function ( pkgName ) {
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

        if ( !this._tests || this._tests.length === 0 ) {
            this._tests = ['packages://tester/env/empty.html'];
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
    },

    runTests: function ( pkgName ) {
        Editor.Package.queryInfo( pkgName, function ( result ) {
            var pkgInfo = result.info;
            var tests = pkgInfo.tests || [];
            this._tests = tests.map( function ( path ) {
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
        if ( this.$.runner ) {
            Polymer.dom(this.root).removeChild(this.$.runner);
            Polymer.dom.flush();
            this.$.runner = null;
        }

        var webview = document.createElement('webview');
        webview.setAttribute( 'id', 'runner' );
        webview.setAttribute( 'src', Editor.url(url) );
        webview.setAttribute( 'nodeintegration', '' );
        webview.setAttribute( 'disablewebsecurity', '' );
        webview.setAttribute( 'autosize', 'on' );
        webview.setAttribute( 'maxheight', '200' );
        webview.addEventListener( 'console-message', this._onRunnerConsole.bind(this) );
        webview.addEventListener( 'ipc-message', this._onRunnerIpc.bind(this) );
        this.$.runner = webview;

        Polymer.dom(this.root).insertBefore(this.$.runner, this.$.mocha);
    },

    _proxyIpc: function () {
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
            setImmediate( function () {
                this._proxyIpc.apply(this,event.args);
            }.bind(this));
            break;

        case 'runner:start':
            // runner
            el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>',
                           Url.basename(this.$.runner.src));

            // container
            Polymer.dom(this.stack[0]).appendChild(el);
            this.stack.unshift(document.createElement('ul'));
            Polymer.dom(el).appendChild(this.stack[0]);

            break;

        case 'runner:end':
            // console.log('%s runner finish', Url.basename(this.$.runner.src));
            this.stack.shift();
            this.next();
            break;

        case 'runner:suite':
            suite = event.args[0];

            if ( suite.root ) return;

            // suite
            el = _fragment('<li class="suite"><h1><a>%s</a></h1></li>', _escape(suite.title));

            // container
            Polymer.dom(this.stack[0]).appendChild(el);
            this.stack.unshift(document.createElement('ul'));
            Polymer.dom(el).appendChild(this.stack[0]);

            break;

        case 'runner:suite-end':
            suite = event.args[0];

            if ( suite.root ) return;

            this.stack.shift();

            break;

        case 'runner:test':
            break;

        case 'runner:test-end':
            stats = event.args[0];
            test = event.args[1];
            this.passes = this.lastPasses + stats.passes;
            this.failures = this.lastFailures + stats.failures;
            this.duration = this.lastDuration + stats.duration / 1000;
            this.progress = this.lastProgress + stats.progress/this._tests.length;

            // test
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
            if (this.stack[0])
                Polymer.dom(this.stack[0]).appendChild(el);

            break;

        case 'runner:pending':
            break;

        case 'runner:pass':
            break;

        case 'runner:fail':
            test = event.args[0];
            err = event.args[1];

            if ( test.type === 'hook' ) {
                el = _createFailEL(test, err);

                // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
                if (this.stack[0]) Polymer.dom(this.stack[0]).appendChild(el);
            }

            break;
        }
    },

    _toFixed: function ( number, p ) {
        return number.toFixed(p);
    },
});

})();
