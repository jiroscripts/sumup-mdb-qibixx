# Variables
PYTHON := python3
NPM := npm
VENV := .venv
BIN := $(VENV)/bin

# Colors
GREEN := \033[0;32m
NC := \033[0m # No Color

.PHONY: all install dev clean help test lint

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install      Install all dependencies"
	@echo "  dev          Start all services in development mode (parallel)"
	@echo "  dev-bridge   Start only the MDB Bridge (Backend)"
	@echo "  dev-kiosk    Start only the Kiosk (Frontend)"
	@echo "  dev-web      Start only the Web App"
	@echo "  dev-docs     Start only the documentation server"
	@echo "  clean        Remove build artifacts and cache"
	@echo "  lint         Run linters (commitlint, etc)"
	@echo "  supabase-delete      Delete a specific Edge Function"
	@echo "  supabase-delete-all  Delete all known Edge Functions"

# --- Installation ---
install: install-bridge install-kiosk install-web
	@echo "${GREEN}All dependencies installed!${NC}"

install-bridge:
	@echo "Installing Python dependencies..."
	@if [ ! -d "$(VENV)" ]; then $(PYTHON) -m venv $(VENV); fi
	@. $(BIN)/activate && pip install -r mdb_bridge/requirements.txt

install-kiosk:
	@echo "Installing Kiosk dependencies..."
	@cd kiosk && $(NPM) install

install-web:
	@echo "Installing Web App dependencies..."
	@cd web && $(NPM) install

# --- Development ---
dev:
	@echo "${GREEN}Starting Development Environment...${NC}"

	@echo "Web App:    http://127.0.0.1:5174"
	@echo "Docs:       http://127.0.0.1:3000"
	@echo "Kiosk:      http://127.0.0.1:5173"
	@echo "MDB Bridge: Running..."
	@# Use make -j4 to run targets in parallel
	@$(MAKE) -j4 dev-kiosk dev-web dev-docs dev-bridge

dev-kiosk:
	@cd kiosk && $(NPM) run dev -- --port 5173 --host

dev-web:
	@cd web && $(NPM) run dev -- --port 5174 --host

dev-docs:
	@$(PYTHON) -m http.server 3000 --directory docs

dev-bridge:
	@. $(BIN)/activate && $(PYTHON) mdb_bridge/listener.py

stop:
	@echo "Stopping all services..."
	@-fuser -k 8000/tcp 5173/tcp 5174/tcp 3000/tcp > /dev/null 2>&1 || true
	@echo "${GREEN}Services stopped!${NC}"

# --- Docker ---
docker-dev:
	@echo "${GREEN}Starting Docker (Dev Mode)...${NC}"
	@docker compose up -d --build --remove-orphans
	@echo "Kiosk: http://localhost:8080"
	@echo "Web:   http://localhost:5174"

docker-prod:
	@echo "${GREEN}Starting Docker (Production Mode)...${NC}"
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
	@echo "Kiosk: http://localhost:8080"
	@echo "Web:   http://localhost:5174"

docker-stop:
	@docker compose down

# --- Maintenance ---
clean:
	@echo "Cleaning up..."
	@rm -rf $(VENV)
	@rm -rf kiosk/node_modules
	@rm -rf kiosk/dist
	@rm -rf web/node_modules
	@rm -rf web/dist
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "${GREEN}Clean complete!${NC}"

lint:
	@npx commitlint --from HEAD~1 --to HEAD --verbose

test:
	@echo "${GREEN}Running Tests (Vitest)...${NC}"
	@npx vitest run

test-all: lint test
	@echo "${GREEN}All tests passed!${NC}"

# --- Supabase ---
supabase-login:
	@npx supabase login

supabase-init:
	@if [ ! -f supabase/config.toml ]; then \
		npx supabase init; \
	else \
		echo "✅ Supabase already initialized."; \
	fi

supabase-new:
	@read -p "Enter function name: " name; npx supabase functions new $$name

supabase-delete:
	@read -p "Enter function name to delete: " name; \
	npx supabase functions delete $$name

supabase-delete-all:
	@echo "Fetching list of functions..."
	@funcs=$$(npx supabase functions list --output json | jq -r '.[].slug'); \
	if [ -z "$$funcs" ]; then \
		echo "No functions found."; \
	else \
		for func in $$funcs; do \
			echo "Deleting $$func..."; \
			npx supabase functions delete $$func --yes; \
		done; \
	fi

supabase-deploy:
	@npx supabase functions deploy --no-verify-jwt

supabase-push-env:
	@npx supabase secrets set --env-file .env

supabase-link:
	@# Explicitly source .env to ensure variables are available to the shell
	@if [ -f .env ]; then set -a; . ./.env; set +a; fi; \
	if [ -z "$$SUPABASE_PROJECT_ID" ]; then \
		echo "❌ Error: SUPABASE_PROJECT_ID is not set in .env"; \
		exit 1; \
	fi; \
	npx supabase link --project-ref $$SUPABASE_PROJECT_ID

supabase-db-push:
	@npx supabase db push

setup-supabase: supabase-login supabase-init supabase-link supabase-push-env supabase-db-push supabase-deploy
	@echo "✅ Supabase Setup Complete!"
	@echo "   - Project Linked"
	@echo "   - Secrets Pushed"
	@echo "   - Database Schema Applied"
	@echo "   - Edge Functions Deployed"

supabase-start:
	@npx supabase start

supabase-stop:
	@npx supabase stop



create-kiosk-user:
	@echo "Creating Kiosk User..."
	@npm install dotenv @supabase/supabase-js --no-save
	@node scripts/create-kiosk-user.js
