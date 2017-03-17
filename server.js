'use strict'

var express = require('express')
var gcloud = require('google-cloud')({ projectId: 'git-npm', keyFilename: './key.json' })
var githubUrl = require('github-url-from-git')
var keystore = require('gcloud-kvstore')
var packageJson = require('package-json')
var through = require('through2')
var validateNpmPackageName = require('validate-npm-package-name')

var logDataset = keystore(gcloud.datastore.dataset())
var logTable = gcloud.bigquery().dataset('gitnpm').table('npm_packages')

var parseUrl = function (pkg) {
  var repository = pkg.repository

  if (!repository) return 'https://npmjs.org/package/' + pkg.name
  if (repository.url) return githubUrl(repository.url)

  var hosts = {
    gist: {
      pattern: /gist:(\w+)/,
      getUrl: function (match) {
        return 'https://gist.github.com/' + match[1]
      }
    },
    bitbucket: {
      pattern: /bitbucket:([^/]+)\/(.+)/,
      getUrl: function (match) {
        return 'https://bitbucket.org/' + match[1] + '/' + match[2]
      }
    },
    gitlab: {
      pattern: /gitlab:([^/]+)\/(.+)/,
      getUrl: function (match) {
        return 'https://gitlab.com/' + match[1] + '/' + match[2]
      }
    },
    github: {
      pattern: /([^/]+)\/(.+)/,
      getUrl: function (match) {
        return 'https://github.com/' + match[1] + '/' + match[2]
      }
    }
  }

  for (var host in hosts) {
    var pattern = hosts[host].pattern
    var getUrl = hosts[host].getUrl

    if (pattern.test(repository)) return getUrl(pattern.exec(repository))
  }
}

var validatePkgName = function (req, res, next) {
  var isNameValid = validateNpmPackageName(req.params.pkgName)
  if (!isNameValid.validForNewPackages && !isNameValid.validForOldPackages) {
    return res.end('this looks funky. try something else')
  }
  next()
}

var getPkgInfo = function (req, res, next) {
  var pkgName = req.params.pkgName

  packageJson(pkgName, function (err, json) {
    if (err) return res.end(pkgName + ' isn\'t a thing... go make it?')

    var latestVersion = json['dist-tags'] && json['dist-tags'].latest
    res._pkgInfo = {
      all: json,
      latest: latestVersion ? json.versions[latestVersion] : {}
    }

    next()
  })
}

var app = express()

app
  .set('json spaces', 2)

  // display a form to accept a package name
  .get('/', function (req, res) {
    if (req.query.pkgName) return res.redirect('/' + req.query.pkgName)

    res.write('<div style="margin-top:40vh;text-align:center">')
    res.write('  <form method=get action=/ style="font:3em monospace">')
    res.write('    <span style="color:#F08">$</span> npm repo')
    res.write('    <input name=pkgName placeholder=pkgname size=10 style="font:1em monospace;color:#777;border:0">')
    res.end()
  })

  // redirect to a package's github
  .get('/:pkgName', validatePkgName, getPkgInfo, function (req, res) {
    var pkgName = req.params.pkgName
    var pkg = res._pkgInfo
    var url = parseUrl(pkg.latest)

    res.redirect(url)

    logDataset.set(pkgName, url, console.log)
    logTable.insert({ name: pkgName, url: url, created: (new Date()).toJSON() }, console.log)
  })

  .get('/:pkgName/json', validatePkgName, getPkgInfo, function (req, res) {
    var pkg = res._pkgInfo
    res.json(pkg.latest || pkg.all)
    res.end()
  })
  .get('/:pkgName/:version/json', validatePkgName, getPkgInfo, function (req, res) {
    var pkg = res._pkgInfo
    var version = req.params.version.replace(/^v/, '')

    var json = pkg.all.versions[version]

    if (!json) {
      res.json(new Error('Could not load requested version'))
    } else {
      res.json(json)
    }

    res.end()
  })

  .get('/:pkgName/json/:prop', validatePkgName, getPkgInfo, function (req, res) {
    var pkg = res._pkgInfo
    var prop = req.params.prop

    if (!pkg.latest) {
      res.json(new Error('Could not parse property'))
    } else {
      res.json(pkg.latest[prop])
    }

    res.end()
  })
  .get('/:pkgName/:version/json/:prop', validatePkgName, getPkgInfo, function (req, res) {
    var pkg = res._pkgInfo
    var version = req.params.version.replace(/^v/, '')
    var prop = req.params.prop

    var json = pkg.all.versions[version]

    if (!json) {
      res.json(new Error('Could not load requested version'))
    } else {
      res.json(json[prop])
    }

    res.end()
  })

  .get('/:pkgName/hits', validatePkgName, function (req, res) {
    var pkgName = req.params.pkgName

    res.write('<h1>redirects from gitnpm.com/' + pkgName + '</h1>')
    res.write('<em>running query...</em> ')

    logTable
      .query('SELECT * FROM npm_packages WHERE name="' + pkgName + '" ORDER BY created DESC')
      .pipe(through.obj(function (row, enc, next) {
        next(null, '<p>' + new Date(row.created * 1000) + '</p>')
      }))
      .on('prefinish', res.write.bind(res, 'done.'))
      .pipe(res)
  })

app.listen(8080)
