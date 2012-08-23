var fs = require('node-fs');
var path = require('path');
var crypto = require('crypto');

var root = "";
var plugins = [];
var config = {};
var manifest = {};

var initialize = function(options)
{
  try
  {
    config = JSON.parse(fs.readFileSync(path.normalize(root + "/compiln.json"), 'utf8'));
  }
  catch(error)
  {
    if (error.code !== 'ENOENT') throw error;
  }

  try
  {
    manifest = JSON.parse(fs.readFileSync(path.normalize(root + "/manifest.json"), 'utf8'));
  }
  catch(error)
  {
    if (error.code !== 'ENOENT') throw error;
  }

  if (typeof options !== "undefined" && options !== null)
  {
    if (typeof options.buildOnStart !== "undefined" && options.buildOnStart !== null) config.buildOnStart = options.buildOnStart;
    if (typeof options.buildOnRequest !== "undefined" && options.buildOnRequest !== null) config.buildOnRequest = options.buildOnRequest;
    if (typeof options.version !== "undefined" && options.version !== null) config.version = options.version;
  }

  if (!(typeof config.buildOnStart !== "undefined" && config.buildOnStart !== null)) config.buildOnStart = true;
  if (!(typeof config.buildOnRequest !== "undefined" && config.buildOnRequest !== null)) config.buildOnRequest = false;
  if (!(typeof config.version !== "undefined" && config.version !== null)) config.version = true;

  if (typeof config.use !== "undefined" && config.use !== null)
  {
    for (var i = 0; i < config.use.length; i++)
    {
      var exists = false;

      for (var p = 0; p < plugins.length; p++)
      {
        if (require(config.use[i].plugin) === plugins[p].plugin)
        {
          exists = true;

          break;
        }
      }

      if (!exists)
      {
        module.exports.use(require(config.use[i].plugin), config.use[i].source, config.use[i].destination, config.use[i].options);
      }
    }
  }

  if (config.buildOnStart)
  {
    build();
  }
};

var build = function()
{
  if (typeof config.sources !== "undefined" && config.sources !== null)
  {
    for (var i = 0; i < config.sources.length; i++)
    {
      generate(config.sources[i], config.version);
    }
  }
};

var compile = function(url, version)
{
  if ((typeof manifest[url] !== "undefined" && manifest[url] !== null) && !config.buildOnRequest)
  {
    try
    {
      var sourcePath = root + manifest[url].root + manifest[url].filename;

      fs.statSync(sourcePath);
    }
    catch (error)
    {
      if (error.code === 'ENOENT')
      {
        return generate(url, version);
      }
      else
      {
        throw error;
      }
    }

    return manifest[url].filename;
  }
  else
  {
    return generate(url, version);
  }
};

var generate = function(url, version)
{
  var extRegEx = /\.[0-9a-z]+$/i;
  var pathRegEx = /[^\.]+/;

  if (extRegEx.test(url) && pathRegEx.test(url))
  {
    var fileExt = extRegEx.exec(url)[0].replace('.', '');
    var filePath = pathRegEx.exec(url)[0];

    for (var i = 0; i < plugins.length; i++)
    {
      var plugin = plugins[i].plugin;

      if (plugin.ext() === fileExt)
      {
        var extensions = plugin.detect();

        for (var e = 0; e < extensions.length; e++)
        {
          var sourcePath = path.normalize(root + '/' + plugins[i].source + '/' + filePath + '.' + extensions[e]);
          
          try
          {
            var sourceStats = fs.statSync(sourcePath);

            var options = {};

            if (typeof plugins[i].options !== undefined && plugins[i].options !== null)
            {
              options = plugins[i].options;
            }

            var compiledData = plugin.compile(sourcePath, options);
            var dest = path.normalize(root + '/' + plugins[i].dest + '/' + filePath);
            var fileVersion = "";

            if (version && config.version)
            {
              fileVersion = "." + crypto.createHash('md5').update(compiledData).digest('hex');
            }

            dest = path.normalize(dest + fileVersion + '.' + plugin.ext());
            fs.mkdirSync(path.normalize(root + '/' + plugins[i].dest + '/' + url.substring(0, url.lastIndexOf('/'))), 0777, true);
            fs.writeFileSync(dest, compiledData);

            var filename = filePath + fileVersion + '.' + plugin.ext();

            manifest[url] = {
              "source": filePath + '.' + extensions[e],
              "root": plugins[i].dest,
              "filename": filename
            };

            fs.writeFileSync(path.normalize(root + "/manifest.json"), JSON.stringify(manifest));

            return filename;
          }
          catch (error)
          {
            if (error.code !== 'ENOENT')
            {
              throw error;
            }
          }
        }
      }
    }
  }
};

module.exports.use = function(plugin, source, dest, options)
{
  if (!(typeof source !== "undefined" && source !== null))
  {
    source = "";
  }

  if (!(typeof dest !== "undefined" && dest !== null))
  {
    dest = "/public";
  }

  plugins.push({
    plugin: plugin,
    source: source,
    dest: dest,
    options: options
  });
};

module.exports.compile = function(options)
{
  root = path.resolve("./");

  initialize(options);

  return function(req, res, next)
  {
    if (req.app.helpers) {
      req.app.helpers({
        versionedFile: function(filename)
        {
          return compile(filename, true);
        }
      });
    }
    else
    {
      req.app.locals({
        versionedFile: function(filename)
        {
          return compile(filename, true);
        }
      });
    }

    compile(req.url);
    
    next();
  };
};
