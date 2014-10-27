package main

import (
	"net/http"
	"path"
)

type SiteHandler struct {
	RestishVoid
}

func (d SiteHandler) Get(writer http.ResponseWriter, req *http.Request) {
	http.ServeFile(writer, req, path.Join(siteRoot, "index.html"))
}
