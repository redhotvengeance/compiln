var fs = require('node-fs');
var path = require('path');
var async = require('async');
var crypto = require('crypto');

var root = "";
var loadedPlugins = [];
var config = {};
var manifest = {};
var extensions = {};
var builtOnStart = false;

var initialize = function(options) {
  async.parallel([
    function(callback) {
      fs.exists(path.normalize(root + "/compiln.json"), function(exists) {
        if (exists) {
          fs.readFile(path.normalize(root + "/compiln.json"), 'utf8', function(error, configData) {
            if (error) throw error;

            try {
              config = JSON.parse(configData);
            }
            catch(error) {
              throw error;
            }

            callback();
          });
        }
        else {
          callback();
        }
      });
    },
    function(callback) {
      fs.exists(path.normalize(root + "/manifest.json"), function(exists) {
        if (exists) {
          fs.readFile(path.normalize(root + "/manifest.json"), 'utf8', function(error, manifestData) {
            if (error) throw error;

            try {
              manifest = JSON.parse(manifestData);
            }
            catch(error) {
              throw error;
            }

            callback();
          });
        }
        else {
          callback();
        }
      });
    }
  ],
  function(err, results) {
    if (typeof options !== "undefined" && options !== null) {
      if (typeof options.buildOnStart !== "undefined" && options.buildOnStart !== null) config.buildOnStart = options.buildOnStart;
      if (typeof options.buildOnRequest !== "undefined" && options.buildOnRequest !== null) config.buildOnRequest = options.buildOnRequest;
      if (typeof options.version !== "undefined" && options.version !== null) config.version = options.version;
      if (typeof options.destinationRoot !== "undefined" && options.destinationRoot !== null) config.destination = options.destinationRoot;
      if (typeof options.sources !== "undefined" && options.sources !== null) config.sources = options.sources;
    }

    if (!(typeof config.buildOnStart !== "undefined" && config.buildOnStart !== null)) config.buildOnStart = true;
    if (!(typeof config.buildOnRequest !== "undefined" && config.buildOnRequest !== null)) config.buildOnRequest = false;
    if (!(typeof config.version !== "undefined" && config.version !== null)) config.version = true;

    if (typeof config.use !== "undefined" && config.use !== null) {
      for (var i = 0; i < config.use.length; i++) {
        var exists = false;

        for (var p = 0; p < loadedPlugins.length; p++) {
          if (require(config.use[i].plugin) === loadedPlugins[p].plugin) {
            exists = true;

            break;
          }
        }

        if (!exists) {
          module.exports.use(require(config.use[i].plugin), config.use[i].source, config.use[i].destination, config.use[i].options);
        }
      }
    }

    for (var i = 0; i < loadedPlugins.length; i++) {
      var plugin = loadedPlugins[i];
      var pluginExtension = loadedPlugins[i].plugin.ext();

      if (!pluginExtension) {
        var pluginExtensions = loadedPlugins[i].plugin.detect();

        for (var e = 0; e < pluginExtensions.length; e++) {
          var extension = pluginExtensions[e];

          if (!extensions[extension]) {
            extensions[extension] = [];
          }

          extensions[extension].push(plugin);
        }
      }
      else {
        if (!extensions[pluginExtension]) {
          extensions[pluginExtension] = [];
        }

        extensions[pluginExtension].push(plugin);
      }
    }

    if (config.buildOnStart) {
      build(function(error) {
        if (error) throw error;

        builtOnStart = true;
      });
    }
  });
};

var parse = function(url) {
  var extRegEx = /\.[0-9a-z]+$/i;
  var pathRegEx = /[^\.]+/;

  if (extRegEx.test(url) && pathRegEx.test(url)) {
    var filePath = pathRegEx.exec(url)[0].substring(0, url.lastIndexOf('/'));
    var filename = pathRegEx.exec(url)[0].substring(url.lastIndexOf('/') + 1, url.length);
    var fileExtension = extRegEx.exec(url)[0].replace('.', '');

    return {path:filePath, name:filename, ext:fileExtension};
  }
  else {
    return null;
  }
};

