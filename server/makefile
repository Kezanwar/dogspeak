# Load .env (if present) and export its vars to the commands below. The leading
# dash means "don't error if .env is missing" — so CI / prod, which set real env
# vars instead, still work.
-include .env
export

build:
	@cd cmd/api && go build -o ../../bin/dogspeak-server

run:
	@./bin/dogspeak-server

dev:
	@cd cmd/api && go build -o ../../bin/dogspeak-server
	@./bin/dogspeak-server

test:
	@go test -v ./... | grep -v '\[no test files\]'