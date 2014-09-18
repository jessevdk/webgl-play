NODE_MODULES_BIN = ../../node_modules/.bin

MOCHA_BIN = $(NODE_MODULES_BIN)/mocha
_MOCHA_BIN = $(NODE_MODULES_BIN)/_mocha

ISTANBUL_BIN = $(NODE_MODULES_BIN)/istanbul
JSHINT_BIN = $(NODE_MODULES_BIN)/jshint
UGLIFYJS_BIN = $(NODE_MODULES_BIN)/uglifyjs

MOCHA_OPTS = -u tdd
T ?=

ifneq ($(T),)
MOCHA_OPTS += -g "$(T)"
endif

MOCHA = $(MOCHA_BIN) $(MOCHA_OPTS)

TESTS = $(wildcard tests/*_test.js)
SOURCES = source.js tokenizer.js preprocessor.js ast.js builtins.js sst.js

UNAME = $(shell uname)

ifeq ($(UNAME),Darwin)
OPEN = open
else
OPEN = xdg-open
endif

define make-test-rule
test-$1: $(MOCHA_BIN)
	@$(MOCHA) tests/$1_test.js

.PHONY: test-$1
endef

all: glsl.all.min.js

$(MOCHA_BIN):
	@echo 'Installing dependencies to run tests using npm'; \
	npm install --loglevel error mocha chai >/dev/null

$(ISTANBUL_BIN):
	@echo 'Installing dependencies to run coverage using npm'; \
	npm install --loglevel error istanbul >/dev/null

$(JSHINT_BIN):
	@echo 'Installing dependencies to run linter using npm'; \
	npm install --loglevel error jshint >/dev/null

$(UGLIFYJS_BIN):
	@echo 'Installing dependencies to run uglifier using npm'; \
	npm install --loglevel error uglify-js >/dev/null

glsl.all.min.js: $(SOURCES) $(UGLIFYJS_BIN)
	@printf "[\033[1mGEN\033[0m] $@\n"; \
	$(UGLIFYJS_BIN) -c -o $@ --source-map glsl.all.min.js.map $(SOURCES)

test: $(MOCHA_BIN)
	@$(MOCHA) $(TESTS)

$(foreach t,$(TESTS),$(eval $(call make-test-rule,$(patsubst %_test.js,%,$(notdir $(t))))))

test-coverage: $(MOCHA_BIN) $(ISTANBUL_BIN)
	@$(ISTANBUL_BIN) cover $(_MOCHA_BIN) -- $(MOCHA_OPTS) -R spec $(TESTS) && \
	$(OPEN) coverage/lcov-report/index.html

linter-func = 										\
	printf "[\033[1mLINT\033[0m] ... ";				\
	ret=$$($(JSHINT_BIN) $(SOURCES));				\
	if [ $$? -ne 0 ]; then							\
		printf "[\033[31mfail\033[0m]\n";			\
		echo "$$ret";								\
		exit 1;										\
	else											\
		printf "[\033[33mok\033[0m]\n";				\
	fi

linter: $(JSHINT_BIN)
	@$(call linter-func)

check: $(JSHINT_BIN) test
	@$(call linter-func)

.PHONY: all test test-coverage linter check
