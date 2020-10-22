src := $(shell find src/ -name "*.js")

# Sets up default values, if these variables aren't set in the shell.
export NATS_SERVER_URL ?= wss://sfo.nats.chat:443
export NATS_BOOTSTRAP_CREDS ?= fake...bootstrap...creds
export WEBPACK_MODE ?= development

node_modules:
	npm install

dist/main.js: $(src) node_modules babel.config.json webpack.config.js
	node_modules/.bin/webpack --mode $(WEBPACK_MODE)

dist/index.html: src/index.html
	cp $< $@

dist/logo.png: src/logo.png
	cp $< $@

server: server.go
	go build -o $@

.PHONY: build
build: server dist/main.js dist/index.html dist/logo.png

.PHONY: clean
clean:
	rm -rf dist/

.PHONY: start
start: server dist/main.js dist/index.html dist/logo.png
	./server
