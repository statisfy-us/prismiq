# Contributing to Prismiq

Thank you for your interest in contributing to Prismiq!

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (see options below)
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

### Database Options (choose one)

| Option | Install | Memory | Best For |
|--------|---------|--------|----------|
| **Postgres.app** | [Download](https://postgresapp.com) | ~50MB | macOS users |
| **Native** | `brew install postgresql` | ~50MB | Local dev |
| **Neon** | [neon.tech](https://neon.tech) | 0 (cloud) | Zero install |
| **Supabase** | [supabase.com](https://supabase.com) | 0 (cloud) | Zero install |
| **Docker** | `docker compose up -d` | ~500MB | Already have Docker |

### Quick Start

```bash
# Clone the repository
git clone https://github.com/prismiq/prismiq.git
cd prismiq

# Full dev setup (creates .venv/, installs deps, sets up pre-commit)
make dev

# Or step by step:
make install       # Install Python + React deps
pre-commit install # Set up git hooks
```

### Installing uv (Recommended)

uv is 10-100x faster than pip and handles virtual environments automatically:

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or with pip (ironic but works)
pip install uv
```

### Manual Setup (without Make)

**With uv (recommended):**
```bash
# From repo root - creates .venv/ and installs everything
uv sync --dev

cd packages/react
npm install
```

**With pip:**
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e "packages/python[dev]"

cd packages/react
npm install
```

### Virtual Environment Location

uv creates `.venv/` at the **repo root**:

```
prismiq/
├── .venv/           ← Python deps installed here
├── uv.lock          ← Lockfile for reproducibility
├── pyproject.toml   ← Workspace configuration
└── packages/
    └── python/      ← Installed as editable package
```

Run commands with `uv run` (auto-activates) or activate manually:
```bash
source .venv/bin/activate
```

## Code Quality

We use modern Python tooling:

| Tool | Purpose | Command |
|------|---------|---------|
| **Ruff** | Linting + formatting (replaces Black, isort, flake8) | `ruff check .` / `ruff format .` |
| **Pyright** | Static type checking | `pyright` |
| **Pytest** | Testing | `pytest` |

### Running Checks

```bash
# All checks at once
make check

# Individual checks
make lint       # Ruff linting
make format     # Auto-format with Ruff
make typecheck  # Pyright type checking
make test       # Run pytest
```

### Pre-commit Hooks

Pre-commit runs automatically on `git commit`. To run manually:

```bash
pre-commit run --all-files
```

## Code Style

### Python

- **Type hints everywhere** - Pyright strict mode is enforced
- **`from __future__ import annotations`** - Use in all modules
- **Async/await for I/O** - All database operations must be async
- **Pydantic for data models** - Use `ConfigDict(strict=True)`
- **Line length: 100** - Configured in pyproject.toml

Example:
```python
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class QueryResult(BaseModel):
    """Result of executing a query."""

    model_config = ConfigDict(strict=True)

    columns: list[str]
    rows: list[list[Any]]
    row_count: int
```

### TypeScript/React

- **Strict TypeScript** - No `any` types
- **Functional components** - Hooks only, no class components
- **Export types from `types.ts`** - Central type definitions

## Pull Request Process

1. **Fork & branch** - Create a feature branch from `main`
2. **Make changes** - Follow code style guidelines
3. **Run checks** - `make check` must pass
4. **Write tests** - Add tests for new functionality
5. **Commit** - Use conventional commit format
6. **Push & PR** - Submit PR with clear description

### Commit Message Format

```
<type>: <short description>

[optional body]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

**Examples:**
```
feat: add filter builder component
fix: handle null values in query executor
docs: add API reference for schema introspection
refactor: extract SQL generation to separate module
```

## Project Structure

```
prismiq/
├── packages/
│   ├── python/              # Python backend
│   │   ├── prismiq/         # Main package
│   │   │   ├── types.py     # Pydantic models
│   │   │   ├── schema.py    # Schema introspection
│   │   │   ├── query.py     # Query builder
│   │   │   ├── executor.py  # Query execution
│   │   │   └── api.py       # FastAPI routes
│   │   └── tests/
│   └── react/               # React SDK
│       └── src/
│           ├── types.ts     # TypeScript types
│           ├── api/         # HTTP client
│           ├── hooks/       # React hooks
│           └── context/     # Providers
├── docs/                    # Documentation
├── examples/                # Example applications
└── .claude/                 # Claude Code config
```

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/prismiq/prismiq/discussions)
- **Bugs**: Open an [Issue](https://github.com/prismiq/prismiq/issues)
- **Security**: Email security@prismiq.dev (do not open public issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
