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
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"strings"
	"text/template"
	"time"
)

const EmailBatchSize = 20

const EmailTemplateBody = `Date: {{.Date}}
To: {{.To.Name}} <{{.To.Address}}>
From: {{.From.Name}} <{{.From.Address}}>
Subject: New Publishing Token for '{{.Title}}'

Hi {{.To.Name}}!

You have requested a new token to publish a WebGL Playground document
on the gallery at {{.PublicHost}}, titled '{{.Title}}':

    {{.Token}}

Please copy this token and use it to publish your playground document. The
token will expire within a few hours of not being used. Otherwise, note that
this token uniquely identifies your document and can be reused to make
modifications to the document at any time after its first Gallery.

With kind regards,


The WebGL Playground ({{.PublicHost}})
`

type EmailAddress struct {
	Name    string
	Address string
}

type EmailInfo struct {
	Date  string
	Title string

	To   EmailAddress
	From EmailAddress

	Token      string
	PublicHost string
}

type Email struct {
	Info    EmailInfo
	Message []byte
}

type Emailer struct {
	Template *template.Template
	Emails   chan Email
}

var emailer = Emailer{
	Emails: make(chan Email, 4096),
}

func (e Emailer) handleResettableError(c *smtp.Client, msg string) bool {
	log.Print(msg)

	if err := c.Reset(); err != nil {
		log.Printf("Failed to reset SMTP after failure, aborting: %v", err)
		return false
	}

	return true
}

func (e Emailer) SMTPHost() string {
	i := strings.LastIndex(options.SMTPAddress, ":")

	if i >= 0 {
		return options.SMTPAddress[:i]
	}

	return options.SMTPAddress
}

func (e Emailer) send(emails []Email) {
	c, err := smtp.Dial(options.SMTPAddress)

	if err != nil {
		log.Printf("Failed to connect to SMTP host: %v", err)
		return
	}

	defer c.Close()

	if !options.SMTPDisableTLS {
		if ok, _ := c.Extension("STARTTLS"); ok {
			config := &tls.Config{ServerName: e.SMTPHost()}

			if err := c.StartTLS(config); err != nil {
				log.Printf("Failed to STARTTLS SMTP: %v", err)
				return
			}
		}
	}

	for _, email := range emails {
		from := email.Info.From.Address

		if err := c.Mail(from); err != nil {
			log.Printf("Failed to MAIL SMTP as <%s>: %v", from, err)
			continue
		}

		to := email.Info.To.Address

		if err := c.Rcpt(to); err != nil {
			if e.handleResettableError(c, fmt.Sprintf("Failed to RCPT SMTP as <%s>: %v", to, err)) {
				continue
			} else {
				return
			}
		}

		w, err := c.Data()

		if err != nil {
			if e.handleResettableError(c, fmt.Sprintf("Failed to open SMTP data channel: %v", err)) {
				continue
			} else {
				return
			}
		}

		if _, err := w.Write(email.Message); err != nil {
			if e.handleResettableError(c, fmt.Sprintf("Failed to write to SMTP data channel: %v", err)) {
				continue
			} else {
				return
			}
		}

		if err := w.Close(); err != nil {
			if e.handleResettableError(c, fmt.Sprintf("Failed to close SMTP data channel: %v", err)) {
				continue
			} else {
				return
			}
		}
	}

	c.Quit()
}

func (e Emailer) run() {
	for {
		batch := make([]Email, 0, EmailBatchSize)

		// Wait for at least one email to arrive
		batch = append(batch, <-e.Emails)

		// Continue to collect emails until batch is full, or N seconds have passed
		timeout := time.NewTimer(5 * time.Second)

	CollectionLoop:
		for len(batch) < EmailBatchSize {
			select {
			case e := <-e.Emails:
				batch = append(batch, e)
			case <-timeout.C:
				break CollectionLoop
			}
		}

		timeout.Stop()

		e.send(batch)
	}
}

func init() {
	var err error
	emailer.Template, err = template.New("email").Parse(EmailTemplateBody)

	if err != nil {
		panic(err)
	}

	go emailer.run()
}
