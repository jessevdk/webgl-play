ENV ?= development

CURRENT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

NODE_MODULES_BIN = node_modules/.bin

GP = GEM_PATH=$(shell pwd)/.gem
SASS = .gem/bin/sass

BROWSERIFY = $(NODE_MODULES_BIN)/browserify
BROWSERIFYINC = $(NODE_MODULES_BIN)/browserifyinc
EXORCIST = $(NODE_MODULES_BIN)/exorcist

VENDORJS = js/vendor/codemirror.min.js

UNAME=$(shell uname)

ifeq ($(UNAME),Darwin)
BLENDER=/Applications/blender.app/Contents/MacOS/blender
else
BLENDER=blender
endif

iconsizes=16 32 48 60 64 76 120 128 152 192 256 512

ICONS=$(foreach i,$(iconsizes),webgl-icon-$(i).png)
SITE_ICONS=$(foreach i,$(ICONS),site/assets/icons/$(i)) site/assets/icons/webgl-icon-16-32.ico

MODELS = $(foreach i,$(wildcard models/*.obj),site/assets/models/$(notdir $(i)))

JS_APP_DOCUMENT_EXTERNAL_DEPS =		\
	js/app/default.js

JS_APP_PROGRAM_EXTERNAL_DEPS =		\
	js/app/default.glslv			\
	js/app/default.glslf

ASSETS =										\
	site/assets/js/vendor.min.js				\
	site/assets/js/site.min.js					\
	site/assets/js/models/wavefrontparser.js	\
	site/assets/css/vendor.css					\
	site/assets/css/site.css					\
	$(MODELS)									\
	$(SITE_ICONS)

ifeq ($(ENV),development)
ASSETS +=									\
	site/assets/js/site.min.js.map			\
	site/assets/css/site.css.map
endif

LOCAL_ASSETS=								\
	$(ASSETS)								\
	site/index.html

SERVER_ASSETS=								\
	$(foreach i,$(ASSETS),server/$(i))		\
	server/site/assets/css/remote.css		\
	server/site/index.html

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

define make-icon-rule
icons/webgl-icon-$1.png: icons/icons.blend
	@printf "[\033[1mGEN\033[0m] $$@\n"; \
	$(BLENDER) icons/icons.blend -b -S $1x$1 -o icons/webgl-icon-$1- -f 0 >/dev/null && mv icons/webgl-icon-$1-0000.png $$@
endef

define copy-rule
$1: $2
	@printf "[\033[1mCP\033[0m] $$@\n"; \
	mkdir -p $$(dir $$@); \
	cp "$$^" "$$@"
endef

all: site

# Basic dependency checking rules
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

# Rules to render icons. These will only do anything when the icon blend file
# changes since we commit all icons
$(foreach i,$(iconsizes),$(eval $(call make-icon-rule,$(i))))

icons/webgl-icon-16-32.ico: icons/webgl-icon-16.png icons/webgl-icon-32.png
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	convert $^ $@

-include .gen/js/site.min.js.deps

# The BIG js merge
site/assets/js/site.min.js.map: site/assets/js/site.min.js
site/assets/js/site.min.js: $(BROWSERIFY) $(BROWSERIFYINC) $(EXORCIST) $(JS_APP_DOCUMENT_EXTERNAL_DEPS) $(JS_APP_PROGRAM_EXTERNAL_DEPS)
	@mkdir -p $(dir $@); 															\
	for f in $(JS_APP_DOCUMENT_EXTERNAL_DEPS); do 									\
		if [ $$f -nt $@ ]; then 													\
			touch js/app/document.js												\
			break; 																	\
		fi; 																		\
	done; 																			\
	for f in $(JS_APP_PROGRAM_EXTERNAL_DEPS); do 									\
		if [ $$f -nt $@ ]; then 													\
			touch js/app/program.js													\
			break; 																	\
		fi; 																		\
	done; 																			\
	printf "[\033[1mGEN\033[0m] $@\n"; 												\
	if [ "$(ENV)" = "development" ]; then 											\
		($(BROWSERIFYINC)															\
		 	-d 																		\
		 	-t brfs 																\
		 	-t ./scripts/docify 													\
		 	-o $@.tmp --cachefile .gen/js/.dev-cache js/site.js && 					\
		 $(EXORCIST) $@.map > $@ < $@.tmp && rm -f $@.tmp) || exit 1; 				\
		if [ ! -z "$$(tail -c 1 $@.map)" ]; then									\
			echo >> $@.map;															\
		fi																			\
	else 																			\
		$(BROWSERIFYINC) 															\
			-t brfs 																\
			-t ./scripts/docify 													\
			-t uglifyify 															\
			-o $@ --cachefile .gen/js/.cache js/site.js || exit 1; 					\
	fi; 																			\
	printf "[\033[1mGEN\033[0m] [deps]\n"; 											\
	mkdir -p .gen/js; 																\
	printf "site/assets/js/site.min.js: " > .gen/js/site.min.js.deps; 				\
	$(BROWSERIFY) --list js/site.js 2>/dev/null 									\
		| tr "\\n" " " >> .gen/js/site.min.js.deps; 								\
	echo "" >> $@

# The vendor scripts are simply concatenated together
site/assets/js/vendor.min.js: $(VENDORJS)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $(VENDORJS) > $@

# Simple copy for index.html
$(eval $(call copy-rule,site/index.html,html/index.html))

# Vendor css are simply concatenated together
site/assets/css/vendor.css: $(wildcard css/*.css)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	cat $^ > $@

# Main site css is generated by sass
site/assets/css/site.css.map: site/assets/css/site.css
site/assets/css/site.css: $(SASS) $(shell find css -name '*.scss')
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	$(GP) $(SASS) css/site.scss $@

# Web worker files are copied
$(eval $(call copy-rule,site/assets/js/models/wavefrontparser.js,js/models/wavefrontparser.js))

# Models are copied
$(eval $(call copy-rule,site/assets/models/%,models/%))

# Icons are copied
$(eval $(call copy-rule,site/assets/icons/%,icons/%))

# Generate the server site index because we'll use absolute paths
server/site/index.html: html/index.html
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	mkdir -p $(dir $@); \
	sed 's|"assets/|"/assets/|g' < html/index.html > $@

# Compile server using go
server/server: $(wildcard server/*.go)
	@printf "[\033[1mGO\033[0m] $@\n"; \
	(cd server && go get -d && go build)

# Server assets are copied
$(eval $(call copy-rule,server/site/%,site/%))

# Server remote css is copied
$(eval $(call copy-rule,server/site/assets/css/remote.css,server/remote.css))

# Convenience targets
local-site: $(LOCAL_ASSETS)
server-site: $(SERVER_ASSETS)

site: local-site server-site server/server
	@printf "[\033[1m$(shell date)\033[0m] ... [\033[32mdone\033[0m]\n\n"

# Watch targets
watch:
	+@watchman watch "$(CURRENT_DIR)" >/dev/null && \
	MAKE=$(MAKE) ENV=$(ENV) scripts/watch "$(CURRENT_DIR)"

unwatch:
	@watchman -- trigger-del $(CURRENT_DIR) remake >/dev/null && \
	watchman watch-del $(CURRENT_DIR) >/dev/null

# Launch server
serve: server
	(cd server && ./server)

.PHONY: all site local-site server-site server watch unwatch serve
