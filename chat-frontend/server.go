package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":8080", "http port")
	flag.Parse()

	http.HandleFunc("/", serveApp)

	log.Println("Serving HTTP on", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatalln("failed to listen:", err)
	}
}

func serveApp(rw http.ResponseWriter, r *http.Request) {
	log.Println(r.Method, r.URL.Path)

	data, err := ioutil.ReadFile("./dist/index.html")
	ctype := "text/html; charset=UTF-8"
	switch r.URL.Path {
	case "/main.js":
		data, err = ioutil.ReadFile("./dist/main.js")
		ctype = "text/javascript; charset=UTF-8"
	case "/logo.png":
		data, err = ioutil.ReadFile("./dist/logo.png")
		ctype = "image/png"
	}

	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}

	rw.Header().Set("Content-Type", ctype)
	fmt.Fprint(rw, string(data))
}
