/**
 * Module dependencies.
 */

var Ipc = require('ipc');
var Mocha = require('mocha');

var Base = Mocha.reporters.Base;

function _ipcSuite ( suite ) {
    return {
        root: suite.root,
        title: suite.title,
        fullTitle: suite.fullTitle(),
    };
}

function _ipcTest ( test ) {
    var ipcTest = {
        title: test.title,
        fullTitle: test.fullTitle(),
        state: test.state,
        speed: test.speed,
        duration: test.duration,
        pending: test.pending,
        fn: test.fn.toString(),
    };

    if ( test.err ) {
        ipcTest.err = {
            stack: test.err.stack || test.err.toString(),
            message: test.err.message,
            line: test.err.line,
            sourceURL: test.err.sourceURL,
        };
    }

    return ipcTest;
}

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

    var self = this, stats = this.stats;

    runner.on('start', function () {
        Ipc.sendToHost('runner:start');
    });

    runner.on('suite', function(suite){
        Ipc.sendToHost('runner:suite', _ipcSuite(suite));
    });

    runner.on('suite end', function (suite) {
        Ipc.sendToHost('runner:suite-end', _ipcSuite(suite));
    });

    runner.on('test', function(test) {
        Ipc.sendToHost('runner:test', _ipcTest(test));
    });

    runner.on('pending', function (test) {
        Ipc.sendToHost('runner:pending', _ipcTest(test));
    });

    runner.on('pass', function (test) {
        Ipc.sendToHost('runner:pass', _ipcTest(test));
    });

    runner.on('fail', function (test, err) {
        Ipc.sendToHost('runner:fail', _ipcTest(test), err);
    });

    runner.on('test end', function(test) {
        stats.duration = new Date() - stats.start;
        stats.progress = stats.tests / this.total * 100 | 0;
        Ipc.sendToHost('runner:test-end', stats, _ipcTest(test));
    });

    runner.on('end', function () {
        Ipc.sendToHost('runner:end');
        self.epilogue();
    });
}
