"use strict"

var express = require("express")
var gcloud = require("gcloud")({ projectId: "gitnpm", keyFilename: "./key.json" })
var githubUrl = require("github-url-from-git")
var keystore = require("gcloud-keystore")
var packageJson = require("package-json")
var through = require("through2")

var logDataset = keystore(gcloud.datastore.dataset())
var logTable = gcloud.bigquery().dataset("gitnpm").table("npm_packages")

var validatePkg = function (req, res, next) {
  if (/[^\w-]/.test(req.params.pkg)) return res.end("this looks funky. try something else")
  next()
}

express()

  // display a form to accept a package name
  .get("/", function (req, res) {
    if (req.query.pkg) return res.redirect("/" + req.query.pkg)

    res.write("<div style='margin-top:40vh;text-align:center'>")
    res.write("  <form method=get action=/ style='font:3em monospace'>")
    res.write("    <span style='color:#F08'>$</span> npm repo")
    res.write("    <input name=pkg placeholder=pkgname size=10 style='font:1em monospace;color:#777;border:0'>")
    res.end()
  })

  // redirect to a package's github
  .get("/:pkg", validatePkg, function (req, res) {
    var pkg = req.params.pkg

    packageJson(pkg, function (err, json) {
      if (err) return res.end(pkg + " isn't a thing... go make it?")

      var url = githubUrl(json.repository.url)
      res.redirect(url)

      try/*logging the search*/{
        logDataset.set(pkg, url, console.log)
        logTable.insert({ name: pkg, url: url, created: (new Date).toJSON() }, console.log)
      } catch (e) {}
    })
  })

  // query a package
  .get("/q/:pkg", validatePkg, function (req, res) {
    var pkg = req.param("pkg")

    res.write("<h1>redirects from gitnpm.com/" + pkg + "</h1>")
    res.write("<em>running query...</em> ")

    logTable
      .query("SELECT * FROM npm_packages WHERE name='" + pkg + "' ORDER BY created DESC")
      .pipe(through.obj(function (row, enc, next) {
        this.push("<p>" + new Date(row.created * 1000) + "</p>") && next()
      }))
      .on("end", res.write.bind(res, "done."))
      .pipe(res)
  })

  .listen(8080)