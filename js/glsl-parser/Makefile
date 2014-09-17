NODE_MODULES_BIN = ../../node_modules/.bin
MOCHA_BIN = $(NODE_MODULES_BIN)/mocha
_MOCHA_BIN = $(NODE_MODULES_BIN)/_mocha
ISTANBUL_BIN = $(NODE_MODULES_BIN)/istanbul
JSHINT_BIN = $(NODE_MODULES_BIN)/jshint

MOCHA_OPTS = -u tdd
T ?=

ifneq ($(T),)
MOCHA_OPTS += -g "$(T)"
endif

MOCHA = $(MOCHA_BIN) $(MOCHA_OPTS)

TESTS = $(wildcard *_test.js)

UNAME = $(shell uname)

ifeq ($(UNAME),Darwin)
OPEN = open
else
OPEN = xdg-open
endif

all:

$(MOCHA_BIN):
	@echo 'Installing dependencies to run tests using npm'; \
	npm install --loglevel error mocha chai >/dev/null

$(ISTANBUL_BIN):
	@echo 'Installing dependencies to run coverage using npm'; \
	npm install --loglevel error istanbul >/dev/null

$(JSHINT_BIN):
	@echo 'Installing dependencies to run linter using npm'; \
	npm install --loglevel error jshint >/dev/null

test: $(MOCHA_BIN)
	@$(MOCHA) $(TESTS)

test-ast: $(MOCHA_BIN)
	@$(MOCHA) ast_test.js

test-sst: $(MOCHA_BIN)
	@$(MOCHA) sst_test.js

test-preprocessor: $(MOCHA_BIN)
	@$(MOCHA) preprocessor_test.js

test-coverage: $(MOCHA_BIN) $(ISTANBUL_BIN)
	@$(ISTANBUL_BIN) cover $(_MOCHA_BIN) -- $(MOCHA_OPTS) -R spec $(TESTS) && \
	$(OPEN) coverage/lcov-report/index.html

linter-func = 										\
	printf "[\033[1mLINT\033[0m] ... ";				\
	ret=$$($(JSHINT_BIN) $(wildcard *.js));			\
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

.PHONY: all test test-ast test-sst test-preprocessor linter check
