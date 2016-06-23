'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /* eslint-disable no-console, no-unused-vars */


exports.default = function (source) {
  var loaderCallback = this.async();

  // sync version. whatever.
  // acording to docs it's a super-safe fallback, will never be used.
  if (!loaderCallback) return source;

  // should be cacheable
  // as far as i know this is actually will prevent even cache check if hash does not changed.
  this.cacheable();

  // building options with defaults and overrides
  var options = _extends({}, DEFAULT_OPTIONS, _loaderUtils2.default.parseQuery(this.query), _loaderUtils2.default.parseQuery(this.resourceQuery), {
    source: source,
    resourcePath: this.resourcePath
  });

  var uploadcareCDN = options.uploadcareCDN;
  var operations = options.operations;


  var uploadcareFile = new UploadcareFile(options);

  uploadcareFile.getUploadcareUUID(function (err, uuid) {
    if (err) {
      return loaderCallback(err);
    }

    if (loaderCallback) {
      return loaderCallback(null, 'module.exports = "https://' + uploadcareCDN + '/' + uuid + operations + '"');
    }
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

var _get = require('lodash/get');

var _get2 = _interopRequireDefault(_get);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
  storeOnUpload: true,
  logging: true,
  useES6modules: false
};

var H24 = 24 * 60 * 60 * 1000;

function relativePath(resourcePath, pathAbsolutePart) {
  return resourcePath.replace(pathAbsolutePart, '').substr(1);
}

// Uploader
var UploadcareFile = function () {
  function UploadcareFile(props) {
    _classCallCheck(this, UploadcareFile);

    this.props = _extends({}, props, {
      filePath: relativePath(props.resourcePath, props.pathAbsolutePart),
      fileHash: _loaderUtils2.default.getHashDigest(props.source, 'sha1', 'hex', 36)
    });
  }

  _createClass(UploadcareFile, [{
    key: 'log',
    value: function log() {
      var msg = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var color = arguments.length <= 1 || arguments[1] === undefined ? 'green' : arguments[1];

      return console.log('!!!', msg[color]);
    }
  }, {
    key: '_readStats',
    value: function _readStats() {
      var statsFilePath = this.props.statsFilePath;


      var content = void 0;

      try {
        content = _fs2.default.readFileSync(statsFilePath);
      } catch (e) {
        // this is probably because the stats file wasn't created yet,
        // so we return the same result as if the file was empty.
        return {};
      }
      return JSON.parse(content);
    }
  }, {
    key: 'readStats',
    value: function readStats() {
      var _props = this.props;
      var statsFilePath = _props.statsFilePath;
      var filePath = _props.filePath;


      var json = this._readStats();
      return json[filePath];
    }
  }, {
    key: 'updateStats',
    value: function updateStats(info) {
      var _props2 = this.props;
      var statsFilePath = _props2.statsFilePath;
      var filePath = _props2.filePath;


      var json = this._readStats();

      json[filePath] = info;

      var content = JSON.stringify(json, null, 2);

      _fs2.default.writeFileSync(statsFilePath, content);
    }
  }, {
    key: 'uploadFile',
    value: function uploadFile(callback) {
      var _props3 = this.props;
      var publicKey = _props3.publicKey;
      var filePath = _props3.filePath;
      var _props3$storeOnUpload = _props3.storeOnUpload;
      var storeOnUpload = _props3$storeOnUpload === undefined ? 1 : _props3$storeOnUpload;
      var fileHash = _props3.fileHash;


      this.log('UPLOADING ' + filePath.underline, 'yellow');

      _request2.default.post({
        url: 'https://upload.uploadcare.com/base/',
        json: true,
        formData: {
          UPLOADCARE_PUB_KEY: publicKey,
          UPLOADCARE_STORE: storeOnUpload ? 1 : 0,
          file: {
            value: _fs2.default.createReadStream(filePath),
            options: {
              filename: fileHash
            }
          }
        }
      }, callback);
    }
  }, {
    key: 'deleteFile',
    value: function deleteFile(uuid, callback) {
      var _props4 = this.props;
      var publicKey = _props4.publicKey;
      var privateKey = _props4.privateKey;


      _request2.default.del({
        url: 'https://api.uploadcare.com/files/' + uuid + '/',
        headers: {
          Authorization: 'Uploadcare.Simple ' + publicKey + ':' + privateKey
        }
      }, callback);
    }
  }, {
    key: 'upload',
    value: function upload() {
      var _this = this;

      var _props5 = this.props;
      var loaderCallback = _props5.loaderCallback;
      var filePath = _props5.filePath;
      var publicKey = _props5.publicKey;
      var fileHash = _props5.fileHash;
      var storeOnUpload = _props5.storeOnUpload;


      this.uploadFile(function (err, resp, body) {
        if (err) {
          return loaderCallback(err);
        }

        var uuid = body.file;


        _this.log('UPLOADED ' + filePath.underline);

        try {
          // we writing datetime and public key for demopublickey use-case
          // files uploaded with demo will be invalidated in 24 hours, there is no
          // way to store file in uploadcare
          _this.updateStats({
            hash: fileHash,
            uuid: uuid,
            dateTimeUploaded: Date.now(),
            publicKeyUsed: publicKey,
            stored: storeOnUpload && publicKey !== 'demopublickey'
          });
        } catch (writingErr) {
          return loaderCallback(writingErr);
        }

        loaderCallback(null, uuid);
      });
    }
  }, {
    key: 'getUploadcareUUID',
    value: function getUploadcareUUID(loaderCallback) {
      var _this2 = this;

      var _props6 = this.props;
      var publicKey = _props6.publicKey;
      var privateKey = _props6.privateKey;
      var statsFilePath = _props6.statsFilePath;
      var filePath = _props6.filePath;
      var fileHash = _props6.fileHash;
      var storeOnUpload = _props6.storeOnUpload;


      this.props.loaderCallback = loaderCallback;

      var info = this.readStats() || {};

      var uuid = info.uuid;
      var stored = info.stored;
      var hash = info.hash;
      var publicKeyUsed = info.publicKeyUsed;
      var dateTimeUploaded = info.dateTimeUploaded;


      var isFileInCache = !!uuid;
      var isStored = stored;
      var isCacheValid = hash === fileHash;
      var isUploadedWithDemoKey = publicKeyUsed === 'demopublickey';
      var isUploadedInLast24H = Date.now() - dateTimeUploaded < H24;

      var isFileStillThere = !isUploadedWithDemoKey && isStored || !isUploadedWithDemoKey && !isStored && isUploadedInLast24H || isUploadedWithDemoKey && isUploadedInLast24H;

      // omg state machine
      if (isFileInCache) {
        // good case - found and cache valid
        if (isCacheValid && isFileStillThere) {
          this.log('FOUND ' + filePath.underline + ', using cache');
          return loaderCallback(null, uuid);
        }

        // found, but cache invalid
        if (!isCacheValid && isFileStillThere) {
          this.log('CHANGED ' + filePath.underline + ', re-uploading', 'magenta');

          this.deleteFile(uuid, function (err, resp, body) {
            if (err) {
              return loaderCallback(err);
            }

            _this2.log('DELETED ' + filePath.underline + ' previous version', 'magenta');
            _this2.upload();
          });
        }

        // found, but either was uploaded with demo keys, or was not stored
        // and lay there more than 24H, therefore was deleted and should be
        // reuploaded
        if (!isFileStillThere) {
          this.log('EXPIRED ' + filePath.underline + ', re-uploading', 'magenta');
          this.upload();
        }
      } else {
        this.log('NEW FILE ' + filePath.underline);
        this.upload();
      }
    }
  }]);

  return UploadcareFile;
}();

module.exports = exports['default'];