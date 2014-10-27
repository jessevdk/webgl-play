package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"

	"github.com/gorilla/handlers"
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
	router.Handle("/m/{url:.*}", handlers.CompressHandler(NewRestishHandler(&ModelHandler{
		proxy: &httputil.ReverseProxy{
			Director: redirectModelRequest,
		},
	})))
}
