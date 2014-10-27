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
	router.Handle("/d/new", NewRestishHandler(NewDocumentHandler{}))
	router.Handle("/d/{id:[A-Za-z0-9]+}.json", handlers.CompressHandler(NewRestishHandler(DocumentHandler{})))
}
