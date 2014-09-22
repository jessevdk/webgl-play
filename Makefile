CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

NODE_MODULES_BIN = node_modules/.bin

GP = GEM_PATH=$(shell pwd)/.gem
SASS = .gem/bin/sass

BROWSERIFY = $(NODE_MODULES_BIN)/browserify
BROWSERIFYINC = $(NODE_MODULES_BIN)/browserifyinc
BRFS = $(NODE_MODULES_BIN)/brfs
EXORCIST = $(NODE_MODULES_BIN)/exorcist
UGLIFYJS = $(NODE_MODULES_BIN)/uglifyjs

VENDORJS = js/vendor/codemirror.min.js

define install-npm-module
$(NODE_MODULES_BIN)/$1:
	@printf "Installing required dependency \033[1m$2\033[0m using npm\n"; \
	npm install --loglevel error $2 >/dev/null
endef

all: site

$(SASS):
	@printf "Installing required dependency \033[1msass\033[0m using gem\n"; \
	gem install -i .gem -q sass

$(eval $(call install-npm-module,browserifyinc,browserifyinc))
$(eval $(call install-npm-module,browserify,browserify))
$(eval $(call install-npm-module,brfs,brfs))
$(eval $(call install-npm-module,exorcist,exorcist))
$(eval $(call install-npm-module,uglifyjs,uglify-js))

SITE_EXTERNAL_DEPS =		\
	js/app/default.glslv	\
	js/app/default.glslf	\
	js/app/default.js

.gen/js/site.js: $(BROWSERIFY) $(BROWSERIFYINC) $(BRFS) $(EXORCIST) $(shell $(BROWSERIFY) --list js/site.js 2>/dev/null) $(SITE_EXTERNAL_DEPS)
	@mkdir -p $(dir $@); \
	full=no; \
	for f in $(SITE_EXTERNAL_DEPS); do \
		if [ $$f -nt $@ ]; then \
			full=yes; \
			break; \
		fi; \
	done; \
	if [ "$$full" = "yes" ]; then \
		printf "[\033[1mGEN\033[0m] $@ (\033[31mfull\033[0m)\n"; \
		$(BROWSERIFY) -t brfs -d js/site.js | $(EXORCIST) $@.map > $@; \
	else \
		printf "[\033[1mGEN\033[0m] $@\n"; \
	fi; \
	$(BROWSERIFYINC) -t brfs -o $@.tmp --cachefile .gen/js/.cache -d js/site.js && $(EXORCIST) $@.map > $@ < $@.tmp; rm -f $@.tmp

site/js/vendor.min.js: $(VENDORJS)
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
	$(GP) $(SASS) css/site.scss $@

site: site/js/vendor.min.js site/js/site.min.js site/index.html site/css/vendor.css site/css/site.css

watch:
	+@watchman watch "$(CURRENT_DIR)" >/dev/null && \
	MAKE=$(MAKE) scripts/watch "$(CURRENT_DIR)"

unwatch:
	@watchman -- trigger-del $(CURRENT_DIR) remake >/dev/null && \
	watchman watch-del $(CURRENT_DIR) >/dev/null

.PHONY: all site watch
