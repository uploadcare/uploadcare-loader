# uploadcare-loader
webpack loader with all the glory of [Uploadcare](https://uploadcare.com)

![uploadcare-loader awesome fusion](http://www.ucarecdn.com/ddc8f711-ee68-4b70-aed1-3b2f7e7fba2f/uploadcareloaderprod.gif)

## Disclaimer

#### [Uploadcare](https://uploadcare.com)
Awesome service, handles upload and croping and resizing and storinga and delivering and caching and many other things for you.


#### [Webpack](https://webpack.github.io)
Module bundler which allow you `require` any file and use it kinda like it's a native node.js module.


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
  test: /\.(jpg|png|gif)(\?{1}.*)?$/, // for operations query support
  loader: 'uploadcare',
  query: {
    publicKey: 'PUBLIC_KEY',
    privateKey: 'PRIVATE_KEY',
    statsFilePath: path.join(__dirname, 'build', 'uploadcare.json'),
    resourcePathDivider: 'app',
    uploadcareCDN: 'c7.ucarecdn.com',
  },
},
```

**thats it.**

..oh, yeah, configuration..

##### `test: /\.(jpg|png|gif)(\?{1}.*)?$/`
Notice how it is much uglier than reguar `/\.(jpg|png|gif)$/` you could see in nearly any webpack docs or tutorials?
It's because simplier regex does not account for `resourseQuery` part of the `require()` call.
You may or may not know but `require('./assets/img.png?foo=bar')` is a valid require and query will be passed and parsed as `{foo: 'bar'}` by loader if needed.
So `test: /\.(jpg|png|gif)(\?{1}.*)?$/` is handle

`something.png`

`something.png?foo=bar`

etc.

All of this is crutial for one reason: while you could use string concatination in JS like this:

```js
<img src={'${require('./assets/img.png')}-/blur/100/'} />
```
you could not do anyting like it in CSS `url()` call (at least without some complicated logic in styl/sass).
So in this case you could do

```styl
.selector
  background-image: url('./assets/img.jpg?operations=/-/blur/100/')
```
to achieve same result.

**Oh and one more thing:** while Uploadcare and this loader designed to be used with images, there is nothing standing in your way to use uploadcare-loader for *any* static files - `pdf`, `xls`, fonts, even scripts and css files.
just add needed extentions to test Regex (`test: /\.(jpg|png|gif|pdf|xls|doc)(\?{1}.*)?$/`) and you good to go. Just remeber that operations for this file types are useless, aside from [this ones](https://uploadcare.com/documentation/cdn/#other-operations)


loader accepts following query params (with defaults):

##### `publicKey`
Uploadcare public key. default is `demopublickey`; more [here](https://uploadcare.com/documentation/keys/)

##### `privateKey`
Uploadcare private key. default is `demoprivatekey`; see above.

##### `statsFilePath`
Where to put stats file with upload results. it's basicly `json` with something like:

```js
{
  "app/images/bg.png": {
    "hash": "15396d45d12809b8f75773f293d874910755",
    "uuid": "985af185-fc43-4e69-807c-654dd037bb41"
  },
  "app/images/mobile.jpg": {
    "hash": "9e7d29d56fd2e60a6f917fc1771d56af79e3",
    "uuid": "a93c8ab5-0e34-4411-85dd-c52647dd0f75"
  },
  "app/images/logo.png": {
    "hash": "e212123d82016211ac94d60c56cedbd32f9e",
    "uuid": "3e4c5830-4abd-44a1-a570-0f71e5b341f9"
  },

  //...
}
```

This cache allow you to reuse files instead of uploading them over and over again.
It is also posible, through not recomended, to keep stats file in git to speed up deploy and save uploads/usage; Better still to put this file under `gitignore` directive.
Default is `./uploadcare-stats.json` (where `./` is relative to webpack config file).

##### `resourcePathDivider`
Tricky and ugly one. we yet to overcome it and produce a clear solution.
Problem is `this.resourcePath` is absolute:
`/Users/username/code/project/app/images/background/wide_desk.jpg`
which will result in cache miss in different environment; so we need to make path relative again.
So `resourcePathDivider` is used to split relative path part from absolute part of the path.
default is `app`, you will probably need `src` or something.

##### `uploadcareCDN`
CDN provider. you could read more [here](https://uploadcare.com/documentation/cdn/).
Default is `ucarecdn.com`;

valid values:

`c7.ucarecdn.com` for CDN77

`kx.ucarecdn.com` for KeyCDN

`cfr.ucarecdn.com` for Amazon CloudFront


if guys from Uploadcare came up with new providers you should be able to just toss it in.



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

// => somethere in your DOM
// <img src="https://ucarecdn.com/960b4e3a-065f-4502-be4b-55824b9d800e/-/resize/600x/-/format/jpg/-/quality/lightest/" />
```

and

```styl
.selector
  background-image: url('./assets/img.jpg?operations=/-/blur/100/')
// =>
// .selector {
//   background-image: url(https://ucarecdn.com/960b4e3a-065f-4502-be4b-55824b9d800e/-/blur/100/)
// }
```

**full power of [Uploadcare CDN operations](https://uploadcare.com/documentation/cdn/) for your local assets!**
