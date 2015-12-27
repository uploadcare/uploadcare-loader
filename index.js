var uploadcareFactory = require('uploadcare/lib/main');
var fs = require('fs');
var loaderUtils = require('loader-utils');

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

  return pathSplited.splice(dividerIndex).join('/')
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
  const json = _readStats(statsFilePath);
  return json[key];
}

function updateStats(statsFilePath, key, info) {
  var json = _readStats(statsFilePath);
  json[key] = info;
  var content = JSON.stringify(json, null, 2);
  fs.writeFileSync(statsFilePath, content);
}

function getUcId(uploadcare, statsFilePath, filePath, fileKey, fileHash, cb) {
  var info = readStats(statsFilePath, fileKey);
  if (info && info.hash === fileHash) {
    cb(null, info.ucId);
    return;
  }
  uploadcare.file.upload(fs.createReadStream(filePath), function(err, res) {
    if (err) {
      cb(err);
      return;
    }
    try {
      updateStats(statsFilePath, fileKey, {hash: fileHash, ucId: res.file});
    } catch (e) {
      cb(e);
      return;
    }
    cb(null, res.file);
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
  var publicKey = query.publicKey || 'demopublickey';
  var privateKey = query.privateKey || 'demoprivatekey';
  var statsFilePath = query.statsFilePath || './uploadcare-stats.json';
  var resourcePathDivider = query.resourcePathDivider || 'app';
  var uploadcareCDN = query.uploadcareCDN || '';

  getUcId(
    uploadcareFactory(publicKey, privateKey),
    statsFilePath,
    this.resourcePath,
    relativePath(this.resourcePath, resourcePathDivider),
    loaderUtils.getHashDigest(source, 'sha1', 'hex', 36),
    function(err, ucId) {
      if (err) {
        loaderCallback(err);
        return;
      }
      loaderCallback(null, 'module.exports = "https://ucarecdn.com/' + ucId + '/"')
    }
  )

};

module.exports.raw = true;