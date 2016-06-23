'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = unstoreAllFiles;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

var _chunk = require('lodash/chunk');

var _chunk2 = _interopRequireDefault(_chunk);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-console, no-unused-vars */


var projectFiles = [];

function headers(publicKey, privateKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Uploadcare.Simple ' + publicKey + ':' + privateKey
  };
}

function unstoreProjectFiles(files, publicKey, privateKey, statsFilePath) {
  var uuidsToUnstore = (0, _chunk2.default)(files.map(function (f) {
    return f.uuid;
  }), 100);

  uuidsToUnstore.map(function (uuidsToUnstoreChunk) {
    _request2.default.del({
      url: 'https://api.uploadcare.com/files/storage/',
      headers: headers(publicKey, privateKey),
      body: JSON.stringify(uuidsToUnstoreChunk)
    }, function (err, resp, body) {});
  });

  var filesList = {};

  files.map(function (f) {
    return filesList[f.hash] = f;
  });

  var content = JSON.stringify(filesList, null, 2);

  _fs2.default.writeFileSync(statsFilePath, content);
}

function iterateThroughPage(url, publicKey, privateKey, statsFilePath) {
  _request2.default.get({
    url: url,
    headers: headers(publicKey, privateKey)
  }, function (err, res, body) {
    var _JSON$parse = JSON.parse(body);

    var results = _JSON$parse.results;
    var next = _JSON$parse.next;


    results.map(function (file) {
      projectFiles.push({
        uuid: file.uuid,
        hash: file.original_filename
      });
    });

    if (next) {
      console.log('next');
      iterateThroughPage(next, publicKey, privateKey, statsFilePath);
    } else {
      console.log('done');
      unstoreProjectFiles(projectFiles, publicKey, privateKey, statsFilePath);
    }
  });
}

function unstoreAllFiles(publicKey, privateKey, statsFilePath) {
  var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  if (!publicKey.length || !privateKey.length) {
    console.log('no private/pubic key were provided, skipping deleting files');
    return;
  }

  var _options$deleteFile = options.deleteFile;
  var deleteFile = _options$deleteFile === undefined ? false : _options$deleteFile;
  var _options$limit = options.limit;
  var limit = _options$limit === undefined ? 100 : _options$limit;


  var url = 'https://api.uploadcare.com/files/?removed=false&stored=true&limit=' + limit;

  iterateThroughPage(url, publicKey, privateKey, statsFilePath);
}
module.exports = exports['default'];