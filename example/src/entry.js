var css = require('css!./styles.css')
var lion = require('./images/lion.jpg')
var buildings = require('./images/buildings.jpg')

console.log({
  lion: lion,
  buildings: buildings,
  buildingsPreview: buildings + '-/preview/480x480/',
  css: css.toString(),
})