var uploadcareFactory = require('uploadcare/lib/main');
var fs = require('fs');
var loaderUtils = require('loader-utils');
var jsonfile = require('jsonfile');
var crypto = require('crypto');
var colors = require('colors');


// TODO: implement logger;
function logger(systemText, value, level) {
}


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
};


// TODO: pass callback here as it is async?
function checkOrCreateStatFile(statsFilePath, callback) {
  jsonfile.readFile(statsFilePath, function(err, obj) {
    if (err) {
      console.log('[uploadcare] creating stats file in '.green + "" + statsFilePath + "".underline);

      fs.writeFile(statsFilePath, "{}", function (err) {
        if (err) console.error('[uploadcare] error creating stats file: '.red, "" + err + "".underline);

        callback(err);
      })
    } else {
      callback(null);
    }
  })
};


// TODO: add get away from loop. good for now.
function checkFileInStats(statsFilePath, resourcePath, resourceHash, callback) {
  return jsonfile.readFile(statsFilePath, function(err, obj) {
    if (err) {
      console.log('[uploadcare] error checking file in stats: '.red, err);
      checkFileInStats.apply(this, arguments);
    } else {
      var file = obj[resourcePath];

      if (file && file.hash === resourceHash) {
        callback(null, file)
      } else {
        callback(null, null)
      }
    }
  })
};


// TODO: prevent infinite loop?
function uploadFileAndWriteToStats(resourcePath, resourceHash, uploadcare, statsFilePath, loaderCallback) {
  uploadcare.file.upload(fs.createReadStream(resourcePath), function(err, res){
    if (err) return callback(err);

    var args = arguments;
    var _this = this;

    jsonfile.readFile(statsFilePath, function(err, obj) {
      if (err) {
        console.log('[uploadcare] error reading stats file: '.red, err);
        uploadFileAndWriteToStats.apply(_this, args);
      }

      obj[resourcePath] = {
        file: res.file,
        hash: resourceHash,
      }

      jsonfile.writeFile(statsFilePath, obj, {spaces: 2}, function(err) {
        if (err) console.log('writing error: ', err);

        loaderCallback(null, 'module.exports = "https://ucarecdn.com/' + res.file + '/"');
      });
    });
  });
};


// loader function
module.exports = function(source) {
  var loaderCallback = this.async();

  // sync version. whatever.
  // acording to docs it's a super-safe fallback, will never be used.
  if (!loaderCallback) return source;


  // query params...
  // ugh...
  var query = loaderUtils.parseQuery(this.query);
  var publicKey = query.publicKey || 'demopublickey';
  var privateKey = query.privateKey || 'demoprivatekey';
  var statsFilePath = query.statsFilePath || './uploadcare-stats.json';
  var resourcePathDivider = query.resourcePathDivider || 'app';
  var uploadcareCDN = query.uploadcareCDN || '';

  var uploadcare = uploadcareFactory(publicKey, privateKey);

  // path and hash. we will need both to determine if we could use cached file
  // TODO: move it to uploadcare service? should not they have some hash validation?
  // for you know - reuse resource instead of bluntly duplicating files?
  var resourcePath = this.resourcePath;
  var resourceRelativePath = relativePath(resourcePath, resourcePathDivider);
  var resourceHash = loaderUtils.getHashDigest(source, 'sha1', 'hex', 36);

  // should be cacheable
  // as far as i know this is actually will prevent even cache check if hash does not changed.
  this.cacheable();

  // checking or creating stats file
  var statsFile = checkOrCreateStatFile(statsFilePath,function(err) {
    if (err) {
      return checkOrCreateStatFile.apply(this, arguments);
    }

    // checking or uploading file and writing stats
    var uploadedFile = checkFileInStats(statsFilePath, resourceRelativePath, resourceHash, function(err, res) {
      if (res) {
        loaderCallback(null, 'module.exports = "https://ucarecdn.com/' + res.file + '/"');
        console.log('[uploadcare]: file uuid fetched from cache: '.green, resourceRelativePath.underline)
      } else {
        uploadFileAndWriteToStats(resourceRelativePath, resourceHash, uploadcare, statsFilePath, loaderCallback)
        console.log('[uploadcare]: uploading new file: '.yellow, resourceRelativePath.underline)
      }
    });
  });


};

module.exports.raw = true;