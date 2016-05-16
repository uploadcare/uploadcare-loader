'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* eslint-disable no-console, no-unused-vars */

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

  // building options with defaults and overrides
  var options = _extends({}, DEFAULT_OPTIONS, _loaderUtils2.default.parseQuery(this.query), _loaderUtils2.default.parseQuery(this.resourceQuery));

  var publicKey = options.publicKey;
  var privateKey = options.privateKey;
  var statsFilePath = options.statsFilePath;
  var uploadcareCDN = options.uploadcareCDN;
  var operations = options.operations;
  var storeOnUpload = options.storeOnUpload;
  var pathAbsolutePart = options.pathAbsolutePart;

  var callback = function callback(err, uuid) {
    if (err) {
      return loaderCallback(err);
    }

    if (loaderCallback) {
      return loaderCallback(null, 'module.exports = "https://' + uploadcareCDN + '/' + uuid + operations + '"');
    }
  };

  getUploadcareUUID({
    publicKey: publicKey,
    privateKey: privateKey,
    storeOnUpload: storeOnUpload,
    statsFilePath: statsFilePath,
    filePath: relativePath(this.resourcePath, pathAbsolutePart),
    fileHash: _loaderUtils2.default.getHashDigest(source, 'sha1', 'hex', 36),
    callback: callback
  });
};

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _colors = require('colors');

var _colors2 = _interopRequireDefault(_colors);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _loaderUtils = require('loader-utils');

var _loaderUtils2 = _interopRequireDefault(_loaderUtils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
  storeOnUpload: true,
  logging: true
};

var H24 = 24 * 60 * 60 * 1000;

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
function relativePath(resourcePath, pathAbsolutePart) {
  return resourcePath.replace(pathAbsolutePart, '').substr(1);
}

// read uploadcare-stats.json file
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

// file stats
function readStats(statsFilePath, key) {
  var json = _readStats(statsFilePath);
  return json[key];
}

// wrinting to stats
function updateStats(statsFilePath, key, info) {
  var json = _readStats(statsFilePath);

  json[key] = info;

  var content = JSON.stringify(json, null, 2);

  _fs2.default.writeFileSync(statsFilePath, content);
}

// upload or reupload
function uploadFile(publicKey, filePath) {
  var storeOnUpload = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var callback = arguments[3];

  console.log(('UPLOADING ' + filePath.underline).yellow);

  _request2.default.post({
    url: 'https://upload.uploadcare.com/base/',
    json: true,
    formData: {
      UPLOADCARE_PUB_KEY: publicKey,
      UPLOADCARE_STORE: storeOnUpload ? 1 : 0,
      file: _fs2.default.createReadStream(filePath)
    }
  }, callback);
}

function deleteFile(publicKey, privateKey, uuid, callback) {
  _request2.default.del({
    url: 'https://api.uploadcare.com/files/' + uuid + '/',
    headers: {
      Authorization: 'Uploadcare.Simple ' + publicKey + ':' + privateKey
    }
  }, callback);
}

function getUploadcareUUID() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  var publicKey = options.publicKey;
  var privateKey = options.privateKey;
  var statsFilePath = options.statsFilePath;
  var filePath = options.filePath;
  var fileHash = options.fileHash;
  var storeOnUpload = options.storeOnUpload;
  var callback = options.callback;

  var upload = function upload() {
    uploadFile(publicKey, filePath, storeOnUpload, function (err, resp, body) {
      if (err) {
        callback(err);
        return;
      }

      console.log(('UPLOADED ' + filePath.underline).green);

      try {
        // we writing datetime and publick key for demopublickey use-case
        // files uploaded with demo will be invalidated in 24 hours, there is no
        // way to store file in uploadcare
        updateStats(statsFilePath, filePath, {
          hash: fileHash,
          uuid: body.file,
          dateTimeUploaded: Date.now(),
          publicKeyUsed: publicKey,
          stored: storeOnUpload
        });
      } catch (e) {
        callback(e);
        return;
      }
      callback(null, body.file);
    });
  };

  var info = readStats(statsFilePath, filePath);

  var isFileInCache = info;

  var isCacheValid = info && info.hash === fileHash;

  var isUploadedWithDemoKey = info.publicKeyUsed === 'demopublickey';

  var isUploadedInLast24H = info && Date.now() - info.dateTimeUploaded < H24;

  // file should be there if
  // (uploaded with key and stored)
  // (uploaded with key, not stored, but less than 24H ago)
  // (uploaede with demo key, not stored (nor can it be), but less than 24H ago)
  var isFileStillThere = !isUploadedWithDemoKey && info.stored || !isUploadedWithDemoKey && !info.stored && isUploadedInLast24H || isUploadedWithDemoKey && isUploadedInLast24H;

  // now `state machine` :)
  if (isFileInCache) {
    // good case - found and cache valid
    if (isCacheValid && isFileStillThere) {
      console.log(('FOUND ' + filePath.underline + ', using cache').green);
      callback(null, info.uuid);
      return;
    }

    // found, but cache invalid
    if (!isCacheValid && isFileStillThere) {
      console.log(('CHANGED ' + filePath.underline + ', re-uploading').magenta);

      deleteFile(publicKey, privateKey, info.uuid, function (err, resp, body) {
        if (err) {
          callback(err);
          return;
        }

        console.log(('DELETED ' + filePath.underline + ' previous version').magenta);
        upload();
      });
    }

    // found, but either was uploaded with demo keys, or was not stored
    // and lay there more than 24H, therefore was deleted and should be
    // reuploaded
    if (!isFileStillThere) {
      console.log(('EXPIRED ' + filePath.underline + ', re-uploading').magenta);
      upload();
    }
  } else {
    console.log('NEW FILE ' + filePath.underline);
    upload();
  }
}

module.exports = exports['default'];