/**
 * Module dependencies
 */

var Stream = require('stream');
var Connection = require('./connection');
var Response = require('./response');
var inherits = require('util').inherits;

module.exports = Request;

function Request(params, WS, cache) {
  var self = this;
  self.writable = true;
  self.method = params.method || 'GET';
  self.path = params.path || '/';
  self._headers = {};
  self.body = [];
  self.socket = new Connection(params, WS);
}
inherits(Request, Stream);

Request.prototype.setHeader = function (key, value) {
  this._headers[key.toLowerCase()] = value;
};

Request.prototype.getHeader = function (key) {
  return this._headers[key.toLowerCase()];
};

Request.prototype.removeHeader = function (key) {
  delete this._headers[key.toLowerCase()];
};

Request.prototype.write = function (s) {
  this.body.push(s);
};

Request.prototype.destroy = function (s) {
  // TODO
  this.emit('close');
};

Request.prototype.end = function(s) {
  var self = this;
  if (typeof s !== 'undefined') self.body.push(s);

  var req = self.socket.send(self.method, self.path, self._headers, mergeBody(self.body));
  var res = new Response(req);
  res.on('close', function() {self.emit('close');});
  res.on('ready', function() {self.emit('response', res);});
  res.on('error', function() {self.emit('error');});
};

function mergeBody(body) {
  if (body.length === 0) return null;
  if (body.length === 1) return body[0];
  var obj = {};
  for (var i = 0; i < body.length; i++) {
    for (var k in body[i]) {
      if (body[i].hasOwnProperty()) obj[k] = body[i][k];
    }
  }
  return obj;
}
