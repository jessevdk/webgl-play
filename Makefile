ENV ?= development

CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

NODE_MODULES_BIN = node_modules/.bin

GP = GEM_PATH=$(shell pwd)/.gem
SASS = .gem/bin/sass

BROWSERIFY = $(NODE_MODULES_BIN)/browserify
BROWSERIFYINC = $(NODE_MODULES_BIN)/browserifyinc
BRFS = $(NODE_MODULES_BIN)/brfs
UGLIFYIFY = node_modules/uglifyify
EXORCIST = $(NODE_MODULES_BIN)/exorcist
UGLIFYJS = $(NODE_MODULES_BIN)/uglifyjs

VENDORJS = js/vendor/codemirror.min.js

define install-npm-module
$1:
	@printf "Installing required dependency \033[1m$2\033[0m using npm\n"; \
	npm install --loglevel error $2 >/dev/null
endef

define install-bin-npm-module
	$(eval $(call install-npm-module,$(NODE_MODULES_BIN)/$1,$2))
endef

all: site

$(SASS):
	@printf "Installing required dependency \033[1msass\033[0m using gem\n"; \
	gem install -i .gem -q sass

$(eval $(call install-bin-npm-module,browserifyinc,browserify-incremental))
$(eval $(call install-bin-npm-module,browserify,browserify))
$(eval $(call install-bin-npm-module,brfs,brfs))
$(eval $(call install-bin-npm-module,exorcist,exorcist))
$(eval $(call install-bin-npm-module,uglifyjs,uglify-js))
$(eval $(call install-npm-module,node_modules/uglifyify,uglifyify))

MODELS = $(foreach i,$(wildcard models/*.obj models/*.mtl),site/assets/models/$(notdir $(i)))

SITE_EXTERNAL_DEPS =		\
	js/app/default.glslv	\
	js/app/default.glslf	\
	js/app/default.js

-include .gen/js/site.min.js.deps

site/assets/js/site.min.js: $(BROWSERIFY) $(BROWSERIFYINC) $(BRFS) $(EXORCIST) $(SITE_EXTERNAL_DEPS)
	@mkdir -p $(dir $@); 															\
	full=no; 																		\
	for f in $(SITE_EXTERNAL_DEPS); do 												\
		if [ $$f -nt $@ ]; then 													\
			full=yes; 																\
			break; 																	\
		fi; 																		\
	done; 																			\
	if [ "$$full" = "yes" ]; then 													\
		printf "[\033[1mGEN\033[0m] $@ (\033[31mfull\033[0m)\n"; 					\
		rm -f .gen/js/.cache; 														\
		rm -f .gen/js/.dev-cache; 													\
	else 																			\
		printf "[\033[1mGEN\033[0m] $@\n"; 											\
	fi; 																			\
	if [ "$(ENV)" = "development" ]; then 											\
		($(BROWSERIFYINC)															\
		 	-d 																		\
		 	-t brfs 																\
		 	-t ./scripts/docify 													\
		 	-o $@.tmp --cachefile .gen/js/.dev-cache js/site.js && 					\
		 $(EXORCIST) $@.map > $@ < $@.tmp && rm -f $@.tmp) || exit 1; 				\
	else 																			\
		$(BROWSERIFYINC) 															\
			-t brfs 																\
			-t ./scripts/docify 													\
			-t uglifyify 															\
			-o $@ --cachefile .gen/js/.cache js/site.js || exit 1; 					\
	fi; 																			\
	printf "[\033[1mGEN\033[0m] [deps]\n"; 											\
	mkdir -p .gen/js; 																\
	printf "site/assets/js/site.min.js: " > .gen/js/site.min.js.deps; 					\
	$(BROWSERIFY) --list js/site.js 2>/dev/null 									\
		| tr "\\n" " " >> .gen/js/site.min.js.deps; 								\
	echo "" >> $@

site/assets/js/vendor.min.js: $(VENDORJS)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $(VENDORJS) > $@

site/index.html: html/index.html
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cp $^ $@

site/assets/css/vendor.css: $(wildcard css/*.css)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $^ > $@

site/assets/css/site.css: $(SASS) $(shell find css -name '*.scss')
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	$(GP) $(SASS) css/site.scss $@

site/assets/models/%: models/%
	@printf "[\033[1mCP\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cp $^ $@

server/site/index.html: html/index.html
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	sed 's|"assets/|"/assets/|g' < html/index.html > $@

local-site: site/assets/js/vendor.min.js site/assets/js/site.min.js site/index.html site/assets/css/vendor.css site/assets/css/site.css $(MODELS) server/site/index.html

server/server: $(wildcard server/*.go)
	@printf "[\033[1mGO\033[0m] $@\n"; \
	(cd server && go build)

server-site: local-site
	@printf "[\033[1mGEN\033[0m] remote assets\n"; \
	rm -rf server/site/assets; \
	mkdir -p server/site/assets; \
	cp -r site/assets/* server/site/assets/

server/site/assets/css/remote.css: server-site server/remote.css
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p server/site/assets/css; \
	cp server/remote.css server/site/assets/css/

server:	server-site server/site/assets/css/remote.css server/server

site: server
	@printf "[\033[1m$(shell date)\033[0m] ... [\033[32mdone\033[0m]\n\n"

watch:
	+@watchman watch "$(CURRENT_DIR)" >/dev/null && \
	MAKE=$(MAKE) ENV=$(ENV) scripts/watch "$(CURRENT_DIR)"

unwatch:
	@watchman -- trigger-del $(CURRENT_DIR) remake >/dev/null && \
	watchman watch-del $(CURRENT_DIR) >/dev/null

serve: server
	(cd server && ./server)

.PHONY: all site local-site server-site server watch unwatch serve
