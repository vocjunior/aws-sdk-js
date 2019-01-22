// Generated by CoffeeScript 1.12.3
(function() {
  var AWS, EventEmitter, helpers, httpModule;

  helpers = require('./helpers');
  var ShakyStream = require('./mocks/shaky-stream');
  AWS = helpers.AWS;

  EventEmitter = require('events').EventEmitter;

  httpModule = require('http');

  if (AWS.util.isNode()) {
    describe('AWS.NodeHttpClient', function() {
      var http;
      http = new AWS.NodeHttpClient();
      describe('maxSockets delegation', function() {
        it('delegates maxSockets from agent to globalAgent', function() {
          var agent, https;
          https = require('https');
          agent = http.sslAgent();
          https.globalAgent.maxSockets = 5;
          expect(https.globalAgent.maxSockets).to.equal(agent.maxSockets);
          https.globalAgent.maxSockets += 1;
          return expect(https.globalAgent.maxSockets).to.equal(agent.maxSockets);
        });
        it('overrides globalAgent value if global is set to Infinity', function() {
          var agent, https;
          https = require('https');
          agent = http.sslAgent();
          https.globalAgent.maxSockets = 2e308;
          return expect(agent.maxSockets).to.equal(50);
        });
        return it('overrides globalAgent value if global is set to false', function() {
          var agent, https, oldGlobal;
          https = require('https');
          oldGlobal = https.globalAgent;
          https.globalAgent = false;
          agent = http.sslAgent();
          expect(agent.maxSockets).to.equal(50);
          return https.globalAgent = oldGlobal;
        });
      });
      return describe('handleRequest', function() {
        it('emits error event', function(done) {
          var req;
          req = new AWS.HttpRequest('http://invalid');
          return http.handleRequest(req, {}, null, function(err) {
            expect(err.code).to.equal('ENOTFOUND');
            return done();
          });
        });
        it('supports timeout in httpOptions', function() {
          var numCalls, req;
          numCalls = 0;
          req = new AWS.HttpRequest('http://1.1.1.1');
          return http.handleRequest(req, {
            timeout: 1
          }, null, function(err) {
            numCalls += 1;
            expect(err.code).to.equal('TimeoutError');
            expect(err.message).to.equal('Connection timed out after 1ms');
            return expect(numCalls).to.equal(1);
          });
        });
        it('supports connectTimeout in httpOptions', function() {
          var numCalls, req;
          numCalls = 0;
          req = new AWS.HttpRequest('http://10.255.255.255');
          return http.handleRequest(req, {
            connectTimeout: 1
          }, null, function(err) {
            numCalls += 1;
            expect(err.code).to.equal('TimeoutError');
            expect(err.message).to.equal('Socket timed out without establishing a connection');
            return expect(numCalls).to.equal(1);
          });
        });
        describe('timeout', function() {
          it('is obeyed even after response headers are recieved', function(done) {
            // a mock server with 'ShakyStream' allows us to simulate a period of socket inactivity
            var server = httpModule.createServer(function(req, res) {
              res.setHeader('Content-Type', 'application/json');
              var ss = new ShakyStream({
                pauseFor: 1000 // simulate 1 second pause while receiving data
              });
              ss.pipe(res);
            }).listen(3334);
            var ddb = new AWS.DynamoDB({
              httpOptions: {
                timeout: 100
              },
              endpoint: 'http://127.0.0.1:3334'
            });
            ddb.scan({
              TableName: 'fake'
            }, function(err, data) {
              server.close();
              expect(err.name).to.equal('TimeoutError');
              done();
            });
          });

          it('does not trigger unnecessarily', function(done) {
            // a mock server with 'ShakyStream' allows us to simulate a period of socket inactivity
            var server = httpModule.createServer(function(req, res) {
              res.setHeader('Content-Type', 'application/json');
              var ss = new ShakyStream({
                pauseFor: 100 // simulate 100 ms pause while receiving data
              });
              ss.pipe(res);
            }).listen(3334);
            var ddb = new AWS.DynamoDB({
              httpOptions: {
                timeout: 1000
              },
              endpoint: 'http://127.0.0.1:3334'
            });
            ddb.scan({
              TableName: 'fake'
            }, function(err, data) {
              server.close();
              expect(err).to.eql(null);
              done();
            });
          });
        });

        return describe('connectTimeout', function() {
          var clearTimeoutSpy, mockClientRequest, oldClearTimeout, oldRequest, oldSetTimeout, requestSpy, setTimeoutSpy, timeoutId;
          timeoutId = 'TIMEOUT_ID';
          oldSetTimeout = global.setTimeout;
          oldClearTimeout = global.clearTimeout;
          setTimeoutSpy = null;
          clearTimeoutSpy = null;
          oldRequest = httpModule.request;
          requestSpy = null;
          mockClientRequest = null;
          beforeEach(function() {
            setTimeoutSpy = helpers.spyOn(global, 'setTimeout').andReturn(timeoutId);
            clearTimeoutSpy = helpers.spyOn(global, 'clearTimeout').andCallFake(function() {
              return {};
            });
            mockClientRequest = new EventEmitter();
            mockClientRequest.setTimeout = function() {
              return {};
            };
            mockClientRequest.end = function() {
              return {};
            };
            return requestSpy = helpers.spyOn(httpModule, 'request').andReturn(mockClientRequest);
          });
          afterEach(function() {
            global.setTimeout = oldSetTimeout;
            global.clearTimeout = oldClearTimeout;
            return httpModule.request = oldRequest;
          });

          it('clears timeouts once the connection has been established', function() {
            var mockSocket, req;
            req = new AWS.HttpRequest('http://10.255.255.255');
            http.handleRequest(req, {
              connectTimeout: 120000
            }, null, function() {
              return {};
            });
            mockSocket = new EventEmitter();
            mockSocket.connecting = true;
            mockClientRequest.emit('socket', mockSocket);
            expect(setTimeoutSpy.calls.length).to.equal(1);
            mockSocket.emit('connect');
            expect(clearTimeoutSpy.calls.length).to.equal(1);
            expect(clearTimeoutSpy.calls[0]['arguments'][0]).to.equal(timeoutId);
          });

          it('clears timeouts if an error is encountered', function() {
            var mockSocket = new EventEmitter();
            var req = new AWS.HttpRequest('http://10.255.255.255');

            http.handleRequest(req, {
              connectTimeout: 120000
            }, null, function() {
              return {};
            });

            mockSocket.connecting = true;
            mockClientRequest.emit('socket', mockSocket);
            expect(setTimeoutSpy.calls.length).to.equal(1);
            mockClientRequest.emit('error', new Error('Something happened!'));
            expect(clearTimeoutSpy.calls.length).to.equal(1);
            expect(clearTimeoutSpy.calls[0]['arguments'][0]).to.equal(timeoutId);
          });
        });
      });
    });
  }

}).call(this);