var retrieveExistingFile = function (url, loadManifest) {
  if (loadManifest) {
    try {
      manifest = JSON.parse(fs.readFileSync(path.normalize(root + "/manifest.json"), 'utf8'));
    }
    catch(error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  var file = null;

  if (typeof manifest[url] !== "undefined" && manifest[url] !== null) {
    var sourcePath = root + manifest[url].root + manifest[url].filename;

    if (fs.existsSync(sourcePath)) {
      file = manifest[url].filename;
    }
  }

  return file;
}

var compile = function(url, version, callback) {
  var pathElements = parse(url);

  if (!config.buildOnRequest) {
    var filename = retrieveExistingFile(url);

    if (!filename) {
      generate(pathElements.path, pathElements.name, pathElements.ext, version, true, function(error, file, data) {
        callback(error, file);
      });
    }
    else {
      callback(error, filename);
    }
  }
  else {
    generate(pathElements.path, pathElements.name, pathElements.ext, version, true, function(error, file, data) {
      callback(error, file);
    });
  }
};

var generate = function(filePath, filename, fileExtension, version, save, callback) {
  var plugins = extensions[fileExtension];

  if (plugins) {
    for (var i = 0; i < plugins.length; i++) {
      var plugin = plugins[i].plugin;
      var pluginSource = plugins[i].source;
      var pluginDest = config.destinationRoot + plugins[i].dest;
      var pluginOptions = plugins[i].options || {};
      var pluginExtensions = plugin.detect();

      for (var e = 0; e < pluginExtensions.length; e++) {
        var extension = pluginExtensions[e];
        var sourcePath = path.normalize(root + '/' + pluginSource + '/' + filePath + '/' + filename + '.' + extension);

        fs.exists(sourcePath, function(exists) {
          if (exists) {
            plugin.compile(sourcePath, pluginOptions, function(error, compiledData) {
              if (error) throw error;

              var destinationPath = path.normalize(root + '/' + pluginDest + '/' + filePath);
              var destinationFilename = filename;

              if (version && config.version) {
                destinationFilename += "." + makeVersionNumber(compiledData);
              }

              destinationFilename += "." + fileExtension;

              if (save) {
                makeFile(compiledData, destinationPath, destinationFilename, function(error, file) {
                  if (error) throw error;

                  var url = path.normalize(filePath + "/" + filename + "." + fileExtension);
                  var source = path.normalize(filePath + "/" + filename + "." + extension);

                  updateManifest(url, source, pluginDest, path.normalize(filePath + '/' + destinationFilename), function(error) {
                    callback(null, file, compiledData);
                  });
                });
              }
              else {
                callback(null, null, compiledData);
              }
            });
          }
        });
      }
    }
  }
};

var makeVersionNumber = function(data) {
  return crypto.createHash('md5').update(data).digest('hex');
};

var makeFile = function(data, filePath, filename, callback) {
  fs.mkdir(filePath, 0777, true, function(error) {
    if (error) throw error;

    fs.writeFile(path.normalize(filePath + '/' + filename), data, function(error) {
      if (error) throw error;

      callback(null, path.normalize(filePath + '/' + filename));
    });
  });
};

var updateManifest = function (fileUrl, fileSource, fileRoot, filename, callback) {
  manifest[fileUrl] = {
    "source": fileSource,
    "root": fileRoot,
    "filename": filename
  }

  retrieveExistingFile();

  fs.writeFile(path.normalize(root + "/manifest.json"), JSON.stringify(manifest), function(error) {
    if (error) throw error;

    callback(null);
  });
};

var build = function(callback) {
  if (typeof config.sources !== "undefined" && config.sources !== null) {
    for (var i = 0; i < config.sources.length; i++) {
      var pathElements = parse(config.sources[i]);

      generate(pathElements.path, pathElements.name, pathElements.ext, config.version, true, function(error, file, data) {
        callback(error);
      });
    }
  }
};

module.exports.use = function(plugin, source, dest, options) {
  if (!(typeof source !== "undefined" && source !== null)) {
    source = "";
  }

  if (!(typeof dest !== "undefined" && dest !== null)) {
    dest = "/public";
  }

  loadedPlugins.push({
    plugin: plugin,
    source: source,
    dest: dest,
    options: options
  });
};

module.exports.compile = function(options) {
  root = path.resolve("./");

  initialize(options);

  return function(req, res, next) {
    req.app.locals({
      versionedFile: function(filename) {
        var file = retrieveExistingFile(filename, true);

        if (!file) {
          file = filename;
        }

        return file;
      }
    });

    var parsedUrl = parse(req.url);

    if (parsedUrl) {
      if (extensions[parsedUrl.ext]) {
        generate(parsedUrl.path, parsedUrl.name, parsedUrl.ext, false, false, function(error, file, data) {
          if (error) throw error;

          res.send(data);
        });
      }
      else {
        function checkIfBuilt() {
          if (builtOnStart) {
            next();
          }
          else {
            setTimeout(checkIfBuilt, 100);
          }
        }

        if (config.buildOnStart) {
          checkIfBuilt();
        }
        else {
          next();
        }
      }
    }
    else {
      next();
    }
  };
};
