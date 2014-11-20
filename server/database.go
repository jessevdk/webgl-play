package main

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path"
	"strings"
	"time"

	sqlite3 "github.com/mattn/go-sqlite3"
)

type Db struct {
	*sql.DB
}

var db Db

const databaseVersion int32 = 1

const (
	StateNew = iota
	StatePublished
	StateRevision
	StateDeleted
)

func (d *Db) createIndices(tx *sql.Tx, table string, unique bool, fields ...[]string) {
	for _, nfield := range fields {
		field := strings.Join(nfield, ", ")
		name := strings.Join(nfield, "_")

		q := "CREATE "

		if unique {
			q += "UNIQUE "
		}

		q += "INDEX " + table + "_" + name + " ON " + table + " (" + field + ")"

		if _, err := tx.Exec(q); err != nil {
			panic(err)
		}
	}
}

func (d *Db) generateToken(length int) string {
	const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

	ret := make([]byte, length)

	for i := 0; i < length; i++ {
		r := rand.Intn(len(alphabet))
		ret[i] = alphabet[r]
	}

	return string(ret[:])
}

func (d *Db) DeleteRequest(token string) {
	d.Exec("DELETE FROM gallery WHERE token = ? AND state = ?", token, StateNew)
}

const DefaultTokenLength = 6

var tokenLength = DefaultTokenLength

func (d *Db) NewRequest() (string, error) {
	tries := 0

	for {
		if tries > 5 {
			tokenLength++
			tries = 0
		}

		tries++

		tok := d.generateToken(tokenLength)

		_, err := d.Exec(`INSERT INTO gallery (token, state, modificationDate) VALUES (?, ?, ?)`, tok, StateNew, time.Now())

		if err == nil {
			return tok, nil
		}

		// Retry on collisions with existing tokens
		if err != nil && err.(*sqlite3.Error).ExtendedCode != sqlite3.ErrConstraintPrimaryKey {
			log.Printf("Failed to generate new request: %v", err)
			return "", err
		}
	}
}

func (d *Db) Migrate() {
	row := db.QueryRow("PRAGMA user_version")

	var vers int32
	if err := row.Scan(&vers); err != nil {
		panic(err)
	}

	if vers == databaseVersion {
		return
	}

	tx, err := db.Begin()

	if err != nil {
		panic(err)
	}

	defer func() {
		if tx != nil {
			tx.Rollback()
		}
	}()

	if vers < 1 {
		if _, err := tx.Exec(`CREATE TABLE gallery (
			id               INTEGER PRIMARY KEY AUTOINCREMENT,
			parent           INTEGER DEFAULT 0,
			token            TEXT UNIQUE,
			document         TEXT,
			title            TEXT,
			description      TEXT,
			screenshot       TEXT,
			author           TEXT,
			license          TEXT,
			views            INTEGER DEFAULT 0,
			modificationDate DATETIME,
			state            INTEGER DEFAULT 0
		)`); err != nil {
			panic(err)
		}

		d.createIndices(tx, "gallery", false,
			[]string{"token"},
			[]string{"views", "state"},
			[]string{"modificationDate", "state"})

		if _, err := tx.Exec(`CREATE TABLE views (
			id INTEGER,
			ip TEXT
		)`); err != nil {
			panic(err)
		}

		d.createIndices(tx, "views", true, []string{"id", "ip"})
	}

	if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %v", databaseVersion)); err != nil {
		panic(err)
	}

	if err := tx.Commit(); err != nil {
		panic(err)
	}

	tx = nil
}

type GalleryItem struct {
	Id               int       `json:"id"`
	Parent           int       `json:"parent"`
	Token            string    `json:"-"`
	Document         string    `json:"document"`
	Title            string    `json:"title"`
	Description      string    `json:"description"`
	Screenshot       string    `json:"screenshot"`
	Author           string    `json:"author"`
	License          string    `json:"license"`
	Views            int       `json:"views"`
	ModificationDate time.Time `json:"modificationDate"`
	State            int       `json:"-"`
}

