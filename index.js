"use strict"

var express = require("express")
var packageJson = require("package-json")
var githubUrl = require("github-url-from-git")
var through = require("through2")
var gcloud = require("gcloud")({projectId: "gitnpm", keyFilename: "./key.json"})

var pkgs = require("gcloud-keystore")(gcloud.datastore.dataset())
var logTable = gcloud.bigquery().dataset("gitnpm").table("npm_packages")

function validPkg(pkg) { return !(/[^\w-]/.test(pkg)) }

express()
  .get("/", function (req, res) { res.end("go to /_package_ to be redirected") })
  .get("/:pkg", function (req, res) {
    var pkg = req.param("pkg")
    if (!validPkg(pkg)) return res.end("this looks funky. try something else")

    packageJson(pkg, function (err, json) {
      if (err) return res.end(pkg + " isn't a thing... go make it?")

      var url = githubUrl(json.repository.url)

      res.writeHead(302, { Location: url })
      res.end()

      pkgs.set(pkg, url, console.log)
      logTable.insert({ name: pkg, url: url, created: (new Date).toJSON() }, console.log)
    })
  })
  .get("/q/:pkg", function (req, res) {
    var pkg = req.param("pkg")
    if (!validPkg(pkg)) return res.end("this looks funky. try something else")

    res.write("<h1>redirects</h1>")
    res.write("<em>running query... </em>")

    logTable
      .query("SELECT * FROM npm_packages WHERE name='" + pkg + "' ORDER BY created DESC")
      .pipe(through.obj(function (row, enc, next) {
        this.push("<p>" + new Date(row.created * 1000) + "</p>") && next()
      }))
      .on("end", res.write.bind(res, "done."))
      .pipe(res)
  })
  .listen(8080)
