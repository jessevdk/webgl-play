package main

import (
	"bytes"
	"io/ioutil"
	"math/rand"
	"net/http"
	"os"
	"path"
	"syscall"

	"github.com/gorilla/mux"
)

type Storage struct {
	RestishVoid

	Directory   string
	ContentType string
}

func (s Storage) FullPath(parts ...string) string {
	args := append([]string{dataRoot, s.Directory}, parts...)
	return path.Join(args...)
}

func (s Storage) HashPath(hash string) string {
	return s.FullPath(hash[0:2], hash[2:])
}

func (s Storage) Store(data []byte) (string, error) {
	hash := hasher.Hash(data)
	extraData := []byte{}

	for {
		d := s.FullPath(hash[0:2])
		p := path.Join(d, hash[2:])

		// Try to write at hash
		os.MkdirAll(d, 0755)
		f, err := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)

		if err != nil {
			if err.(*os.PathError).Err == syscall.EEXIST {
				// Check if existing file contains the same data
				fdata, _ := ioutil.ReadFile(p)

				if bytes.Equal(fdata, data) {
					break
				}

				// Otherwise it's a hash collision, add some arbitrary data
				// to hash
				extraData = append(extraData, byte(rand.Intn(255)))
				hash = hasher.Hash(data, extraData)
			} else {
				return "", err
			}
		} else {
			defer f.Close()

			if _, err := f.Write(data); err != nil {
				return "", err
			}

			break
		}
	}

	return hash, nil
}

func (s Storage) Get(writer http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)
	id := vars["id"]

	if len(id) <= 2 {
		http.Error(writer, "404 not found", http.StatusNotFound)
		return
	}

	h := writer.Header()

	if len(s.ContentType) != 0 {
		h.Set("Content-Type", s.ContentType)
	}

	h.Set("Cache-Control", "max-age=31536000")

	http.ServeFile(writer, req, s.HashPath(id))
}
