/**
 * Module dependencies.
 */

var Ipc = require('ipc');
var Base = Mocha.reporters.Base;

/**
 * Expose `IpcReporter`.
 */

exports = module.exports = IpcReporter;

/**
 * Initialize a new `IpcReporter` matrix test reporter.
 *
 * @param {Runner} runner
 * @api public
 */

function IpcReporter(runner) {
    Base.call(this, runner);

    var self = this, stats = this.stats, n = -1;

    runner.on('start', function () {
        Ipc.sendToHost('runner:start');
    });

    runner.on('suite', function(suite){
        // if (suite.root) return;

        // // suite
        // var url = self.suiteURL(suite);
        // var el = fragment('<li class="suite"><h1><a href="%s">%s</a></h1></li>', url, escape(suite.title));

        // // container
        // stack[0].appendChild(el);
        // stack.unshift(document.createElement('ul'));
        // el.appendChild(stack[0]);

        Ipc.sendToHost('runner:suite', stats, suite);
    });

    runner.on('suite end', function (suite) {
        // if (suite.root) return;
        // stack.shift();
        Ipc.sendToHost('runner:suite-end', stats, suite);
    });

    runner.on('test', function(test) {
        Ipc.sendToHost('runner:test', stats, test);
    });

    runner.on('pending', function (test) {
        Ipc.sendToHost('runner:pending', test);
    });

    runner.on('pass', function (test) {
        Ipc.sendToHost('runner:pass', test);
    });

    runner.on('fail', function (test, err) {
        Ipc.sendToHost('runner:fail', test, err);
    });

    runner.on('test end', function(test) {
        stats.duration = new Date() - stats.start;
        stats.progress = stats.tests / this.total * 100 | 0;
        Ipc.sendToHost('runner:test-end', stats, test);
    });

    runner.on('end', function () {
        Ipc.sendToHost('runner:end');
        self.epilogue();
    });
}
