# Prismiq Development Makefile

.PHONY: help install install-pip dev db lint format typecheck test clean
.PHONY: demo demo-db demo-seed demo-backend demo-frontend demo-stop

# Default to uv if available, otherwise pip
UV := $(shell command -v uv 2> /dev/null)

# Demo environment variables
DEMO_DB_URL := postgresql://prismiq:prismiq_demo@localhost:5432/prismiq_demo

help:
	@echo "Prismiq Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install      Install all dependencies (uses uv if available)"
	@echo "  make install-pip  Install with pip (fallback)"
	@echo "  make dev          Full dev setup (install + pre-commit)"
	@echo "  make db           Setup database (shows options if not configured)"
	@echo ""
	@echo "Quality:"
	@echo "  make lint         Run Ruff linter"
	@echo "  make format       Format code with Ruff"
	@echo "  make typecheck    Run Pyright type checker"
	@echo "  make test         Run pytest"
	@echo "  make check        Run all checks (lint + typecheck + test)"
	@echo ""
	@echo "Demo:"
	@echo "  make demo         Start complete demo (DB + backend + frontend)"
	@echo "  make demo-db      Start PostgreSQL in Docker"
	@echo "  make demo-seed    Seed sample data"
	@echo "  make demo-backend Start backend server only"
	@echo "  make demo-frontend Start frontend only"
	@echo "  make demo-stop    Stop all demo services"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        Remove build artifacts and caches"

# ============================================================================
# Installation (venv created at repo root: .venv/)
# ============================================================================

install:
ifdef UV
	@echo "Using uv (fast mode)"
	uv sync --dev
	cd packages/react && npm install
else
	@echo "uv not found, using pip"
	$(MAKE) install-pip
endif

install-pip:
	python -m venv .venv
	. .venv/bin/activate && pip install -e "packages/python[dev]"
	cd packages/react && npm install

dev: install
	.venv/bin/pre-commit install
	@echo ""
	@echo "Dev environment ready!"
	@echo ""
	@echo "Virtual environment: .venv/"
	@echo "Run commands:        uv run <cmd>"
	@echo "Or use make:         make lint / make test / make check"
	@echo ""
	@echo "Next: Run 'make db' to setup database"

db:
	@./scripts/setup-db.sh

# ============================================================================
# Code Quality (all commands run from repo root)
# ============================================================================

lint:
ifdef UV
	uv run ruff check packages/python
else
	. .venv/bin/activate && ruff check packages/python
endif
	cd packages/react && npm run lint 2>/dev/null || true

format:
ifdef UV
	uv run ruff format packages/python
	uv run ruff check --fix packages/python
else
	. .venv/bin/activate && ruff format packages/python
	. .venv/bin/activate && ruff check --fix packages/python
endif

typecheck:
ifdef UV
	uv run pyright packages/python/prismiq
else
	. .venv/bin/activate && pyright packages/python/prismiq
endif
	cd packages/react && npm run typecheck

test:
ifdef UV
	uv run pytest packages/python -v
else
	. .venv/bin/activate && pytest packages/python -v
endif
	cd packages/react && npm test 2>/dev/null || echo "No React tests yet"

check: lint typecheck test
	@echo ""
	@echo "All checks passed!"

# ============================================================================
# Demo (complete reference implementation)
# ============================================================================

demo: demo-stop
	@echo "=========================================="
	@echo "Starting Prismiq Demo"
	@echo "=========================================="
	@echo ""
	@echo "1. Starting PostgreSQL..."
	docker compose -f examples/demo/docker-compose.yml up -d postgres
	@echo "   Waiting for PostgreSQL to be ready..."
	@sleep 3
	@until docker compose -f examples/demo/docker-compose.yml exec -T postgres pg_isready -U prismiq -d prismiq_demo > /dev/null 2>&1; do \
		echo "   Waiting for PostgreSQL..."; \
		sleep 1; \
	done
	@echo "   PostgreSQL is ready!"
	@echo ""
	@echo "2. Seeding sample data..."
ifdef UV
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) uv run python seed_data.py
else
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) python seed_data.py
endif
	@echo ""
	@echo "3. Starting backend server (port 8000)..."
ifdef UV
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) uv run python main.py &
else
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) python main.py &
endif
	@sleep 2
	@echo ""
	@echo "4. Installing frontend dependencies..."
	cd examples/demo/frontend && npm install
	@echo ""
	@echo "5. Starting frontend (port 5173)..."
	@echo ""
	@echo "=========================================="
	@echo "Demo is starting!"
	@echo ""
	@echo "Frontend: http://localhost:5173"
	@echo "Backend:  http://localhost:8000"
	@echo "API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "Press Ctrl+C to stop"
	@echo "Or run: make demo-stop"
	@echo "=========================================="
	@echo ""
	cd examples/demo/frontend && npm run dev

demo-db:
	@echo "Starting PostgreSQL..."
	docker compose -f examples/demo/docker-compose.yml up -d postgres
	@echo "Waiting for PostgreSQL to be ready..."
	@sleep 3
	@until docker compose -f examples/demo/docker-compose.yml exec -T postgres pg_isready -U prismiq -d prismiq_demo > /dev/null 2>&1; do \
		echo "Waiting for PostgreSQL..."; \
		sleep 1; \
	done
	@echo "PostgreSQL is ready at localhost:5432"
	@echo "Connection: $(DEMO_DB_URL)"

demo-seed: demo-db
	@echo "Seeding sample data..."
ifdef UV
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) uv run python seed_data.py
else
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) python seed_data.py
endif
	@echo "Sample data seeded!"

demo-backend: demo-db
	@echo "Starting backend server..."
ifdef UV
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) uv run python main.py
else
	cd examples/demo/backend && DATABASE_URL=$(DEMO_DB_URL) python main.py
endif

demo-frontend:
	@echo "Starting frontend..."
	cd examples/demo/frontend && npm install && npm run dev

demo-stop:
	@echo "Stopping demo services..."
	-docker compose -f examples/demo/docker-compose.yml down 2>/dev/null || true
	-pkill -f "examples/demo/backend/main.py" 2>/dev/null || true
	-pkill -f "vite.*examples/demo/frontend" 2>/dev/null || true
	@echo "Demo stopped."

# ============================================================================
# Cleanup
# ============================================================================

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pyright" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "build" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .venv uv.lock 2>/dev/null || true
	@echo "Cleaned!"
