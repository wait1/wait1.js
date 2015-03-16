/**
 * Module dependencies
 */

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var parser = require('hyper-json-immutable-parse');

var hosts = {};

exports = module.exports = new EventEmitter();

exports.open = function(params, WS) {
  var uri = (params.protocol || 'ws:').replace('http', 'ws') + '//' +
    params.host +
    (params.port ? ':' + params.port : '') +
    (params.wspath || '/');

  return hosts[uri] || new Connection(uri, WS);
};

function Connection(uri, WS) {
  var self = this;
  var ws = self.ws = new WS(uri/*, 'wait1'*/);
  self._id = 0;
  self._pending = [];

  // methods
  self.close = ws.close.bind(ws);

  // events
  ws.onopen = self.emit.bind(self, 'open');
  ws.onclose = self.emit.bind(self, 'close');
  ws.onmessage = self._onmessage.bind(self);
  ws.onerror = self.emit.bind(self, 'error');

  self.on('close', function() {
    delete hosts[uri];
  });
  self.on('open', function() {
    if (self._pending.length) {
      ws.send(JSON.stringify(self._pending));
      self._pending = [];
    }
  });
  self.on('error', function(err) {
    console.log('ERROR', err);
  });
  hosts[uri] = self;
}
inherits(Connection, EventEmitter);

Connection.prototype._onmessage = function(evt) {
  var msg = JSON.parse(evt.data, parser);
  if (!Array.isArray(msg)) msg = [msg];
  for (var i = 0, res; i < msg.length; i++) {
    res = msg[i];
    if (res[0] === -1) exports.emit('push', res[1], res[2], res[3]);
    else this.emit('RESPONSE_' + res[0], res[1], res[2], res[3]);
  }
};

Connection.prototype.send = function(method, path, headers, body, timeout) {
  var self = this;
  var id = self._id++;
  path = path.split('/');
  path.shift();
  if (!path[0]) path.shift();

  if (body) headers['content-type'] = 'application/json';

  var req = body ? [id, method, path, headers, body] : [id, method, path, headers];

  var res = this.thunk(id, timeout, method);

  // TODO buffer requests for bulked goodness
  var ws = self.ws;
  if (ws.readyState === 1) ws.send(JSON.stringify([req]));
  else self._pending.push(req);

  return res;
};

Connection.prototype.thunk = function(id, timeout, method) {
  var res = new EventEmitter();

  res.id = id;

  var t = setTimeout(function() {
    if (res._done) return;
    res.emit('timeout');
    res._done = true;
  }, timeout || 10000);

  if (~['POST', 'PUT', 'DELETE'].indexOf(method)) this.once('RESPONSE_' + id, function(status, headers, body) {
    exports.emit('push', status, headers, body);
  });

  this.once('RESPONSE_' + id, function(status, headers, body) {
    if (res._done) return;
    res.emit('response', status, headers, body);
    res._done = true;
    clearTimeout(t);
  });

  return res;
};
