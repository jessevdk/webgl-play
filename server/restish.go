package main

import (
	"net/http"
)

type Restish interface {
	Get(http.ResponseWriter, *http.Request)
	Post(http.ResponseWriter, *http.Request)
	Put(http.ResponseWriter, *http.Request)
	Delete(http.ResponseWriter, *http.Request)
	Options(http.ResponseWriter, *http.Request)
}

type RestishVoid struct {
}

type RestishHandler struct {
	restish Restish
}

func (r RestishVoid) Get(writer http.ResponseWriter, req *http.Request) {
	http.NotFound(writer, req)
}

func (r RestishVoid) Post(writer http.ResponseWriter, req *http.Request) {
	http.NotFound(writer, req)
}

func (r RestishVoid) Put(writer http.ResponseWriter, req *http.Request) {
	http.NotFound(writer, req)
}

func (r RestishVoid) Delete(writer http.ResponseWriter, req *http.Request) {
	http.NotFound(writer, req)
}

func (r RestishVoid) Options(writer http.ResponseWriter, req *http.Request) {
	http.NotFound(writer, req)
}

func NewRestishHandler(r Restish) http.Handler {
	return RestishHandler{
		restish: r,
	}
}

func (r RestishHandler) ServeHTTP(writer http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case "GET", "HEAD":
		r.restish.Get(writer, req)
	case "POST":
		r.restish.Post(writer, req)
	case "PUT":
		r.restish.Put(writer, req)
	case "OPTIONS":
		r.restish.Options(writer, req)
	case "DELETE":
		r.restish.Delete(writer, req)
	default:
		http.NotFound(writer, req)
	}
}
