/* eslint-disable no-console, no-unused-vars */
import fs from 'fs'
import colors from 'colors'
import request from 'request'
import loaderUtils from 'loader-utils'
import get from 'lodash/get'

const DEFAULT_OPTIONS = {
  publicKey: 'demopublickey',
  privateKey: 'demoprivatekey',
  statsFilePath: './uploadcare-stats.json',
  uploadcareCDN: 'ucarecdn.com',
  operations: '/',
  storeOnUpload: true,
  logging: true,
  useES6modules: false,
}

const H24 = 24 * 60 * 60 * 1000

function relativePath(resourcePath, pathAbsolutePart) {
  return resourcePath.replace(pathAbsolutePart, '').substr(1)
}

// Uploader
const UploadcareFile = class UploadcareFile {
  constructor(props) {
    this.props = {
      ...props,
      filePath: relativePath(props.resourcePath, props.pathAbsolutePart),
      fileHash: loaderUtils.getHashDigest(props.source, 'sha1', 'hex', 36),
    }
  }

  log(msg = '', color = 'green') {
    return console.log('!!!', msg[color])
  }


  _readStats() {
    const {
      statsFilePath
    } = this.props

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

  readStats() {
    const {
      statsFilePath,
      filePath,
    } = this.props

    const json = this._readStats()
    return json[filePath]
  }


  updateStats(info) {
    const {
      statsFilePath,
      filePath,
    } = this.props

    const json = this._readStats()

    json[filePath] = info

    const content = JSON.stringify(json, null, 2)

    fs.writeFileSync(statsFilePath, content)
  }

  uploadFile(callback) {
    const {
      publicKey,
      filePath,
      storeOnUpload = 1,
      fileHash,
    } = this.props

    this.log(`UPLOADING ${filePath.underline}`, 'yellow')

    request.post({
      url: 'https://upload.uploadcare.com/base/',
      json: true,
      formData: {
        UPLOADCARE_PUB_KEY: publicKey,
        UPLOADCARE_STORE: storeOnUpload ? 1 : 0,
        file: {
          value: fs.createReadStream(filePath),
          options: {
            filename: fileHash,
          }
        },
      }
    }, callback)
  }

  deleteFile(uuid, callback) {
    const {
      publicKey,
      privateKey,
    } = this.props

    request.del({
      url: `https://api.uploadcare.com/files/${uuid}/`,
      headers: {
        Authorization: `Uploadcare.Simple ${publicKey}:${privateKey}`
      }
    }, callback)
  }


  upload() {
    const {
      loaderCallback,
      filePath,
      publicKey,
      fileHash,
      storeOnUpload,
    } = this.props

    this.uploadFile((err, resp, body) => {
      if (err) {
        return loaderCallback(err)
      }

      const {
        file: uuid
      } = body

      this.log(`UPLOADED ${filePath.underline}`)

      try {
        // we writing datetime and public key for demopublickey use-case
        // files uploaded with demo will be invalidated in 24 hours, there is no
        // way to store file in uploadcare
        this.updateStats({
          hash: fileHash,
          uuid: uuid,
          dateTimeUploaded: Date.now(),
          publicKeyUsed: publicKey,
          stored: storeOnUpload && publicKey !== 'demopublickey',
        })
      } catch (writingErr) {
        return loaderCallback(writingErr)
      }

      loaderCallback(null, uuid)
    })
  }



  getUploadcareUUID(loaderCallback) {
    const {
      publicKey,
      privateKey,
      statsFilePath,
      filePath,
      fileHash,
      storeOnUpload,
    } = this.props

    this.props.loaderCallback = loaderCallback


    const info = this.readStats() || {}

    const {
      uuid,
      stored,
      hash,
      publicKeyUsed,
      dateTimeUploaded,
    } = info

    const isFileInCache = !!uuid
    const isStored = stored
    const isCacheValid = hash === fileHash
    const isUploadedWithDemoKey = publicKeyUsed === 'demopublickey'
    const isUploadedInLast24H = (Date.now() - dateTimeUploaded) < H24

    const isFileStillThere = (!isUploadedWithDemoKey && isStored)
      || (!isUploadedWithDemoKey && !isStored && isUploadedInLast24H)
      || (isUploadedWithDemoKey && isUploadedInLast24H)

    // omg state machine
    if (isFileInCache) {
      // good case - found and cache valid
      if (isCacheValid && isFileStillThere) {
        this.log(`FOUND ${filePath.underline}, using cache`)
        return loaderCallback(null, uuid)
      }

      // found, but cache invalid
      if (!isCacheValid && isFileStillThere) {
        this.log(`CHANGED ${filePath.underline}, re-uploading`, 'magenta')

        this.deleteFile(uuid, (err, resp, body) => {
          if (err) {
            return loaderCallback(err)
          }

          this.log(`DELETED ${filePath.underline} previous version`, 'magenta')
          this.upload()
        })
      }

      // found, but either was uploaded with demo keys, or was not stored
      // and lay there more than 24H, therefore was deleted and should be
      // reuploaded
      if (!isFileStillThere) {
        this.log(`EXPIRED ${filePath.underline}, re-uploading`, 'magenta')
        this.upload()
      }
    } else {
      this.log(`NEW FILE ${filePath.underline}`)
      this.upload()
    }
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
    source,
    resourcePath: this.resourcePath,
  }

  const {
    uploadcareCDN,
    operations,
  } = options

  const uploadcareFile = new UploadcareFile(options)

  uploadcareFile.getUploadcareUUID((err, uuid) => {
    if (err) {
      return loaderCallback(err)
    }

    if (loaderCallback) {
      return loaderCallback(null,
        `module.exports = "https://${uploadcareCDN}/${uuid}${operations}"`
      )
    }
  })
}

