# WebGL Playground Server
The WebGL Playground server implements is the backend for the playground
which enables document sharing and the online gallery. It also serves as
a proxy to fetch remote models.

# Building
The server is implemented in Go, to build it run:

```bash
go get -d # One time only to fetch the dependencies
go build
```

Alternatively, use `make server/server` in the top-level directory which
will issue these exact commands.

This should result in a `./server` binary which you can run to run the
service.

# Server files
The server by default serves the static site data from the
[site/](site/) directory. This directory contains a copy of the toplevel `site/`
directory, with a few small path changes to make it work in a server
setting. The location of this directory can be changed using the `--site-data`
command line flag.

The [data/](data/) directory is used by default to store all of the site data,
including uploaded documents, the gallery database and the uploaded
screenshots for items in the gallery. The location of this directory can
be changed using the `--data` command line flag.

# Server flags
The main server flags are:

  * `--listen ADDRESS`: the address to listen on, defaults to `:8000`.
  * `--data DIR`: the directory where service data will be stored, defaults
  to `./data/`.
  * `--site-data DIR`: the directory where the static site data is located,
  defaults to `./site/`.
  * `--cors-domain DOMAIN`: a domain from which to allow CORS requests.
  * `--smtp-address HOST:PORT`: the address of the SMTP server to use for
  sending gallery token requests e-mails. Note that for the moment the
  playground does not use any authentication when connecting to the SMTP
  server. The default SMTP server address is `localhost:25`.
  * `--public-host HOST`: the publicly accessible address of the playground
  website. This is primarily used in the token request e-mails to link to
  the playground.

See `./server --help` for all available server flags.
