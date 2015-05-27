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

    runner.on('start', function(){
        Ipc.sendToHost('runner:start');
    });

    runner.on('pending', function(test){
        Ipc.sendToHost('runner:pending', test);
    });

    runner.on('pass', function(test){
        Ipc.sendToHost('runner:pass', test);
    });

    runner.on('fail', function(test, err){
        Ipc.sendToHost('runner:fail', test);
    });

    runner.on('end', function(){
        Ipc.sendToHost('runner:finish');
        self.epilogue();
    });
}
