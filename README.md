# compiln

Open-armed asset compiling for Node.js.

compiln uses a plugin-based architecture to allow YOU to choose your preprocssor stack, not me.

## How to install

```bash
npm install compiln
```

## How to use

### Middleware (Connect or Express):

compiln can be used as middleware. The middleware accepts 3 options:

* `buildOnStart` - Compile assets when the server starts (defaults to "true")
* `buildOnRequest` - Compile an asset every time it is requested (defaults to "false")
* `version` - Version/fingerprint asset filename when compiled (defaults to "true")

To integrate:

```js
var compiln = require('compiln');  
app.use(compiln.compile({"buildOnStart":true, "buildOnRequest":false, "version":true}));
```

What compiln will compile is dictated by what compiln plugins are being used. To compile CoffeeScript, for instance, simply install the complin CoffeeScript plugin:

```bash
npm install compiln-coffeescript
```

And tell compiln to use the plugin:

```js
var compiln_coffeescript = require('compiln-coffeescript');  
compiln.use(compiln_coffeescript);
```

The `use` method accepts four total parameters:

1. The plugin. (Required)
2. The path of the root source folder for that asset type. (Optional)
3. The path of the root destination folder for that asset type to be compiled to. (Optional)
4. An object of options for the plugin. (Optional)

### compiln.json

compiln can also be configured with a json file in the root directory named `compiln.json`:

```json
{  
  "buildOnStart": true,  
  "buildOnRequest": false,  
  "version": true,  
  "use": [  
    {  
      "plugin": "compiln-coffeescript",  
      "source": "",  
      "destination": "/public"  
    }
  ],  
  "sources": [  
    "/scripts/main.js"  
  ]  
}
```

These settings will be overwritten by any settings made when integrating the middleware.

"sources" is an array of files that should be compiled by compiln (used by the CLI). Note that the source file name uses the compiled extension (`.js`) rather than the preprocessor extension (`.coffee`).

##  Versioning

compiln has the built in ability to "version" (or "fingerprint") compiled assets. When using versioning, a source file like:

`main.js`

will compile into something like this:

`main.1234567890abcdefghijklmnopqrstuv.js`

The "version number" is an MD5 tag, and its generation is based off of the file's content. If you were to recompile the exact same file, it would have the exact same version number. This allows you to set the client-side caching of your assets to a very-long/never expiry date. If the file contents change, the client will be automatically requesting a different filename.

compiln includes a method to retrieve the versioned filename of an asset. This is especially useful if you are using a templating language that allows for function calls, like [Jade](https://github.com/visionmedia/jade). To inject the versioned filename, simply use the `versionedFile` method:

```jade
link(href="#{versionedFile('/styles/style.css')}", rel="stylesheet")
```

This will render HTML something like:

```html
<link href="/styles/style.1234567890abcdefghijklmnopqrstuv.css" rel="stylesheet">
```

## Plugins

One of the benefits of compiln is that it is an open preprocessor compiling platform - it does not specify or dictate which preprocessors to use. If you would like to use compiln to compile an asset type for which a plugin does not exist, then you can easily write a new plugin.

compiln plugins require three methods to be defined. These methods should be made available by adding them to `module.exports`:

* `module.exports.detect` - Should return an array of extensions. These are the extensions that the source files possess. The extensions **should not** include the dot (ie. `coffee`).
* `module.exports.ext` - Should return a string of the desitination extension - the extension the source files will compile into. This **should not** include the dot (ie. `js`).
* `module.exports.compile` - Accepts two parameters: `file` and `options`. `file` is the source file path. `options` will contain any options passed when the plugin is passed to compiln. This method should load the source file (ie. via `fs.readFileSync`) and return the compiled data.

The [wiki](https://github.com/redhotvengeance/compiln/wiki) keeps a list of available plugins. If you contribute a plugin, add it to the list so others can find it too.

## CLI

If you'd rather not use compiln as middleware, compiln includes a CLI to allow you to precompile your assets.

To use, install compiln globally:

```bash
npm install -g compiln
```

To build the files:

```bash
compiln build
```

Use the `-b` argument to compile without versioning.

Note that the CLI requires `compiln.json` in order to utilize plugins and know which files should be compiled.

## Contribute

1. Fork
2. Create
3. Code
4. Push
5. Submit
6. Yay!

## License

(The MIT License)

Copyright (c) 2012 Ian Lollar

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.