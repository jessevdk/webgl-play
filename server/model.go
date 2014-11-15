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
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"

	"github.com/gorilla/mux"
)

type ModelHandler struct {
	RestishVoid

	proxy *httputil.ReverseProxy
}

func (d *ModelHandler) Get(writer http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)

	u, err := url.Parse(vars["url"])

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	if !u.IsAbs() {
		if options.SiteData == "-" {
			http.Error(writer, "404 not found", http.StatusNotFound)
			return
		}

		root := path.Join(siteRoot, "assets", "models")
		filename := path.Clean(path.Join(root, u.Path))

		if !strings.HasPrefix(filename, root+"/") {
			http.Error(writer, "404 not found", http.StatusNotFound)
			return
		}

		// Load from local file
		writer.Header().Set("Content-Type", "text/plain")
		http.ServeFile(writer, req, filename)
	} else {
		d.proxy.ServeHTTP(writer, req)
	}
}

func redirectModelRequest(r *http.Request) {
	vars := mux.Vars(r)
	r.URL, _ = url.Parse(vars["url"])
}

func init() {
	router.Handle("/m/{url:.*}", MakeHandler(&ModelHandler{
		proxy: &httputil.ReverseProxy{
			Director: redirectModelRequest,
		},
	}, WrapCompress|WrapCORS))
}
