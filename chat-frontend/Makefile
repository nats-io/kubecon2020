src := $(shell find src/ -name "*.js")

node_modules:
	npm install

dist/main.js: $(src) node_modules babel.config.json webpack.config.js
	node_modules/.bin/webpack --mode development
	touch $@

dist/index.html: src/index.html
	cp $< $@

dist/logo.png: src/logo.png
	cp $< $@

.PHONY: build
build: dist/main.js dist/index.html dist/logo.png

.PHONY: clean
clean:
	rm -rf dist/

.PHONY: start
start: dist/main.js dist/index.html
	go run server.go
