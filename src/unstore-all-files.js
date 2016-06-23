/* eslint-disable no-console, no-unused-vars */
import request from 'request'
import colors from 'colors'
import chunk from 'lodash/chunk'
import fs from 'fs'

const projectFiles = []

function headers(publicKey, privateKey) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Uploadcare.Simple ${publicKey}:${privateKey}`
  }
}

function unstoreProjectFiles(files, publicKey, privateKey, statsFilePath) {
  const uuidsToUnstore = chunk(files.map(f => f.uuid), 100)

  uuidsToUnstore.map((uuidsToUnstoreChunk) => {
    request.del({
      url: 'https://api.uploadcare.com/files/storage/',
      headers: headers(publicKey, privateKey),
      body: JSON.stringify(uuidsToUnstoreChunk),
    }, (err, resp, body) => {

    })
  })

  const filesList = {}

  files.map((f) => filesList[f.hash] = f)

  const content = JSON.stringify(filesList, null, 2)

  fs.writeFileSync(statsFilePath, content)
}


function iterateThroughPage(url, publicKey, privateKey, statsFilePath) {
  request.get({
    url,
    headers: headers(publicKey, privateKey)
  }, (err, res, body) => {
    const {
      results,
      next,
    } = JSON.parse(body)

    results.map(file => {
      projectFiles.push({
        uuid: file.uuid,
        hash: file.original_filename
      })
    })

    if (next) {
      console.log('next')
      iterateThroughPage(next, publicKey, privateKey, statsFilePath)
    } else {
      console.log('done')
      unstoreProjectFiles(projectFiles, publicKey, privateKey, statsFilePath)
    }
  })
}


export default function unstoreAllFiles(publicKey, privateKey, statsFilePath, options = {}) {
  if (!publicKey.length || !privateKey.length) {
    console.log('no private/pubic key were provided, skipping deleting files')
    return
  }

  const {
    deleteFile = false,
    limit = 100,
  } = options

  const url = `https://api.uploadcare.com/files/?removed=false&stored=true&limit=${limit}`

  iterateThroughPage(url, publicKey, privateKey, statsFilePath)
}
