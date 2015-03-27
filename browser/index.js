/**
 * Module dependencies
 */

exports = module.exports = require('../lib');
exports._WS = window.WebSocket || window.MozWebSocket;
exports._cache = require('./cache');

exports.isSupported = !!exports._WS;
