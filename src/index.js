/* eslint-disable no-console, no-unused-vars */
import fs from 'fs'
import colors from 'colors'
import request from 'request'
import loaderUtils from 'loader-utils'

const DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
  storeOnUpload: true,
  logging: true,
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
function relativePath(resourcePath, pathAbsolutePart) {
  return resourcePath.replace(pathAbsolutePart, '').substr(1)
}

// read uploadcare-stats.json file
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


// file stats
function readStats(statsFilePath, key) {
  const json = _readStats(statsFilePath)
  return json[key]
}


// wrinting to stats
function updateStats(statsFilePath, key, info) {
  const json = _readStats(statsFilePath)

  json[key] = info

  const content = JSON.stringify(json, null, 2)

  fs.writeFileSync(statsFilePath, content)
}

// upload or reupload
function uploadFile(publicKey, filePath, storeOnUpload = 1, callback) {
  console.log(`UPLOADING ${filePath.underline}`.yellow)

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


function deleteFile(publicKey, privateKey, uuid, callback) {
  request.del({
    url: `https://api.uploadcare.com/files/${uuid}/`,
    headers: {
      Authorization: `Uploadcare.Simple ${publicKey}:${privateKey}`
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

  const upload = () => {
    uploadFile(publicKey, filePath, storeOnUpload, (err, resp, body) => {
      if (err) {
        callback(err)
        return
      }

      console.log(`UPLOADED ${filePath.underline}`.green)

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

  const info = readStats(statsFilePath, filePath)
  const isFileInCache = info
  const isStored = info && info.stored
  const isCacheValid = info && info.hash === fileHash
  const isUploadedWithDemoKey = info && info.publicKeyUsed === 'demopublickey'
  const isUploadedInLast24H = info && (Date.now() - info.dateTimeUploaded < H24)

  // file should be there if
  // (uploaded with key and stored)
  // (uploaded with key, not stored, but less than 24H ago)
  // (uploaede with demo key, not stored (nor can it be), but less than 24H ago)
  const isFileStillThere = info && ((!isUploadedWithDemoKey && info.stored)
      || (!isUploadedWithDemoKey && !info.stored && isUploadedInLast24H)
      || (isUploadedWithDemoKey && isUploadedInLast24H))

  // now `state machine` :)
  if (isFileInCache) {
    // good case - found and cache valid
    if (isCacheValid && isFileStillThere) {
      console.log(`FOUND ${filePath.underline}, using cache`.green)
      callback(null, info.uuid)
      return
    }

    // found, but cache invalid
    if (!isCacheValid && isFileStillThere) {
      console.log(`CHANGED ${filePath.underline}, re-uploading`.magenta)

      deleteFile(publicKey, privateKey, info.uuid, (err, resp, body) => {
        if (err) {
          callback(err)
          return
        }

        console.log(`DELETED ${filePath.underline} previous version`.magenta)
        upload()
      })
    }

    // found, but either was uploaded with demo keys, or was not stored
    // and lay there more than 24H, therefore was deleted and should be
    // reuploaded
    if (!isFileStillThere) {
      console.log(`EXPIRED ${filePath.underline}, re-uploading`.magenta)
      upload()
    }
  } else {
    console.log(`NEW FILE ${filePath.underline}`.green)
    upload()
  }
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
    uploadcareCDN,
    operations,
    storeOnUpload,
    pathAbsolutePart,
  } = options

  const callback = (err, uuid) => {
    if (err) {
      return loaderCallback(err)
    }

    if (loaderCallback) {
      return loaderCallback(null,
        `module.exports = "https://${uploadcareCDN}/${uuid}${operations}"`
      )
    }
  }

  getUploadcareUUID({
    publicKey,
    privateKey,
    storeOnUpload,
    statsFilePath,
    filePath: relativePath(this.resourcePath, pathAbsolutePart),
    fileHash: loaderUtils.getHashDigest(source, 'sha1', 'hex', 36),
    callback,
  })
}
