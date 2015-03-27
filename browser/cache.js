/**
 * Module dependencies
 */

var lscache = require('lscache');
var Hash = require('xxhashjs')(0xABCD);
var parser = require('hyper-json-immutable-parse');

exports.get = function(host, path, headers, cb) {
  setTimeout(function() {
    var key = hash(host, path, headers);
    cb(null, deserialize(lscache.get(key)));
  }, 0);
};

exports.set = function(host, path, headers, response, cb) {
  var time = parseTime(response[1]);
  var key = hash(host, path, headers);
  if (time && response) {
    lscache.set(key, serialize(response), time);
  } else {
    lscache.remove(key);
  }
  cb && cb();
};

exports.remove = function(host, path, cb) {
  lscache.remove(hash(host, path));
  cb && cb();
};

function parseTime(headers) {
  var control = headers['cache-control'] || '';
  var parts = control.match(/max-age=([0-9]+)/);
  if (!parts) return false;
  return Math.floor(parseInt(parts[1], 10) / 60);
}

function hash(host, path, headers) {
  // TODO add vary headers
  return Hash.update(JSON.stringify([host, path])).digest().toString(36);
}

function serialize(res) {
  return '!' + JSON.stringify(res);
}

function deserialize(res) {
  if (!res) return res;
  return JSON.parse(res.slice(1), parser);
}
