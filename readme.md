# [git](http://git-scm.com)[npm](https://npmjs.org)
http://gitnpm.com - go to gitnpm.com/_some-package_ to be taken to an npm repository's GitHub.
- - -

Several times a day, I wind up going to npmjs.org/package/some-package to dig through and find the GitHub url. I thought it would be nice to just get booted right to the place I need to go from one url.

### under the hood
The app is hosted with Google App Engine [Managed VMs](https://cloud.google.com/appengine/docs/managed-vms), using the [google/nodejs-runtime](https://registry.hub.docker.com/u/google/nodejs-runtime) [Docker](https://docker.com/) image. [gcloud-node](https://github.com/GoogleCloudPlatform/gcloud-node) is used to interact connect to [Google Cloud Datastore](https://cloud.google.com/datastore/docs) (used as a [key-value store](https://github.com/stephenplusplus/gcloud-keystore)) and [Google BigQuery](https://cloud.google.com/bigquery/what-is-bigquery).

Each time gitnpm.com is used, an entry in a Datastore dataset is created as well as a row inserted into a BigQuery dataset. These rows can be queried by going to gitnpm.com/q/_some-package_ to see when searches have been made for a package. See http://gitnpm.com/q/q for an example.

Also, the favicon is mah baby.