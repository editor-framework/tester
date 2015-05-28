(function () {

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

//
Editor.registerPanel( 'tester.panel', {
    is: 'editor-tester',

    properties: {
    },

    ready: function () {
        this.reset();
    },

    'panel:out-of-date': function ( panelID ) {
        this.reset();
        this.$.runner.reload();
    },

    reset: function () {
        this.passes = 0;
        this.failures = 0;
        this.duration = 0;
        this.progress = 0;

        var mochaReportEL = this.$['mocha-report'];
        while ( mochaReportEL.children.length ) {
            mochaReportEL.firstChild.remove();
        }
        this.stack = [mochaReportEL];
    },

    _onRunnerConsole: function ( event ) {
        console.log('Runner Console: ', event.message);
    },

    _onRunnerIpc: function ( event ) {
        var stats, suite, test, err, el;

        switch ( event.channel ) {
        case 'runner:start':
            console.log('runner start');
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
            this.passes = stats.passes;
            this.failures = stats.failures;
            this.duration = (stats.duration / 1000).toFixed(2);
            this.progress = stats.progress;

            // test
            if ('passed' == test.state) {
                el = _fragment('<li class="test pass %e"><h2>%e<span class="duration">%ems</span></h2></li>', test.speed, test.title, test.duration);
            } else if (test.pending) {
                el = _fragment('<li class="test pass pending"><h2>%e</h2></li>', test.title);
            } else {
                el = _fragment('<li class="test fail"><h2>%e</h2></li>', test.title, _makeUrl(test.fullTitle));
                var str = test.err.stack;

                // FF / Opera do not add the message
                if (!~str.indexOf(test.err.message)) {
                    str = test.err.message + '\n' + str;
                }

                // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
                // check for the result of the stringifying.
                if ('[object Error]' == str) str = test.err.message;

                Polymer.dom(el).appendChild(_fragment('<pre class="error">%e</pre>', str));
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
            if (this.stack[0]) Polymer.dom(this.stack[0]).appendChild(el);

            break;

        case 'runner:pending':
            break;

        case 'runner:pass':
            break;

        case 'runner:fail':
            break;

        case 'runner:end':
            console.log('runner finish');
            break;
        }
    },
});

})();
