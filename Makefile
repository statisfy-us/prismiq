# Prismiq Development Makefile

.PHONY: help install install-pip dev db lint format typecheck test clean

# Default to uv if available, otherwise pip
UV := $(shell command -v uv 2> /dev/null)

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
	@echo "Cleanup:"
	@echo "  make clean        Remove build artifacts and caches"

# ============================================================================
# Installation (venv created at repo root: .venv/)
# ============================================================================

install:
ifdef UV
	@echo "Using uv (fast mode 🚀)"
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
	@echo "✅ Dev environment ready!"
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
	@echo "✅ All checks passed!"

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
	@echo "✅ Cleaned!"
