execFile = require('child_process').execFile;
inspect = require('sys').inspect;

// The agent will emit events as it progresses through the zone creation
// process.
var eventRE = /^provisioner\.event\.([^\.]+).([^\.]+).([^\.]+)/;

exports.provisionZone = function (agent, data, callback) {
  var successCount = 0;

  function eventReceived(msg) {
    console.log("Event --> " + inspect(msg));

    var zone_event = eventRE.exec(msg._routingKey);

    var authorizedKeysPath = path.join(
      "/zones/"
      , zone_event[3]
      , '/root/home/node/.ssh/authorized_keys'
    );

    if (zone_event[1] == "zone_created") {
      zonesCreated.push(zone_event[3]);
    }

    if (zone_event[1] == 'error') {
      return callback(new Error(msg.data));
    }

    if (zone_event[1] == "zone_ready") {
      console.log("Zone was ready in " + (Date.now() - times[zone_event[3]]) + "ms");

      fs.readFile(authorizedKeysPath, 'utf8', function (error, str) {
        assert.ok(!error, "Error reading authorized_keys file: "+error);
        assert.ok(str.indexOf(data.authorized_keys) !== -1
        , "We should have found our key in the authorized keys file");
      });

      execFile('/usr/sbin/zoneadm'
        , ['list', '-p']
        , function (error, stdout, stderr) {
          if (error) throw error;

          var lines = stdout.split("\n");
          assert.ok(
            lines.some(function (line) {
              var parts = line.split(':');
              return parts[1] === data.zonename
              && parts[2] === 'running';
            })
            , "our zone should be in the list");

          console.log("Everyone was ok!");
          q.destroy();
          callback(undefined);
        });
    }
  }

  var times = {};
  var zonesCreated = [];


  var q;

  function queueCreated() {
    // provisioner.event.zone_created.sagan.orlandozone0
    var routing = 'provisioner.event.*.' + agent.hostname + '.*.*';
    console.log("Routing was %s", routing);

    q.bind(routing);
    q.subscribeJSON(eventReceived);

    var msg = { data: data };
    times[msg.data.zonename] = Date.now();
    agent.sendCommand('provision', msg,
      function (reply) {
        if (reply.error) {
          console.log("ERROR: " + inspect(reply));
          callback(new Error("Error: " + inspect(reply)));
          return;
        }
      });
  }

  q = agent.connection.queue(data.zonename + '_provision_events'+Math.random(), queueCreated);
};

exports.teardownZone = function (agent, data, callback) {
  var q;

  function eventReceived(msg) {
    console.log("EVENT -->");
    var zone_event = eventRE.exec(msg._routingKey);

    if (zone_event[1] == "zone_destroyed") {
      q.destroy();
      callback(undefined);
    }
  };

  function queueCreated() {
    // provisioner.event.zone_created.sagan.orlandozone0
    var routing = 'provisioner.event.zone_destroyed.' + agent.hostname + '.*.*';
    console.log("Routing was %s", routing);

    q.bind(routing);
    q.subscribeJSON(eventReceived);

    var msg = { data: data };
    agent.sendCommand
      ( 'teardown'
      , msg
      , function (reply) {
          assert.equal(reply.error
            , undefined,
              "Error should be unset, but was '"
              + inspect(reply.error) + "'.");
          console.log("Zone destruction initiated");
        }
      );
  }

  q = agent.connection.queue(data.zonename + '_teardown_events', queueCreated);
}

// exports.teardownZone = function (agent, data, callback) { 
// 
// };

var zoneadmListFields = ['zoneid', 'zonename', 'state', 'zonepath', 'uuid', 'brand', 'ip-type'];
var zoneadmListFieldCount = zoneadmListFields.length;

exports.zoneadmList = function (callback) {
  function onZoneadmList(error, stdout, stderr) {
    if (error) return callback(error);
    console.log("Listed -->" + stdout);

    var zones = {};
    var lines = stdout.split("\n");
    var i = lines.length;
    var parts;

    while (i--) {
      if (!lines[i]) continue;
      parts = lines[i].split(':');

      var j = zoneadmListFieldCount
      var zonename = parts[1];
      zones[zonename] = {};
      while (j--) {
        var field = zoneadmListFields[j];
        zones[zonename][field] = parts[j];
      }
    }
    callback(undefined, zones);
  }

  execFile('/usr/sbin/zoneadm', ['list', '-pi'], onZoneadmList);
};

exports.zoneBootTime = function (zonename, callback) {
  execFile
    ( '/usr/sbin/zlogin'
    , [zonename, '/usr/bin/kstat', '-p', 'unix:0:system_misc:boot_time']
    , function (error, stdout, stderr) {
        if (error) throw stderr.toString();;
        var kv = stdout.toString().split(/\s+/);
        console.log(sys.inspect(kv));
        callback(undefined, kv[1]);
      });
}

exports.prctl = function (zonename, resourceControlName, callback) {
  execFile
    ( "/usr/bin/prctl"
    , [ '-P', '-t', 'privileged'
      , '-n', resourceControlName
      , '-i', 'zone', zonename
      ]
    , function (error, stdout, stderr) { 
        var parts = stdout.split("\n");
        var zone = parts[1].split(/\s+/);
        callback(null, zone);
      }
    );
}

exports.zfsProperties = function (propertyNames, datasets, callback) {
  var fields = ['name','property','value'];
  var args = ['get', '-H', '-o', fields.join(','),
              propertyNames.join(',')];

  // extend the args array with the passed in datasets
  args.splice.apply(
    args,
    [args.length, datasets.length].concat(datasets));

  execFile(
    '/usr/sbin/zfs',
    args,
    function (error, stdout, stderr) {
      if (error) return callback(error);
      callback(null, parseZFSUsage(fields, stdout));
    });
}

function parseZFSUsage (fields, data) {
  var results = {};
  var fieldsLength = fields.length;
  var lines = data.trim().split("\n");
  var i = lines.length;
  while (i--) {
    var line = lines[i].split(/\s+/);
    if (!results[line[0]]) results[line[0]] = {};
    results[line[0]][line[1]] = line[2];
  }

  return results;
}
