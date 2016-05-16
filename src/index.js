// import uploadcareFactory from 'uploadcare/lib/main'
import fs from 'fs'
import request from 'request'
import loaderUtils from 'loader-utils'

const DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  resourcePathDivider: 'app',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
  storeOnUpload: true,
}

const H24 = 24 * 60 * 60 * 1000

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
  const pathSplited = resourcePath.split('/')
  const dividerIndex = pathSplited.indexOf(resourcePathDivider)

  return pathSplited.splice(dividerIndex).join('/')
}


function _readStats(statsFilePath) {
  let content

  try {
    content = fs.readFileSync(statsFilePath)
  } catch (e) {
    // this is probably because the stats file wasn't created yet,
    // so we return the same result as if the file was empty.
    return {}
  }
  return JSON.parse(content)
}


function readStats(statsFilePath, key) {
  const json = _readStats(statsFilePath)
  return json[key]
}


function updateStats(statsFilePath, key, info) {
  const json = _readStats(statsFilePath)
  json[key] = info

  const content = JSON.stringify(json, null, 2)

  fs.writeFileSync(statsFilePath, content)
}


function uploadFile(publicKey, filePath, storeOnUpload = 1, callback) {
  request.post({
    url: 'https://upload.uploadcare.com/base/',
    json: true,
    formData: {
      UPLOADCARE_PUB_KEY: publicKey,
      UPLOADCARE_STORE: storeOnUpload ? 1 : 0,
      file: fs.createReadStream(filePath),
    }
  }, callback)
}


function getUploadcareUUID(options = {}) {
  const {
    publicKey,
    privateKey,
    statsFilePath,
    filePath,
    fileHash,
    storeOnUpload,
    callback,
  } = options

  const info = readStats(statsFilePath, filePath)

  const isCacheValid = info && info.hash === fileHash
  const isFileStillThere = info.stored ||
    // special case for demo key
    // file will be deleted in 27 hours
    (info.publicKeyUsed === 'demopublickey' && info.dateTimeUploaded + H24 > Date.now())

  if (isCacheValid && isFileStillThere) {
    callback(null, info.uuid)
    return
  }

  uploadFile(publicKey, filePath, storeOnUpload, (err, resp, body) => {
    if (err) {
      callback(err)
      return
    }

    try {
      // we writing datetime and publick key for demopublickey use-case
      // files uploaded with demo will be invalidated in 24 hours, there is no
      // way to store file in uploadcare
      updateStats(statsFilePath, filePath, {
        hash: fileHash,
        uuid: body.file,
        dateTimeUploaded: Date.now(),
        publicKeyUsed: publicKey,
        stored: storeOnUpload,
      })
    } catch (e) {
      callback(e)
      return
    }
    callback(null, body.file)
  })
 }



export default function(source) {
  const loaderCallback = this.async()

  // sync version. whatever.
  // acording to docs it's a super-safe fallback, will never be used.
  if (!loaderCallback) return source

  // should be cacheable
  // as far as i know this is actually will prevent even cache check if hash does not changed.
  this.cacheable()

  // building options with defaults and overrides
  const options = {
    ...DEFAULT_OPTIONS,
    ...loaderUtils.parseQuery(this.query),
    ...loaderUtils.parseQuery(this.resourceQuery),
  }

  const {
    publicKey,
    privateKey,
    statsFilePath,
    resourcePathDivider,
    uploadcareCDN,
    operations,
    storeOnUpload,
  } = options

  getUploadcareUUID({
    publicKey: publicKey,
    privateKey: privateKey,
    storeOnUpload: storeOnUpload,
    statsFilePath: statsFilePath,
    filePath: relativePath(this.resourcePath, resourcePathDivider),
    fileHash: loaderUtils.getHashDigest(source, 'sha1', 'hex', 36),
    callback: (err, uuid) => {
      if (err) {
        return loaderCallback(err)
      }

      if (loaderCallback) {
        return loaderCallback(null,
          `module.exports = "https://${uploadcareCDN}/${uuid}${operations}"`
        )
      }
    }
  })
}
