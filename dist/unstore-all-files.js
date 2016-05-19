'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unstoreAllFiles;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-console, no-unused-vars */


function iterateThroughPage(url, publicKey, privateKey, deleteNotUnstore) {
  var headers = {
    Authorization: 'Uploadcare.Simple ' + publicKey + ':' + privateKey
  };

  _request2.default.get({
    url: url,
    headers: headers
  }, function (err, res, body) {
    try {
      var _JSON$parse = JSON.parse(body);

      var results = _JSON$parse.results;
      var next = _JSON$parse.next;


      results.map(function (file) {
        var fileUnstoreUrl = 'https://api.uploadcare.com/files/' + file.uuid + '/' + (deleteNotUnstore ? '' : 'storage/');
        _request2.default.del({
          url: 'https://api.uploadcare.com/files/' + file.uuid + '/',
          headers: headers
        }, function (delErr) {
          if (delErr) {
            console.log(('ERROR deleting ' + file.uuid.underline + ': ' + JSON.stringify(delErr)).red);
          } else {
            console.log((file.uuid.underline + ' were ' + (deleteNotUnstore ? 'deleted' : 'unstored')).green);
          }
        });
      });

      if (next) {
        console.log('Goingin to next page'.underline.green);

        iterateThroughPage(next, publicKey, privateKey, deleteNotUnstore);
      }
    } catch (e) {
      console.log('Error deleting:'.red, e.stack);
    }
  });
}

function unstoreAllFiles() {
  var publicKey = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
  var privateKey = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  if (!publicKey.length || !privateKey.length) {
    console.log('no private/pubic key were provided, skipping deleting files');
    return;
  }

  var _options$deleteNotUns = options.deleteNotUnstore;
  var deleteNotUnstore = _options$deleteNotUns === undefined ? true : _options$deleteNotUns;
  var _options$limit = options.limit;
  var limit = _options$limit === undefined ? 100 : _options$limit;


  var url = 'https://api.uploadcare.com/files/?stored=true&limit=' + limit;

  iterateThroughPage(url, publicKey, privateKey, deleteNotUnstore);
}
module.exports = exports['default'];