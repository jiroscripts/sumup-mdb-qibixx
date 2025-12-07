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
	@echo "  install      Install backend and frontend dependencies"
	@echo "  dev          Start all services in development mode (parallel)"
	@echo "  dev-backend  Start only the backend"
	@echo "  dev-frontend Start only the frontend"
	@echo "  dev-docs     Start only the documentation server"
	@echo "  clean        Remove build artifacts and cache"
	@echo "  lint         Run linters (commitlint, etc)"

# --- Installation ---
install: install-backend install-frontend install-web
	@echo "${GREEN}All dependencies installed!${NC}"

install-backend:
	@echo "Installing Python dependencies..."
	@if [ ! -d "$(VENV)" ]; then $(PYTHON) -m venv $(VENV); fi
	@. $(BIN)/activate && pip install -r backend/requirements.txt

install-frontend:
	@echo "Installing Frontend dependencies..."
	@cd frontend && $(NPM) install

install-web:
	@echo "Installing Web App dependencies..."
	@cd web && $(NPM) install

# --- Development ---
dev:
	@echo "${GREEN}Starting Development Environment...${NC}"

	@echo "Web App:  http://127.0.0.1:5174"
	@echo "Docs:     http://127.0.0.1:3000"
	@echo "Backend:  MDB Listener (Realtime)"
	@# Use make -j4 to run targets in parallel
	@$(MAKE) -j4 dev-frontend dev-web dev-docs dev-backend

dev-frontend:
	@cd frontend && $(NPM) run dev -- --port 5173 --host

dev-web:
	@cd web && $(NPM) run dev -- --port 5174 --host

dev-docs:
	@$(PYTHON) -m http.server 3000 --directory docs

dev-backend:
	@. $(BIN)/activate && $(PYTHON) backend/listener.py

stop:
	@echo "Stopping all services..."
	@-fuser -k 8000/tcp 5173/tcp 5174/tcp 3000/tcp > /dev/null 2>&1 || true
	@echo "${GREEN}Services stopped!${NC}"

# --- Maintenance ---
clean:
	@echo "Cleaning up..."
	@rm -rf $(VENV)
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@rm -rf web/node_modules
	@rm -rf web/dist
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "${GREEN}Clean complete!${NC}"

lint:
	@npx commitlint --from HEAD~1 --to HEAD --verbose

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

setup-webhook:
	@echo "Installing dependencies for script..."
	@npm install dotenv node-fetch --no-save
	@node scripts/setup-webhook.js
