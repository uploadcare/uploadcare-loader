/* eslint-disable no-console, no-unused-vars */
import request from 'request'
import colors from 'colors'

function iterateThroughPage(url, publicKey, privateKey) {
  const headers = {
    Authorization: `Uploadcare.Simple ${publicKey}:${privateKey}`
  }

  request.get({
    url: url,
    headers: headers
  }, (err, res, body) => {
    body.results.map((file) => {
      request.del({
        url: `https://api.uploadcare.com/files/${file.uuid}/storage`,
        headers: headers
      }, (delErr) => {
        if (delErr) {
          console.log(`ERROR deleting ${file.uuid.underline}, ${JSON.stringify(delErr)}`.red)
        } else {
          console.log(`${file.uuid.underline} were deleted`.green)
        }
      })
    })

    if (body.next) {
      iterateThroughPage(body.next, publicKey, privateKey)
    }
  })
}

export default function unstoreAllFiles(publicKey, privateKey) {
  if (!publicKey.length || !privateKey.length) {
    console.log('no private/pubic key were provided, skipping deleting files')
    return
  }

  iterateThroughPage(`https://api.uploadcare.com/files/?stored=true&limit=1000`, publicKey, privateKey)
}
