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
	"encoding/json"
	"log"
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

func (r RestishVoid) RespondJSON(writer http.ResponseWriter, v interface{}) {
	writer.Header().Add("Content-Type", "application/json")
	enc := json.NewEncoder(writer)

	if err := enc.Encode(v); err != nil {
		log.Printf("Failed to encode json response: %v", err)
	}
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
