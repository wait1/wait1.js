/**
 * Module dependencies
 */

var Stream = require('stream');
var inherits = require('util').inherits;

module.exports = Response;

function Response(req) {
  var self = this;
  self.offset = 0;
  self.readable = true;
  req.on('response', self._handle.bind(self));
  //req.on('error', self._error.bind(self));
}
inherits(Response, Stream);

Response.prototype.getHeader = function (key) {
  return this.headers[key.toLowerCase()];
};

Response.prototype._handle = function(status, headers, body) {
  var self = this;
  self.statusCode = status;
  self.headers = headers;
  self.body = body;
  self.emit('ready');
  if (body) self.emit('data', body);
  self.emit('end');
  self.emit('close');
};
