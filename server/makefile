build: 
	@cd cmd/api && go build -o ../../bin/dogspeak-server

run:
	@./bin/dogspeak-server

dev: 	
	@cd cmd/api && go build -o ../../bin/dogspeak-server
	@./bin/dogspeak-server

test:
	@go test -v ./... | grep -v '\[no test files\]' 
	

