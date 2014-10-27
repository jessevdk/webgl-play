package main

import (
	"fmt"
	"net/http"
	"os"
	"path"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/jessevdk/go-flags"
)

type Options struct {
	Listen   string `short:"l" long:"listen" description:"The address to listen on" default:":8000"`
	Data     string `short:"d" long:"data" description:"Root of the data directory" default:"data"`
	SiteData string `short:"s" long:"site-data" description:"Root of the site data directory" default:"site"`
}

var router = mux.NewRouter()
var options Options
var dataRoot string
var siteRoot string

func absPath(p string) string {
	if !path.IsAbs(p) {
		return path.Join(path.Dir(os.Args[0]), p)
	}

	return p
}

func main() {
	if _, err := flags.Parse(&options); err != nil {
		os.Exit(1)
	}

	dataRoot = absPath(options.Data)
	siteRoot = absPath(options.SiteData)

	router.PathPrefix("/assets/").Handler(handlers.CompressHandler(http.FileServer(http.Dir(siteRoot))))
	router.PathPrefix("/").Handler(handlers.CompressHandler(NewRestishHandler(SiteHandler{})))

	if err := http.ListenAndServe(options.Listen, router); err != nil {
		fmt.Fprintf(os.Stderr, "Error while listening: %s\n", err)
		os.Exit(1)
	}
}
