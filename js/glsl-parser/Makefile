NODE_MODULES_BIN = ../../node_modules/.bin
MOCHA_BIN = $(NODE_MODULES_BIN)/mocha
_MOCHA_BIN = $(NODE_MODULES_BIN)/_mocha
ISTANBUL_BIN = $(NODE_MODULES_BIN)/istanbul

MOCHA_OPTS = -u tdd
MOCHA_TEST ?=

ifneq ($(MOCHA_TEST),)
MOCHA_OPTS += -g "$(MOCHA_TEST)"
endif

MOCHA = $(MOCHA_BIN) $(MOCHA_OPTS)

TESTS = preprocessor_test.js ast_test.js sst_test.js

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

.PHONY: all test test-ast test-preprocessor
