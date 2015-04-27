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
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
)

const DefaultGalleryLimit = 10
const MaximumGalleryLimit = 50

type NewGalleryHandler struct {
	RestishVoid
}

type UpdateGalleryHandler struct {
	RestishVoid
}

type GalleryHandler struct {
	RestishVoid
}

type TokenRequest struct {
	Email  string `json:"email"`
	Title  string `json:"title"`
	Author string `json:"author"`
}

func (g NewGalleryHandler) Post(writer http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	dec := json.NewDecoder(req.Body)

	var treq TokenRequest

	if err := dec.Decode(&treq); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	if !strings.ContainsRune(treq.Email, '@') {
		http.Error(writer, "Invalid e-mail address", http.StatusInternalServerError)
		return
	}

	if len(treq.Title) == 0 {
		http.Error(writer, "Empty title specified", http.StatusInternalServerError)
		return
	}

	if len(treq.Author) == 0 {
		treq.Author = "Anonymous"
	}

	// Generate a new random token string
	tok, err := db.NewRequest()

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	publicHost := options.PublicHost

	if strings.HasPrefix(publicHost, "//") {
		publicHost = req.URL.Scheme + ":" + publicHost
	}

	info := EmailInfo{
		Date:  time.Now().Format(time.RFC822),
		Title: treq.Title,
		To: EmailAddress{
			Name:    treq.Author,
			Address: treq.Email,
		},
		From: EmailAddress{
			Name:    "WebGL Playground",
			Address: "noreply+webgl@jessevdk.github.io",
		},
		Token:      tok,
		PublicHost: options.PublicHost,
	}

	b := &bytes.Buffer{}

	if err := emailer.Template.Execute(b, info); err != nil {
		db.DeleteRequest(tok)
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	emailer.Emails <- Email{
		Info:    info,
		Message: b.Bytes(),
	}

	g.RespondJSON(writer, struct{}{})
}

type UpdateGalleryRequest struct {
	Document    Document `json:"document"`
	Author      string   `json:"author"`
	License     string   `json:"license"`
	Screenshot  string   `json:"screenshot"`
	Description string   `json:"description"`
	Token       string   `json:"token"`
}

type UpdateGalleryResponse struct {
	Published GalleryItem `json:"published"`
	Document  Document    `json:"document"`
}

func (g UpdateGalleryHandler) Post(writer http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	dec := json.NewDecoder(req.Body)

	var ureq UpdateGalleryRequest

	if err := dec.Decode(&ureq); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	if len(ureq.Token) == 0 {
		http.Error(writer, "Invalid token", http.StatusBadRequest)
		return
	}

	scprefix := "data:image/png;base64,"

	if !strings.HasPrefix(ureq.Screenshot, scprefix) {
		http.Error(writer, "Invalid screenshot, expected "+scprefix+"...", http.StatusBadRequest)
		return
	}

	screenshotData, err := base64.StdEncoding.DecodeString(ureq.Screenshot[len(scprefix):])

	if err != nil {
		http.Error(writer, fmt.Sprintf("Failed to decode screenshot: %v", err), http.StatusBadRequest)
		return
	}

	if _, err := png.DecodeConfig(bytes.NewReader(screenshotData)); err != nil {
		http.Error(writer, fmt.Sprintf("Invalid screenshot: %v", err), http.StatusBadRequest)
		return
	}

	doc := ureq.Document

	if err := doc.ValidatePublication(); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	author := Author{
		Name:    ureq.Author,
		License: ureq.License,
		Year:    time.Now().Year(),
	}

	if err := doc.Prepare(author); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}

	// Store the doc first
	hash, err := doc.Store()

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	// Then create the actual Gallery
	item := &GalleryItem{
		Token:       ureq.Token,
		Document:    hash,
		Title:       doc.Title,
		Description: doc.Description,
		Author:      author.Name,
		License:     author.License,
	}

	if err := db.PutGallery(item, screenshotData); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	g.RespondJSON(writer, UpdateGalleryResponse{
		Document:  doc,
		Published: *item,
	})
}

func (g GalleryHandler) Get(writer http.ResponseWriter, req *http.Request) {
	form := req.Form

	page, err := strconv.ParseInt(form.Get("page"), 10, 32)

	if err != nil {
		page = 0
	}

	limit, err := strconv.ParseInt(form.Get("limit"), 10, 32)

	if err != nil {
		limit = DefaultGalleryLimit
	}

	if limit > MaximumGalleryLimit {
		limit = MaximumGalleryLimit
	}

	sort := form.Get("sort")

	if sort != "views" {
		sort = "newest"
	}

	reversedOrder := form.Get("order") == "reverse"

	ret, err := db.Gallery(int(page), int(limit), sort, reversedOrder)

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	g.RespondJSON(writer, ret)
}

type ViewGalleryHandler struct {
	RestishVoid
}

func (g ViewGalleryHandler) makeIpHash(ip string) string {
	hash := sha1.Sum([]byte(ip))
	hex := "0123456789abcdef"

	ret := make([]byte, 0, len(ip)*2)

	for _, b := range hash {
		ret = append(ret, hex[b>>4], hex[b&0x0f])
	}

	return string(ret)
}

func (g ViewGalleryHandler) Post(wr http.ResponseWriter, req *http.Request) {
	vars := mux.Vars(req)

	parent := vars["parent"]
	id := vars["id"]

	parentNum, err := strconv.ParseInt(parent, 10, 32)

	if err != nil {
		http.Error(wr, "Invalid parent", http.StatusBadRequest)
		return
	}

	idNum, err := strconv.ParseInt(id, 10, 32)

	if err != nil {
		http.Error(wr, "Invalid id", http.StatusBadRequest)
		return
	}

	// This isn't great, but
	h := req.Header
	realIP := h.Get("X-Real-IP")

	var ip string
	i := -1

	if len(realIP) != 0 {
		ip = realIP
	} else {
		ip = req.RemoteAddr
		i = strings.LastIndex(req.RemoteAddr, ":")
	}

	if i >= 0 {
		ip = ip[:i]
	}

	iphash := g.makeIpHash(ip)
	db.GalleryView(int(parentNum), int(idNum), iphash)
}

func init() {
	router.Handle("/g", MakeHandler(GalleryHandler{}, WrapCompress|WrapCORS))
	router.Handle("/g/new", MakeHandler(NewGalleryHandler{}, WrapCORS))
	router.Handle("/g/update", MakeHandler(UpdateGalleryHandler{}, WrapCORS))
	router.Handle("/g/{parent:[0-9]+}/{id:[0-9]+}/view", MakeHandler(ViewGalleryHandler{}, WrapCORS))
}
