/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

function ThrottledQueue(options) {
    var self = this;
    var conn = options.connection;
    var queueName = options.queueName;
    var routingKeys = options.routingKeys;
    var queueOptions = options.queueOptions;

    this.log = options.log;
    this.maxMsgCount = options.maximum || 1;
    this.callback = options.callback;
    this.msgCount = 0;

    var queue = this.queue = conn.queue(queueName, queueOptions);

    queue.on('open', function () {
        queue.subscribe({ ack: true }, function (msg, headers, deliveryInfo) {
            self.log.debug('ThrottledQueue received a message ');
            self._handleMessage(msg, headers, deliveryInfo);
        });

        // Bind all the routing keys to our queue
        var i = routingKeys.length;
        while (i--) {
            queue.bind(routingKeys[i]);
        }
    });
}


ThrottledQueue.prototype._handleMessage =
function (msg, headers, deliveryInfo) {
    this.msgCount++;
    this.shifting = false;
    this.next();
    this.callback(msg, headers, deliveryInfo);
};


ThrottledQueue.prototype.next = function () {
    if (this._shouldShift()) {
        this._shift();
    }
};


ThrottledQueue.prototype.complete = function () {
    if (this.msgCount > 0) {
        this.msgCount--;
    }
    this.next();
};


ThrottledQueue.prototype._shift = function () {
    this.log.debug('Shifting!');
    this.shifting = true;
    this.queue.shift();
};


/**
 * Stop doing new shift()'s on the queue.
 */

ThrottledQueue.prototype.stop = function () {
    this._stopShifting = true;
};


/**
 * Returns whether we should do a queue.shift() and get a new message. This
 * should only be done if we don't have the maximum number of provisions
 * happening now, if we haven't been told to shutdown and if we're not
 * already shifting.
 */

ThrottledQueue.prototype._shouldShift = function () {
    this.log.debug('Checking if we should shift ('
        + this.msgCount + '/' + this.maxMsgCount + ')');
    if (this.shifting) {
        this.log.debug('Not shifting because we\'re shifting already.');
        return false;
    } else if (this._stopShifting) {
        this.log.debug('Not shifting because we\'re shutting down.');
        return false;
    } else if (!(this.msgCount < this.maxMsgCount)) {
        this.log.debug(
            'Not shifting because we\'re at the maximum number of concurrent '
            + 'provisions (' + this.msgCount + ').');
            return false;
    } else {
        this.log.debug('It\'s okay to shift.');
        return true;
    }
};

module.exports = ThrottledQueue;
