ENV ?= development

CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

NODE_MODULES_BIN = node_modules/.bin

GP = GEM_PATH=$(shell pwd)/.gem
SASS = .gem/bin/sass

BROWSERIFY = $(NODE_MODULES_BIN)/browserify
BROWSERIFYINC = $(NODE_MODULES_BIN)/browserifyinc
EXORCIST = $(NODE_MODULES_BIN)/exorcist

VENDORJS = js/vendor/codemirror.min.js

ifeq ($(shell which npm),)
.gen/npm.stamp: npm-not-found
npm-not-found:
	@printf "\033[31;1m[ERROR]: building the playground requires \033[0;1mnpm\033[31;1m to be installed\033[0m\n"
	exit 1
endif

ifeq ($(shell which gem),)
$(SASS): gem-not-found
gem-not-found:
	@printf "\033[31;1m[ERROR]: building the playground requires \033[0;1mgem\033[31;1m to be installed\033[0m\n"
	exit 1
endif

all: site

$(BROWSERIFY) $(BROWSERIFYINC) $(EXORCIST): .gen/npm.stamp

.SECONDARY: .gen/npm.stamp

.gen/npm.stamp: package.json
	@printf "Installing dependencies using npm\n"; \
	mkdir -p .gen; \
	touch .gen/npm.stamp; \
	npm install

$(SASS):
	@printf "Installing required dependency \033[1msass\033[0m using gem\n"; \
	gem install -i .gem -q sass

MODELS = $(foreach i,$(wildcard models/*.obj models/*.mtl),site/assets/models/$(notdir $(i)))

SITE_EXTERNAL_DEPS =		\
	js/app/default.glslv	\
	js/app/default.glslf	\
	js/app/default.js

-include .gen/js/site.min.js.deps

site/assets/js/site.min.js: $(BROWSERIFY) $(BROWSERIFYINC) $(EXORCIST) $(SITE_EXTERNAL_DEPS)
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
