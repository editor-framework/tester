/**
 * Module dependencies.
 */

var Ipc = require('ipc');
var Base = Mocha.reporters.Base;

function _ipcSuite ( suite ) {
    return {
        root: suite.root,
        title: suite.title,
        fullTitle: suite.fullTitle(),
    };
}

function _ipcErr ( err ) {
    if ( !err )
        return null;

    return {
        stack: err.stack || err.toString(),
        message: err.message,
        line: err.line,
        sourceURL: err.sourceURL,
    };
}

function _ipcTest ( test ) {
    return {
        title: test.title,
        fullTitle: test.fullTitle(),
        state: test.state,
        speed: test.speed,
        duration: test.duration,
        pending: test.pending,
        fn: test.fn.toString(),
        err: _ipcErr(test.err)
    };
}

function _ipcStats ( reporter, stats ) {
    return {
        passes: stats.passes,
        failures: stats.failures,
        duration: new Date() - stats.start,
        progress: stats.tests / reporter.total * 100 | 0,
    };
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
        Ipc.sendToHost('runner:fail', _ipcTest(test), _ipcErr(err));
    });

    runner.on('test end', function(test) {
        Ipc.sendToHost('runner:test-end', _ipcStats(self,stats), _ipcTest(test));
    });

    runner.on('end', function () {
        Ipc.sendToHost('runner:end');
    });
}

IpcReporter.prototype = Base.prototype;
