/**
 * Module dependencies
 */

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var parser = require('hyper-json-immutable-parse');

var hosts = {};

exports = module.exports = new EventEmitter();

exports.open = function(params, WS) {
  var uri = (params.protocol || 'ws:').replace(/^http/, 'ws') + '//' +
    params.host +
    (params.port ? ':' + params.port : '') +
    (params.wspath || '/?wait1');

  var auth = params.auth || '';

  return hosts[auth + '@' + uri] || new Connection(uri, WS, auth);
};

function Connection(uri, WS, auth) {
  var self = this;
  var ws = self.ws = new WS(uri, ['wait1'].concat(parseAuth(auth)));
  self._id = 0;
  self._pending = [];
  self._buffered = [];

  // methods
  self.close = ws.close.bind(ws);

  // events
  ws.onopen = self.emit.bind(self, 'open');
  ws.onclose = self.emit.bind(self, 'close');
  ws.onmessage = self._onmessage.bind(self);
  ws.onerror = self.emit.bind(self, 'error');

  self.on('close', function() {
    delete hosts[auth + '@' + uri];
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
  hosts[auth + '@' + uri] = self;
}
inherits(Connection, EventEmitter);

Connection.prototype._onmessage = function(evt) {
  var msg = JSON.parse(evt.data, parser);
  for (var i = 0, res; i < msg.length; i++) {
    res = msg[i];
    if (res[0] === -1) exports.emit('push', res[1], res[2], res[3]);
    else this.emit('RESPONSE_' + res[0], res[1], res[2], res[3]);
  }
};

Connection.prototype.set = function(headers) {
  var self = this;
  var id = self._id++;
  self.buffer([id, "SET", headers]);
  return self;
};

Connection.prototype.send = function(method, path, headers, query, body, timeout) {
  var self = this;
  var id = self._id++;
  path = path.split('/');
  path.shift();
  if (!path[0]) path.shift();

  if (body) headers['content-type'] = 'application/json';

  var req = body ? [id, method, path, headers, query, body] : [id, method, path, headers, query];

  var res = this.thunk(id, timeout, method);

  self.buffer(req);

  return res;
};

Connection.prototype.buffer = function(req) {
  var self = this;
  var buffer = self._buffered;
  buffer.push(req);
  if (self._bufferTimeout) return;
  self._bufferTimeout = setTimeout(function() {
    var ws = self.ws;
    if (ws.readyState === 1) ws.send(JSON.stringify(self._buffered));
    else self._pending = self._pending.concat(self._buffered);

    self._buffered = [];
    delete self._bufferTimeout;
  }, 5);
};

Connection.prototype.thunk = function(id, timeout, method) {
  var res = new EventEmitter();

  res.id = id;

  var t = setTimeout(function() {
    if (res._done) return;
    res.emit('timeout');
    res._done = true;
  }, timeout || 60000);

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

/**
 * Parse an auth string
 */

function parseAuth(auth) {
  var parts = auth.split(':');
  if (parts[0] && !parts[1]) return ['wait1|t' + parts[0]];
  if (!parts[0] && parts[1]) return ['wait1|t' + parts[1]];
  if (!parts[0] && !parts[1]) return [];
  return ['wait1|b' + (new Buffer(auth)).toString('base64')];
}
