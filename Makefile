PYTHON ?= python
NPM ?= npm
GALILEO := projects/galileo_dashboard
BASE ?= emu/main
MODULE_ROOTS := --module-root . --module-root projects --module-root $(GALILEO)/src

.PHONY: setup dev test lint check structure

setup:
	$(PYTHON) -m pip install -r requirements.txt
	$(NPM) --prefix $(GALILEO) ci

dev:
	$(PYTHON) app.py

test:
	$(PYTHON) -m unittest discover -s tests

lint:
	$(NPM) --prefix $(GALILEO) run typecheck
	@echo "lint: Python linter not configured (see PROGRESS.md, Blocked)"

structure:
	node scripts/check-structure.mjs $(MODULE_ROOTS) --since $(BASE)

check: lint test structure
