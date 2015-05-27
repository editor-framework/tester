(function () {

Editor.registerPanel( 'tester.panel', {
    is: 'editor-tester',

    properties: {
    },

    ready: function () {
        this.startRunner();
    },

    startRunner: function () {
        this.passes = 0;
        this.failures = 0;
        this.duration = 0;
        this.progress = 0;

        this.suites = [];

        this._curSuite = null;
        this._curSuiteIdx = -1;
    },

    _onRunnerConsole: function ( event ) {
        console.log('Runner Console: ', event.message);
    },

    _onRunnerIpc: function ( event ) {
        var stats, suite, test, err;

        switch ( event.channel ) {
        case 'runner:start':
            console.log('runner start');
            break;

        case 'runner:suite':
            stats = event.args[0];
            suite = event.args[1];

            if ( suite.root ) return;

            this._curSuite = {
                title: suite.title,
                tests: [],
            };
            this._curSuiteIdx = this.suites.length;
            this.push('suites', this._curSuite);

            break;

        case 'runner:suite-end':
            stats = event.args[0];
            suite = event.args[1];

            if ( suite.root ) return;

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

            this.push('suites.' + this._curSuiteIdx + '.tests', {
                title: test.title,
                speed: test.speed,
                duration: test.duration,
            });

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