func (d *Db) PutGallery(item *GalleryItem, screenshotData []byte) error {
	tx, err := d.Begin()

	defer func() {
		if tx != nil {
			tx.Rollback()
		}
	}()

	if err != nil {
		return err
	}

	// Transfer views
	cur := tx.QueryRow("SELECT id, parent, views, state FROM gallery WHERE token = ?", item.Token)

	state := 0

	if cur != nil {
		if err := cur.Scan(&item.Id, &item.Parent, &item.Views, &state); err != nil {
			log.Printf("Error while scanning current document: %v", err)
			return err
		}
	}

	// Demote current document to revision
	if state != StateNew {
		if _, err := tx.Exec(`
			UPDATE OR FAIL
				gallery
			SET
				state = ?,
				token = NULL
			WHERE
				token = ?
		`, StateRevision, item.Token); err != nil {
			log.Printf("Error while demoting document to revision: %v", err)
			return err
		}
	} else {
		if _, err := tx.Exec(`
			DELETE FROM
				gallery
			WHERE
				token = ?
			`, item.Token); err != nil {
			log.Printf("Error while deleting original publishing request: %v", err)
			return err
		}
	}

	if screenshotId, err := ScreenshotsStorage.Store(screenshotData); err != nil {
		return err
	} else {
		item.Screenshot = screenshotId
	}

	item.ModificationDate = time.Now()
	item.State = StatePublished

	ret, err := tx.Exec(`
		INSERT INTO
			gallery
		(
			parent, token, document, title, description, screenshot, author, license, views, modificationDate, state
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
		)`,
		item.Parent,
		item.Token,
		item.Document,
		item.Title,
		item.Description,
		item.Screenshot,
		item.Author,
		item.License,
		item.Views,
		item.ModificationDate,
		item.State)

	if err != nil {
		log.Printf("Error while inserting new document: %v", err)
		return err
	}

	nid, err := ret.LastInsertId()

	if err != nil {
		log.Printf("Error while obtaining newly inserted document id: %v", err)
		return err
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error while committing document update the transaction: %v", err)
		return err
	}

	tx = nil

	item.Id = int(nid)
	return nil
}

func (d *Db) Gallery(page int, n int, sort string, reversed bool) ([]*GalleryItem, error) {
	var orderBy string

	switch sort {
	case "views":
		orderBy = "views"
	default:
		orderBy = "modificationDate"
	}

	var orderDir string

	if !reversed {
		orderDir = "DESC"
	} else {
		orderDir = "ASC"
	}

	q := fmt.Sprintf(`
		SELECT
			id,
			parent,
			document,
			title,
			description,
			screenshot,
			author,
			license,
			views,
			modificationDate
		FROM
			gallery
		WHERE
			state = ?
		ORDER BY
			%s %s
		LIMIT
			%d
		OFFSET
			%d`, orderBy, orderDir, n, page*n)

	rows, err := d.Query(q, StatePublished)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	ret := make([]*GalleryItem, 0, n)

	for rows.Next() {
		var item = new(GalleryItem)

		err = rows.Scan(&item.Id, &item.Parent, &item.Document, &item.Title, &item.Description, &item.Screenshot, &item.Author, &item.License, &item.Views, &item.ModificationDate)

		if err != nil {
			return nil, err
		}

		ret = append(ret, item)
	}

	return ret, nil
}

func (d *Db) GalleryView(parent int, id int, iphash string) {
	tx, err := d.Begin()

	if err != nil {
		log.Printf("Failed to create view update transaction: %v", err)
		return
	}

	defer func() {
		if tx != nil {
			tx.Rollback()
		}
	}()

	var viewid int

	if parent > 0 {
		viewid = parent
	} else {
		viewid = id
	}

	if _, err := tx.Exec("INSERT INTO views (id, ip) VALUES (?, ?)", viewid, iphash); err != nil {
		log.Printf("Failed to create view: %v", err)
		return
	}

	if _, err := tx.Exec("UPDATE gallery SET views = views + 1 WHERE parent = ? AND id = ?", parent, id); err != nil {
		log.Printf("Failed to update item views: %v", err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit view update: %v", err)
		return
	}

	tx = nil
}

func (d *Db) Open() {
	rand.Seed(time.Now().UTC().UnixNano())

	os.MkdirAll(dataRoot, 0755)

	if d.DB != nil {
		d.Close()
	}

	var err error
	d.DB, err = sql.Open("sqlite3", path.Join(dataRoot, "gallery.db"))

	if err != nil {
		panic(err)
	}

	d.Migrate()
}
