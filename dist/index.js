'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (source) {
  var loaderCallback = this.async();

  // sync version. whatever.
  // acording to docs it's a super-safe fallback, will never be used.
  if (!loaderCallback) return source;

  // should be cacheable
  // as far as i know this is actually will prevent even cache check if hash does not changed.
  this.cacheable();

  var options = _extends({}, DEFAULT_OPTIONS, _loaderUtils2.default.parseQuery(this.query), _loaderUtils2.default.parseQuery(this.resourceQuery));

  getUploadcareUUID((0, _main2.default)(options.publicKey, options.privateKey), options.statsFilePath, this.resourcePath, relativePath(this.resourcePath, options.resourcePathDivider), _loaderUtils2.default.getHashDigest(source, 'sha1', 'hex', 36), function (err, uuid) {
    if (err) {
      return loaderCallback(err);
    }

    if (loaderCallback) {
      return loaderCallback(null, 'module.exports = "https://' + options.uploadcareCDN + '/' + uuid + options.operations + '"');
    }
  });
};

var _main = require('uploadcare/lib/main');

var _main2 = _interopRequireDefault(_main);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  resourcePathDivider: 'app',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/'
};

// problem: resourcePath is absolute:
// /Users/romanonthego/Code/whitescape2015/app/images/background/wide_desk.jpg
// which will result in cache miss in different env
// so we need to make path relative again
// it's messy but works
// ---
// /Users/romanonthego/Code/whitescape2015/app/images/background/wide_desk.jpg
// ->
// app/images/background/wide_desk.jpg
// ---
function relativePath(resourcePath, resourcePathDivider) {
  var pathSplited = resourcePath.split('/');
  var dividerIndex = pathSplited.indexOf(resourcePathDivider);

  return pathSplited.splice(dividerIndex).join('/');
}

function _readStats(statsFilePath) {
  var content = undefined;

  try {
    content = _fs2.default.readFileSync(statsFilePath);
  } catch (e) {
    // this is probably because the stats file wasn't created yet,
    // so we return the same result as if the file was empty.
    return {};
  }
  return JSON.parse(content);
}

function readStats(statsFilePath, key) {
  var json = _readStats(statsFilePath);
  return json[key];
}

function updateStats(statsFilePath, key, info) {
  var json = _readStats(statsFilePath);
  json[key] = info;

  var content = JSON.stringify(json, null, 2);

  _fs2.default.writeFileSync(statsFilePath, content);
}

function getUploadcareUUID(uploadcare, statsFilePath, filePath, fileKey, fileHash, cb) {
  var info = readStats(statsFilePath, fileKey);

  if (info && info.hash === fileHash) {
    cb(null, info.uuid);
    return;
  }

  uploadcare.file.upload(_fs2.default.createReadStream(filePath), function (err, res) {
    if (err) {
      cb(err);
      return;
    }
    try {
      updateStats(statsFilePath, fileKey, { hash: fileHash, uuid: res.file });
    } catch (e) {
      cb(e);
      return;
    }
    cb(null, res.file);
  });
}
