import uploadcareFactory from 'uploadcare/lib/main'
import fs from 'fs'
import loaderUtils from 'loader-utils'

const DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  resourcePathDivider: 'app',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
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


function getUploadcareUUID(uploadcare, statsFilePath, filePath, fileKey, fileHash, cb) {
  const info = readStats(statsFilePath, fileKey)

  if (info && info.hash === fileHash) {
    cb(null, info.uuid)
    return
  }

  uploadcare.file.upload(fs.createReadStream(filePath), function(err, res) {
    if (err) {
      cb(err)
      return
    }
    try {
      updateStats(statsFilePath, fileKey, {hash: fileHash, uuid: res.file})
    } catch (e) {
      cb(e)
      return
    }
    cb(null, res.file)
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

  const options = {
    ...DEFAULT_OPTIONS,
    ...loaderUtils.parseQuery(this.query),
    ...loaderUtils.parseQuery(this.resourceQuery),
  }

  getUploadcareUUID(
    uploadcareFactory(options.publicKey, options.privateKey),
    options.statsFilePath,
    this.resourcePath,
    relativePath(this.resourcePath, options.resourcePathDivider),
    loaderUtils.getHashDigest(source, 'sha1', 'hex', 36),
    function(err, uuid) {
      if (err) {
        return loaderCallback(err)
      }

      if (loaderCallback) {
        return loaderCallback(null, `module.exports = "https://${options.uploadcareCDN}/${uuid}${options.operations}"`)
      }
    }
  )
}
