require.paths.push(__dirname + '/..');
require.paths.push(__dirname + '/../lib');

sys = require('sys');
exec = require('child_process').exec;
zfs = require('zfs').zfs;
fs = require('fs');
path = require('path');

puts = sys.puts;
inspect = sys.inspect;

ProvisionerAgent = require('provisioner').ProvisionerAgent;
ProvisionerClient = require('amqp_agent/client').Client;

TestSuite = require('async-testing/async_testing').TestSuite;

var suite = exports.suite = new TestSuite("Provisioner Agent Tests");
var hostname;

var tests = [
  { 'Test sending an incomplete provision command':
    function (assert, finished) {
      var msg = {};
      msg.data = {
        'zonename': 'orlandozone'
       , 'public_ip': 'mypublicip'
       , 'new_ip': 'mypublicip'
       , 'hostname': 'zonename'
       , 'private_ip': 'myprivateip'
       , 'zone_template': 'nodejs'
       , 'public_interface_name': 'publicif'
       , 'private_interface_name': 'privateif'
       , 'root_pw': 'therootpw'
       , 'admin_pw': 'theadminpw'
       , 'vs_pw': 'theadminpw'
       , 'private_gateway': 'thegateway'
       , 'private_netmask': 'thenetmask'
       , 'cpu_shares': 4
       , 'lightweight_processes': 4000
       , 'cpu_cap': 4
       , 'swap_in_bytes': 1000000
       , 'ram_in_bytes': 200*1024*1024
       , 'disk_in_gigabytes': 1
       , 'tmpfs': 200*1024*1024
       , 'template_version': '3.0.0'
       };

      this.agent.sendCommand('provision', msg,
        function (reply) {
          assert.equal(reply.error, undefined,
            "Error should be unset, was '" + inspect(reply.error) + "'");
          finished();
        });
    }
  }
];

// order matters in our tests
for (i in tests) {
  suite.addTests(tests[i]);
}

var client;
var agent;

function startAgent(callback) {
  var config = {
    hostname: 'sagan'
  };
  agent = new ProvisionerAgent(config);
  agent.connect(function () {
    puts("Ready to rock.");
    callback && callback();
  });
}

suite.setup(function(finished, test) {
  var self = this;
  if (client) {
    self.agent = client.getAgentHandle(hostname, 'provisioner');
    finished();
  }
  else {
    exec('hostname', function (err, stdout, stderr) {
      hostname = stdout.trim();
      var dot = hostname.indexOf('.');
      if (dot !== -1) hostname = hostname.slice(0, dot);

      startAgent(function () {
        config = { reconnect: false };
        client = new ProvisionerClient(config);
        client.connect(function () {
          self.agent = client.getAgentHandle(hostname, 'provisioner');
          finished();
        });
      });
    });
  }
})

var currentTest = 0;
var testCount = tests.length;

suite.teardown(function() {
  if (++currentTest == testCount) {
    process.nextTick(function () {
      agent.end();
      client.end();
    });
  }
});

if (module == require.main) {
  suite.runTests();
}
