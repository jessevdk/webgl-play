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
	"errors"
	"net/http"
	"time"
)

var DocumentStorage = Storage{
	Directory:   "documents",
	ContentType: "application/json",
}

var validLicenses = map[string]bool{
	"CC 0":        true,
	"CC BY":       true,
	"CC BY-NC":    true,
	"CC BY-SA":    true,
	"CC BY-NC-SA": true,
}

type NewDocumentHandler struct {
	RestishVoid
}

type Program struct {
	Version   int    `json:"version"`
	Name      string `json:"name"`
	Vertex    string `json:"vertex"`
	Fragment  string `json:"fragment"`
	IsDefault bool   `json:"isDefault"`
}

type Author struct {
	Name    string `json:"name"`
	License string `json:"license"`
	Year    int    `json:"year"`
}

type Document struct {
	Version      int       `json:"version"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Programs     []Program `json:"programs"`
	Javascript   string    `json:"javascript"`
	CreationTime time.Time `json:"creationTime"`
	Authors      []Author  `json:"authors"`
}

type NewDocumentRequest struct {
	Document Document `json:"document"`
	Author   string   `json:"author"`
	License  string   `json:"license"`
}

type NewDocumentResponse struct {
	Hash string `json:"hash"`
}

func (p *Program) Validate() error {
	if len(p.Name) == 0 {
		return errors.New("Program does not have a name")
	}

	if len(p.Vertex) == 0 {
		return errors.New("Program does not have a vertex shader")
	}

	if len(p.Fragment) == 0 {
		return errors.New("Program does not have a fragment shader")
	}

	return nil
}

func (d *Document) Validate() error {
	if len(d.Title) == 0 {
		return errors.New("Document does not have a title")
	}

	if len(d.Programs) == 0 {
		return errors.New("Document does not have any programs")
	}

	hasDefault := false

	for _, p := range d.Programs {
		if p.IsDefault {
			if hasDefault {
				return errors.New("Only one program can be the default program")
			}

			hasDefault = true
		}

		if err := p.Validate(); err != nil {
			return err
		}
	}

	if !hasDefault {
		return errors.New("Default program not specified")
	}

	if len(d.Programs) == 0 {
		return errors.New("Document does not have a javascript source")
	}

	return nil
}

func (d *Document) ValidatePublication() error {
	if err := d.Validate(); err != nil {
		return err
	}

	if len(d.Description) == 0 {
		return errors.New("Document does not have a description")
	}

	return nil
}

func (a *Author) Validate() error {
	if !validLicenses[a.License] {
		return errors.New("Invalid license")
	}

	if len(a.Name) == 0 && a.License != "CC 0" {
		return errors.New("License requires author")
	}

	return nil
}

func (d *Document) Prepare(a Author) error {
	if err := d.Validate(); err != nil {
		return err
	}

	if err := a.Validate(); err != nil {
		return err
	}

	if len(d.Authors) == 0 || d.Authors[len(d.Authors)-1] != a {
		d.Authors = append(d.Authors, a)
	}

	return nil
}

func (d *Document) Store() (string, error) {
	data, err := json.Marshal(d)

	if err != nil {
		return "", err
	}

	return DocumentStorage.Store(data)
}

func (d NewDocumentHandler) Post(writer http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	dec := json.NewDecoder(req.Body)

	var ureq NewDocumentRequest

	if err := dec.Decode(&ureq); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	doc := ureq.Document

	author := Author{
		Name:    ureq.Author,
		License: ureq.License,
		Year:    time.Now().Year(),
	}

	if err := doc.Prepare(author); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	hash, err := doc.Store()

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	d.RespondJSON(writer, NewDocumentResponse{Hash: hash})
}

func init() {
	router.Handle("/d/new", MakeHandler(NewDocumentHandler{}, WrapCORS))
	router.Handle("/d/{id:[A-Za-z0-9]+}.json", MakeHandler(DocumentStorage, WrapCompress|WrapCORS))
}
