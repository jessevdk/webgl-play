/*
 * Copyright (c) 2014 Jesse van den Kieboom. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 *      copyright notice, this list of conditions and the following disclaimer
 *      in the documentation and/or other materials provided with the
 *      distribution.
 *    * Neither the name of Google Inc. nor the names of its
 *      contributors may be used to endorse or promote products derived from
 *      this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

package main

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"strings"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/jessevdk/go-flags"
)

type Options struct {
	Listen      string `short:"l" long:"listen" description:"The address to listen on" default:":8000"`
	Data        string `short:"d" long:"data" description:"Root of the data directory" default:"data"`
	SiteData    string `short:"s" long:"site-data" description:"Root of the site data directory" default:"site"`
	CORSDomain  string `short:"c" long:"cors-domain" description:"An external domain for which to allow cross-requests"`
	SMTPAddress string `short:"e" long:"smtp-address" description:"The address (hostname[:port]) of the SMTP server" default:"localhost:25"`
	PublicHost  string `short:"p" long:"public-host" description:"The public playground host address (e.g. http://webgl.example.com/)" default:"http://localhost:8000/"`
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

type LimitedRequestHandler struct {
}

func (l LimitedRequestHandler) ServeHTTP(wr http.ResponseWriter, req *http.Request) {
	// Limit requests to 2MB
	req.Body = http.MaxBytesReader(wr, req.Body, 1<<21)
	router.ServeHTTP(wr, req)
}

type HandlerWrappers int

const (
	WrapNone HandlerWrappers = 1 << iota
	WrapCORS
	WrapCompress
)

func MakeHandler(h interface{}, wrap HandlerWrappers) http.Handler {
	var hh http.Handler

	if rest, ok := h.(Restish); ok {
		hh = NewRestishHandler(rest)
	} else {
		hh = h.(http.Handler)
	}

	if wrap&WrapCORS != 0 {
		hh = CORSHandler(hh)
	}

	if wrap&WrapCompress != 0 {
		hh = handlers.CompressHandler(hh)
	}

	return hh
}

func main() {
	if _, err := flags.Parse(&options); err != nil {
		os.Exit(1)
	}

	if !strings.ContainsRune(options.SMTPAddress, ':') {
		options.SMTPAddress += ":25"
	}

	dataRoot = absPath(options.Data)

	if options.SiteData != "-" {
		siteRoot = absPath(options.SiteData)

		router.PathPrefix("/assets/").Handler(MakeHandler(http.FileServer(http.Dir(siteRoot)), WrapCompress))
		router.PathPrefix("/").Handler(MakeHandler(NewRestishHandler(SiteHandler{}), WrapCompress))
	}

	db.Open()

	srv := &http.Server{
		Addr:           options.Listen,
		Handler:        LimitedRequestHandler{},
		ReadTimeout:    10 * time.Second,
		WriteTimeout:   10 * time.Second,
		MaxHeaderBytes: 1 << 20,
	}

	if err := srv.ListenAndServe(); err != nil {
		fmt.Fprintf(os.Stderr, "Error while listening: %s\n", err)
		os.Exit(1)
	}
}
