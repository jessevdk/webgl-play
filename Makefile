NODE_MODULES_BIN = node_modules/.bin

SASS = .gem/bin/sass

BROWSERIFY = $(NODE_MODULES_BIN)/browserify
EXORCIST = $(NODE_MODULES_BIN)/exorcist
UGLIFYJS = $(NODE_MODULES_BIN)/uglifyjs

VENDORJS = js/vendor/codemirror.min.js

define install-npm-module
$(NODE_MODULES_BIN)/$1:
	@if [ ! -z "$2" ]; then \
		mod="$2"; \
	else \
		mod="$1"; \
	fi \
	printf "Installing required dependency \033[1m$$mod\033[0m using npm\n"; \
	npm install --loglevel error $$mod >/dev/null
endef

all: site

$(SASS):
	@printf "Installing required dependency \033[1msass\033[0m using gem\n"; \
	gem install -i .gem -q -N sass

$(eval $(call install-npm-module,browserify))
$(eval $(call install-npm-module,exorcist))
$(eval $(call install-npm-module,uglifyjs uglify-js))

.gen/js/site.js: $(BROWSERIFY) $(EXORCIST) $(shell find js -name '*.js')
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	$(BROWSERIFY) -d js/site.js | $(EXORCIST) $@.map > $@

site/js/vendor.min.js: $(UGLIFYJS) $(VENDORJS)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $(VENDORJS) > $@

site/js/site.min.js: $(UGLIFYJS) .gen/js/site.js
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	$(UGLIFYJS) -c -o $@ --in-source-map .gen/js/site.js.map --source-map site/js/site.min.js.map --source-map-url site.min.js.map .gen/js/site.js 2>/dev/null

site/index.html: html/index.html
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cp html/index.html site/index.html

site/css/vendor.css: $(wildcard css/*.css)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $^ > $@

site/css/site.css: $(SASS) $(wildcard css/*.scss)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	$(SASS) --sourcemap css/site.scss $@

site: site/js/vendor.min.js site/js/site.min.js site/index.html site/css/vendor.css site/css/site.css

watch:
	@watchman watch $(shell pwd) >/dev/null && \
	watchman -- trigger $(shell pwd) remake '**.js' '**.scss' '**.html' -- make site >/dev/null

unwatch:
	@watchman -- trigger-del $(shell pwd) remake >/dev/null && \
	watchman watch-del $(shell pwd) >/dev/null

.PHONY: all site watch
