# Installation Instructions
WebGL Playground can be installed in a number of different ways, depending on your specific
use case.

## Simple local usage
The most simple use case is that of local usage. To use the WebGL Playground locally where
the repository has been cloned, simply point your browser to the [site/index.html]() file. Some
features are not available when running the playground from a local/file url, most notably:

1. Loading the default or external models is disabled (XHR requests are not allowed). You
   can still upload local models from your local file system.
2. Sharing of documents is not possible.
3. Publication of documents is not possible.

## Dynamic site with local repository
To enable loading of models, document sharing and publishing, you have to run `server/server`.
After the initial clone of the playground, run `make server` first to build the server.
The server is implemented using `go`, so you will have to make sure to have `go` installed
first, or building will fail. By default, the server will start serving requests on
`localhost:8000`, but this can be changed with command line options (see `server/server -h`).
See also [server/README.md]() for more information.

## Static site with remote repository
Most use cases for running the WebGL Playground are covered by the first two options. A third
possibility is to split the frontend (serving static files) with the backend (storing shared
and published documents). There are several steps involved in doing so:

1. Copy the files from [site/]() to your frontend server and let it serve the files there
   statically.
2. Create a `js/settings.js` file in the directory of the previous step, with a contents
   similar to the file [js/github/settings.js](). This configures the frontend application
   code to use a different backend.
3. Run `server/server` on your backend, specifying the frontend domain with the `-c` option.
   This enables cross-site request authorization using CORS for the specified domain.
