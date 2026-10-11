.PHONY: help env install backend frontend test lint build

help:
	@echo "env        create .env from .env.example (if missing)"
	@echo "install    install backend (uv) and frontend (npm) dependencies"
	@echo "backend    run the API on http://localhost:8000 (auto-reload)"
	@echo "frontend   run the web app on http://localhost:5173"
	@echo "test       backend (pytest) + frontend (vitest) tests"
	@echo "lint       frontend lint"
	@echo "build      frontend type-check + build"

env:
	@test -f .env || cp .env.example .env

install: env
	cd backend && uv sync
	cd frontend && npm install

backend: env
	cd backend && uv run uvicorn src.main:app --reload --port 8000

frontend: env
	cd frontend && npm run dev

test:
	cd backend && uv run pytest src/test -v
	cd frontend && npm test

lint:
	cd frontend && npm run lint

build:
	cd frontend && npm run build
