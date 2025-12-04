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
install: install-backend install-frontend
	@echo "${GREEN}All dependencies installed!${NC}"

install-backend:
	@echo "Installing Python dependencies..."
	@if [ ! -d "$(VENV)" ]; then $(PYTHON) -m venv $(VENV); fi
	@. $(BIN)/activate && pip install -r backend/requirements.txt

install-frontend:
	@echo "Installing Node dependencies..."
	@cd frontend && $(NPM) install

# --- Development ---
dev:
	@echo "${GREEN}Starting Development Environment...${NC}"
	@echo "Backend:  http://127.0.0.1:8000"
	@echo "Frontend: http://127.0.0.1:5173"
	@echo "Docs:     http://127.0.0.1:3000"
	@# Use make -j3 to run targets in parallel
	@$(MAKE) -j3 dev-backend dev-frontend dev-docs

dev-backend:
	@. $(BIN)/activate && $(PYTHON) -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

dev-frontend:
	@cd frontend && $(NPM) run dev -- --port 5173

dev-docs:
	@$(PYTHON) -m http.server 3000 --directory docs

# --- Maintenance ---
clean:
	@echo "Cleaning up..."
	@rm -rf $(VENV)
	@rm -rf frontend/node_modules
	@rm -rf frontend/dist
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@echo "${GREEN}Clean complete!${NC}"

lint:
	@npx commitlint --from HEAD~1 --to HEAD --verbose
