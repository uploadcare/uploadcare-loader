# uploadcare-loader
webpack loader with all the glory of uploadcare.com

## Instalation

```bash
npm install --save whitescape/uploadcare-loader
```
or

```bash
npm install --save-dev whitescape/uploadcare-loader
```

## Usage
In Webpack config:

```js
{
  test: /\.(jpg|png|gif)$/,
  loader: 'uploadcare',
  query: {
    publicKey: 'PUBLIC_KEY',
    privateKey: 'PRIVATE_KEY',
    statsFilePath: path.join(__dirname, 'build', 'uploadcare.json'),
    resourcePathDivider: 'app',
  },
},
```

thats it.

## Awesome part

now you can turn

```js
const img = require('./assets/image.png')
```
into

```js
// => https://ucarecdn.com/960b4e3a-065f-4502-be4b-55824b9d800e/
```

or

```styl
.selector
  background-image: url('./assets/bg.png')
```
into

```css
.selector {
  background-image: url(https://ucarecdn.com/960b4e3a-065f-4502-be4b-55824b9d800e/);
}
```

### Not awesome enough?
well how about that:

```js
const img = require('./assets/image.png')

//..
render() {
  return (
    <img src={'${img}-/resize/600x/-/format/jpg/-/quality/lightest/'}/>
  )
}

// results in
// <img src="https://ucarecdn.com/960b4e3a-065f-4502-be4b-55824b9d800e/-/resize/600x/-/format/jpg/-/quality/lightest/" />
```

**full power of [Uploadcare CDN operations](https://uploadcare.com/documentation/cdn/) for your local assets!**
