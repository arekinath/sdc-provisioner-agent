var Task = require('task_agent/lib/task');
var VM = require('/usr/vm/node_modules/VM');
var execFile = require('child_process').execFile;
var common = require('../common');
var async = require('async');

var MachineDestroyTask = module.exports = function (req) {
    Task.call(this);
    this.req = req;
};

Task.createTask(MachineDestroyTask);

function start() {
    var self = this;
    var uuid = self.req.params.uuid;

    VM.logger = common.makeVmadmLogger(self);

    common.ensureCreationComplete(self.req.uuid, function () {
        /*JSSTYLED*/
        VM.delete(uuid, function (error) {
            if (error) {
                var msg = error instanceof Error ? error.message : error;
                self.fatal('VM.delete error: ' + msg);
                return;
            }
            self.progress(100);
            self.finish();
        });
    });
}

MachineDestroyTask.setStart(start);