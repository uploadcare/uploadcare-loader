var fs = require('fs');
var loaderUtils = require('loader-utils');
var request = require('request');

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
  var pathRelative = resourcePath.replace(pathAbsolutePart, '').substr(1)

  return pathRelative
}


function _readStats(statsFilePath) {
  var content;

  try {
    content = fs.readFileSync(statsFilePath);
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

  fs.writeFileSync(statsFilePath, content);
}


function getUploadcareUUID(publicKey, statsFilePath, filePath, fileKey, fileHash, storeOnUpload, cb) {
  var info = readStats(statsFilePath, fileKey);

  if (info && info.hash === fileHash) {
    cb(null, info.uuid);
    return;
  }

  request.post({
    url: 'https://upload.uploadcare.com/base/',
    json: true,
    formData: {
      UPLOADCARE_PUB_KEY: publicKey,
      UPLOADCARE_STORE: storeOnUpload ? 1 : 0,
      file: fs.createReadStream(filePath),
    }
  }, function(err, resp, body) {
    if (err) {
      cb(err);
      return;
    }

    try {
      updateStats(statsFilePath, fileKey, {hash: fileHash, uuid: body.file});
    } catch (e) {
      cb(e);
      return;
    }

    cb(null, body.file);
  })
}



module.exports = function(source) {
  var loaderCallback = this.async();

  // sync version. whatever.
  // acording to docs it's a super-safe fallback, will never be used.
  if (!loaderCallback) return source;

  // should be cacheable
  // as far as i know this is actually will prevent even cache check if hash does not changed.
  this.cacheable();

  // query params...
  // ugh...
  var query = loaderUtils.parseQuery(this.query);
  var resourceQuery = loaderUtils.parseQuery(this.resourceQuery);

  var publicKey = query.publicKey || 'demopublickey';
  var privateKey = query.privateKey || 'demoprivatekey';
  var statsFilePath = query.statsFilePath || './uploadcare-stats.json';
  var pathAbsolutePart = query.pathAbsolutePart;
  var uploadcareCDN = query.uploadcareCDN || 'ucarecdn.com';
  var storeOnUpload = query.storeOnUpload || true;
  // operations or closing slash
  // operations should start with '/-/'
  var operations = resourceQuery.operations || '/';

  getUploadcareUUID(
    publicKey,
    statsFilePath,
    this.resourcePath,
    relativePath(this.resourcePath, pathAbsolutePart),
    loaderUtils.getHashDigest(source, 'sha1', 'hex', 36),
    storeOnUpload,
    function(err, uuid) {
      if (err) {
        return loaderCallback(err);
      }

      if (loaderCallback) {
        return loaderCallback(null, 'module.exports = "https://' + uploadcareCDN + '/' + uuid + operations + '"');
      }

      return;
    }
  )

};

module.exports.raw = true;