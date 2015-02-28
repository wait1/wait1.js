/**
 * Module dependencies
 */

exports = module.exports = require('./lib');
exports._WS = window.WebSocket || window.MozWebSocket;
exports._cache = require('lscache');

exports.isSupported = !!exports._WS;
