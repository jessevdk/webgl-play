# Build Instructions
By default, all built files are distributed in the git repository (in [site/](site/)) and you will
not need to rebuild the playground for normal usage. If you would like to develop for the
playground however, you will need to build the site after making changes.


## Dependencies
WebGL Playground relies on a number of npm modules and sass to build the final website. The
only prerequisite dependencies required for building are:

1. npm (node)
2. gem (ruby)
3. go (for building the server)

The playground uses `make` to automatically install remaining npm module dependencies and
ruby gem dependencies when needed, and you will only need to make sure to have the above
programs installed before running `make`.

## Building
To build all components of the playground, simply run `make`. Any required dependencies
(other than the ones listed above) are installed as needed, and the various site components
are generated. The two outputs of the build process are:

1. [site/](site/): containing the final static website files
2. [server/server](server/): the site server

Note that you can build individual components by running respectively
`make local-site` and `make server`.

## Automatic Rebuild
During development, it is often useful to automatically rebuild the site whenever
local sources are changed. The `Makefile` includes a `watch` target which watches for
changes in files and issues commands to rebuild the site as needed. The `watch` target
uses `watchman` ([https://facebook.github.io/watchman/]()) which has to be installed.
