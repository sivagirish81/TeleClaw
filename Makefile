SHELL := /bin/bash
ROOT := $(CURDIR)

.PHONY: setup dev broker plugin lint test copy-examples validate-runbooks check-template-conventions

setup:
	./scripts/bootstrap-dev.sh

dev: copy-examples
	$(MAKE) -j2 broker plugin

broker:
	cd broker && go run ./cmd/server

plugin:
	cd openclaw-plugin && npm run dev

lint:
	cd broker && go test ./... && go vet ./...
	cd openclaw-plugin && npm run lint

test:
	cd broker && go test ./...
	cd openclaw-plugin && npm test
	./scripts/test-copy-examples.sh
	./scripts/validate-runbooks.sh
	./scripts/check-template-conventions.sh

copy-examples:
	./scripts/copy-examples.sh

validate-runbooks:
	./scripts/validate-runbooks.sh

check-template-conventions:
	./scripts/check-template-conventions.sh
