# Prismiq

Open-source embedded analytics platform. React components + Python backend. No iframe, no semantic layer — direct table access with visual query building.

## Quick Start (First Time Setup)

```bash
# 1. Install dependencies
make install                     # Python + React (or: cd packages/python && uv sync --dev)

# 2. Setup database (choose ONE)
#    Lightest: Postgres.app (Mac) or native install
#    Zero-install: Neon.tech or Supabase (free cloud)
#    Already have Docker: docker compose up -d
make db                          # Interactive setup helper

# 3. Verify setup
make check                       # Should pass all checks
```

**Then start development:**
```
See tasks/ for sprint definitions, or just ask Claude to implement features directly.
```

## Recommended Plugins

Install these official plugins for enhanced workflow:

```bash
# Install official marketplace (if not already added)
claude plugin marketplace add anthropics/claude-plugins-official

# Install workflow plugins
claude plugin install feature-dev@claude-plugins-official
claude plugin install pr-review-toolkit@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official

# NOTE: Skip LSP plugins for now (pyright-lsp, typescript-lsp) — they're buggy
# Use pyright/tsc directly in bash instead
```

### What These Do

| Plugin | Purpose | When to Use |
|--------|---------|-------------|
| **feature-dev** | Codebase exploration, architecture design, quality review agents | Starting new features |
| **pr-review-toolkit** | Specialized review agents (tests, errors, types, quality) | Before merging code |
| **frontend-design** | UI/UX design guidance | Building React components |

### Autonomous Quality Checks

When completing implementation tasks, **automatically** invoke these subagents via the Task tool:

| Subagent | Trigger | Purpose |
|----------|---------|---------|
| `pr-review-toolkit:code-reviewer` | After completing any implementation | Check style, patterns, issues |
| `pr-review-toolkit:type-design-analyzer` | When adding new types/classes | Verify type design quality |
| `pr-review-toolkit:silent-failure-hunter` | When adding try/catch or error handling | Find silent failures |
| `pr-review-toolkit:code-simplifier` | When code exceeds 50 lines | Simplify for maintainability |

**For PR creation**, invoke the skill:
```
/pr-review-toolkit:review-pr
```

This runs comprehensive review including all specialized agents.

## Project Goal

Replace Reveal BI with a customizable, embeddable analytics solution that:
- Exposes PostgreSQL tables directly (no predefined metrics/dimensions)
- Provides a visual query builder (joins, filters, aggregations)
- Renders charts and dashboards
- Embeds via React components (not iframe)

## Project Structure

```
prismiq/
├── packages/
│   ├── python/prismiq/      # Python backend (FastAPI + asyncpg)
│   └── react/src/           # React SDK (@prismiq/react)
├── examples/demo/           # Demo app (backend + frontend)
├── .claude/
│   └── skills/              # Domain knowledge (analytics-patterns)
└── tasks/                   # Sprint task definitions
```

## Validation Commands

```bash
# From repo root using make (recommended)
make check                 # Runs lint + typecheck + test

# Or run individually
make lint                  # Ruff linting
make typecheck             # Pyright type checking
make test                  # Pytest

# Direct uv commands (from repo root)
uv run ruff check packages/python
uv run pyright packages/python/prismiq
uv run pytest packages/python -v

# React
cd packages/react && npm install
cd packages/react && npm run typecheck
cd packages/react && npm run build
```

## Virtual Environment

uv creates `.venv/` at the repo root:
```
prismiq/
├── .venv/                 ← Created by `uv sync --dev`
├── uv.lock                ← Lockfile
├── pyproject.toml         ← Workspace config
└── packages/
    └── python/            ← Installed as editable
```

Commands run with `uv run` auto-use this venv.

## Tech Stack

### Python Backend
- FastAPI for API routes
- asyncpg for PostgreSQL (async, connection pooling)
- Pydantic v2 for data models (strict mode)
- SQLAlchemy Core for query building (NOT the ORM)
- Redis for caching (optional)

### React SDK
- TypeScript (strict mode)
- Functional components + hooks only
- Apache ECharts for charts
- react-grid-layout for dashboard layout

## Git Workflow

**Commit early and often.** Make small, logical commits after each meaningful unit of work.

### Commit Frequency
- After each file is complete and passes validation
- After each task is done (not at the end of a sprint)
- Before switching to a different area of the codebase

### Commit Message Format
```
<type>: <short description>

[optional body with details]
```

**Types:**
- `feat`: New feature or functionality
- `fix`: Bug fix
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `docs`: Documentation only
- `chore`: Build, config, or tooling changes

### Examples
```bash
git add packages/python/prismiq/types.py
git commit -m "feat: add query definition types

- QueryDefinition, QueryTable, JoinDefinition
- Filter and aggregation enums
- Pydantic validators for referential integrity"

git add packages/python/prismiq/schema.py
git commit -m "feat: add schema introspection

- SchemaIntrospector class with asyncpg pool
- get_schema(), get_table(), detect_relationships()
- Uses information_schema for PostgreSQL metadata"

git add packages/python/tests/test_schema.py
git commit -m "test: add schema introspection tests"
```

### Rules
1. **Never commit broken code** — Run validation before committing
2. **One concern per commit** — Don't mix types.py changes with schema.py changes
3. **Commit tests separately** — Or with the code they test, but not with unrelated code
4. **Use present tense** — "add feature" not "added feature"

---

## Code Standards

### Python
- Python 3.10+
- Type hints everywhere (Pyright strict mode)
- `from __future__ import annotations`
- Async/await for all I/O
- Parameterized SQL queries only (never interpolate)
- Quote all SQL identifiers with double quotes
- **Ruff** for linting + formatting (replaces Black, isort, flake8)
- **uv** for package management (10-100x faster than pip)

### React/TypeScript
- Strict TypeScript
- Export types from types.ts
- Handle loading/error states in all data hooks
- Memoize expensive computations

## Running the Demo

```bash
# 1. Start PostgreSQL (native or Docker)
# Native (Mac): Postgres.app or brew services start postgresql
# Docker: docker compose up -d postgres

# 2. Set DATABASE_URL in examples/demo/.env
DATABASE_URL=postgresql://youruser@localhost:5432/prismiq_demo

# 3. Seed sample data
cd examples/demo/backend && python seed_data.py

# 4. Start backend (terminal 1)
cd examples/demo/backend && python main.py

# 5. Start frontend (terminal 2)
cd examples/demo/frontend && npm install && npm run dev

# 6. Open http://localhost:5173
```

## Current Sprint

Core features complete. See `tasks/` for remaining work.

## Known Issues & Workarounds

| Issue | Workaround |
|-------|------------|
| react-grid-layout types | Import from `react-grid-layout/legacy` for WidthProvider/Responsive |
| Pydantic strict mode | Don't use `model_config = ConfigDict(strict=True)` with JSON APIs |
| Dropdown z-index | Use React Portal to render at document.body level |
| Multi-table queries | Ensure all tables in `query.tables` get added to FROM clause |
| Vite hot reload for linked packages | Configure `resolve.alias` + `server.fs.allow` + `optimizeDeps.exclude` |

## Key Decisions Log

| Decision | Rationale |
|----------|-----------|
| asyncpg over psycopg2 | Native async, better performance |
| Pydantic v2 | Faster, stricter validation |
| No semantic layer | Direct table access per requirements |
| ECharts over Plotly | Better performance with large datasets |
| **uv over pip** | 10-100x faster, lockfiles, all-in-one |
| **Ruff over Black+isort+flake8** | Single tool, Rust-based, faster |
| SQLAlchemy Core (not ORM) | Runtime table discovery, dynamic SQL |
