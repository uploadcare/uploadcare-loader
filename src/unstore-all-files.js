/* eslint-disable no-console, no-unused-vars */
import request from 'request'
import colors from 'colors'

function iterateThroughPage(url, publicKey, privateKey, deleteNotUnstore) {
  const headers = {
    Authorization: `Uploadcare.Simple ${publicKey}:${privateKey}`
  }

  request.get({
    url,
    headers
  }, (err, res, body) => {
    try {
      const {
        results,
        next,
      } = JSON.parse(body)

      results.map((file) => {
        const fileUnstoreUrl = `https://api.uploadcare.com/files/${file.uuid}/${deleteNotUnstore ? '' : 'storage/'}`
        request.del({
          url: `https://api.uploadcare.com/files/${file.uuid}/`,
          headers
        }, (delErr) => {
          if (delErr) {
            console.log(`ERROR deleting ${file.uuid.underline}: ${JSON.stringify(delErr)}`.red)
          } else {
            console.log(`${file.uuid.underline} were ${deleteNotUnstore ? 'deleted' : 'unstored'}`.green)
          }
        })
      })

      if (next) {
        console.log('Goingin to next page'.underline.green)

        iterateThroughPage(next, publicKey, privateKey, deleteNotUnstore)
      }

    } catch (e) {
      console.log('Error deleting:'.red, e.stack)
    }
  })
}


export default function unstoreAllFiles(publicKey = '', privateKey = '', options = {}) {
  if (!publicKey.length || !privateKey.length) {
    console.log('no private/pubic key were provided, skipping deleting files')
    return
  }

  const {
    deleteNotUnstore = true,
    limit = 100,
  } = options

  const url = `https://api.uploadcare.com/files/?stored=true&limit=${limit}`

  iterateThroughPage(url, publicKey, privateKey, deleteNotUnstore)
}
