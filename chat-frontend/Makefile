src := $(shell find src/ -name "*.js")

# Sets up default values, if these variables aren't passed via command line.
serverURL ?= wss://sfo.nats.chat:443
bootstrapCreds ?= fake...bootstrap...creds
mode ?= development

node_modules:
	npm install

dist/main.js: $(src) node_modules babel.config.json webpack.config.js
	node_modules/.bin/webpack --mode $(mode)
	sed -i 's#%%NATS_URL%%#$(serverURL)#g' $@
	sed -i 's#%%NATS_BOOTSTRAP_CREDS%%#$(bootstrapCreds)#g' $@

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
