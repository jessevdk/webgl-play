package main

import (
	"crypto/sha1"
)

const validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func shortHash(b []byte) string {
	ret := make([]byte, 10)

	for i, v := range b {
		ret[i%10] += v
	}

	bl := byte(len(validChars))

	for i, v := range ret {
		ret[i] = validChars[v%bl]
	}

	return string(ret)
}

func Hash(doc []byte) string {
	s := sha1.New()
	s.Write(doc)
	ret := s.Sum(nil)

	return shortHash(ret)
}

func ValidHash(s string) bool {
	for _, c := range s {
		switch {
		case c >= 'a' && c <= 'z':
		case c >= 'A' && c <= 'Z':
		case c >= '0' && c <= '9':
		default:
			return false
		}
	}

	return len(s) > 0
}
