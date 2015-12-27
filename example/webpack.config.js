var path = require('path')

module.exports = {
  entry: './src/entry',
  output: {
    path: './public',
    filename: 'bundle.js',
  },
  module: {
    loaders: [
      {
        test: /\.(jpg|png|gif)$/,
        loader: '../../index.js',
        query: {
          publicKey: 'demopublickey',
          privateKey: 'demoprivatekey',
          statsFilePath: path.join(__dirname, 'public', 'uploadcare.json'),
          resourcePathDivider: 'src',
        },
      },
    ],
  }
}
