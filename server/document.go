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
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"syscall"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

type DocumentHandler struct {
	RestishVoid
}

type NewDocumentHandler struct {
	RestishVoid
}

func (d DocumentHandler) Get(writer http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	id := vars["id"]

	if len(id) <= 2 {
		http.Error(writer, "404 not found", http.StatusNotFound)
		return
	}

	writer.Header().Set("Content-Type", "application/json")
	http.ServeFile(writer, req, path.Join(dataRoot, "documents", id[0:2], id[2:]))
}

type Program struct {
	Version   int    `json:"version"`
	Name      string `json:"name"`
	Vertex    string `json:"vertex"`
	Fragment  string `json:"fragment"`
	IsDefault bool   `json:"isDefault"`
}

type Document struct {
	Version      int       `json:"version"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Programs     []Program `json:"programs"`
	Javascript   string    `json:"javascript"`
	CreationTime time.Time `json:"creationTime"`
}

func (d NewDocumentHandler) Post(writer http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	dec := json.NewDecoder(req.Body)

	var doc Document

	if err := dec.Decode(&doc); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	data, err := json.Marshal(doc)

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	hdata := data
	hash := Hash(hdata)

	for {
		d := path.Join(dataRoot, "documents", hash[0:2])
		p := path.Join(d, hash[2:])

		// Try to write at hash
		os.MkdirAll(d, 0755)
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)

		if err != nil {
			if err.(*os.PathError).Err == syscall.EEXIST {
				// Check if existing file contains the same data
				fdata, _ := ioutil.ReadFile(p)

				if string(fdata) == string(data) {
					break
				}

				// Otherwise it's a hash collision, add some arbitrary data
				// to hash
				hdata = append(hdata, '\n')
				hash = Hash(hdata)
			} else {
				http.Error(writer, err.Error(), http.StatusInternalServerError)
				return
			}
		} else {
			defer f.Close()

			if _, err := f.Write(data); err != nil {
				http.Error(writer, err.Error(), http.StatusInternalServerError)
				f.Close()
				return
			}

			break
		}
	}

	retval := map[string]string{
		"hash": hash,
	}

	writer.Header().Add("Content-Type", "application/json")
	enc := json.NewEncoder(writer)
	enc.Encode(retval)
}

func init() {
	router.Handle("/d/new", CORSHandler(NewRestishHandler(NewDocumentHandler{})))
	router.Handle("/d/{id:[A-Za-z0-9]+}.json", handlers.CompressHandler(CORSHandler(NewRestishHandler(DocumentHandler{}))))
}
