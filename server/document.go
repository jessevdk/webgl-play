package main

import (
	"net/http"
	"path"

	"github.com/gorilla/mux"
)

type DocumentHandler struct {
	RestishVoid
}

func (d DocumentHandler) Get(writer http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	id := vars["id"]

	writer.Header().Set("Content-Type", "application/json")
	http.ServeFile(writer, req, path.Join(dataRoot, "documents", id))
}

func init() {
	router.Handle("/d/{id:[a-z0-9]+}.json", NewRestishHandler(DocumentHandler{}))
}
