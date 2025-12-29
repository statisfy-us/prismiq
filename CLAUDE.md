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

### Sprint Execution

To execute a full phase as a sprint:

```bash
# Use the sprint skill with the phase task file
/sprint phase1-database-persistence
```

Or work through tasks manually:
1. Read `tasks/phase1-database-persistence.md`
2. Create a todo list with all tasks from the file
3. Implement each task, committing after each
4. Run validation after each task
5. Mark task complete in todo list
6. Move to next task

### Checkpoint Validation

After completing each phase, verify these checkpoints:

**Phase 0 (E2E Testing):**
- [ ] `npm test` runs Playwright tests successfully
- [ ] CI workflow exists at `.github/workflows/e2e.yml`

**Phase 1 (Database Persistence):**
- [ ] `prismiq_dashboards` and `prismiq_widgets` tables auto-created
- [ ] Dashboards survive backend restart
- [ ] All existing tests still pass

**Phase 2 (Multi-Tenancy):**
- [ ] Tenant A cannot see Tenant B's dashboards
- [ ] Permission checks enforce owner_id
- [ ] React SDK sends X-Tenant-ID header

**Phase 3 (Dashboard Management UI):**
- [ ] Can create/edit/delete dashboards via UI
- [ ] Can add/edit/delete widgets via UI
- [ ] WidgetEditor wizard works end-to-end

**Phase 4 (Layout Persistence):**
- [ ] Drag-drop changes persist after reload
- [ ] AutoSaveIndicator shows saving/saved states
- [ ] Resize changes persist

### Error Recovery

If a task fails during autonomous execution:

1. **Validation fails:**
   - Read the error message carefully
   - Fix the specific issue (don't rewrite everything)
   - Run validation again before proceeding

2. **E2E test fails:**
   - Use `npm run test:debug` for step-by-step debugging
   - Check if the demo servers are running
   - Verify data-testid attributes match

3. **Import/type errors:**
   - Check if new dependencies need to be installed
   - Ensure exports are added to `index.ts` files
   - Run `npm run typecheck` for detailed errors

4. **Database errors:**
   - Verify DATABASE_URL is set correctly
   - Check if tables exist: `psql -c "\dt prismiq_*"`
   - Run `seed_data.py` to reset demo data

5. **Stuck on a task:**
   - Commit working code so far
   - Use `/feature-dev:code-explorer` to understand existing patterns
   - Break the task into smaller steps

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
│   ├── backend/             # FastAPI demo server
│   └── frontend/            # React demo app + Playwright tests
├── .claude/
│   └── skills/              # Domain knowledge (analytics-patterns)
└── tasks/                   # Phase task definitions (phase0-5)
```

### Skills

Use `/analytics-patterns` when implementing:
- Query builder components
- SQL generation logic
- Schema introspection
- Visualization data transformations
- Dashboard filter merging

This skill contains reference patterns and data structures specific to analytics.

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

**Requirements:**
- Python 3.10+
- Type hints everywhere (Pyright strict mode)
- `from __future__ import annotations`
- Async/await for all I/O
- **Ruff** for linting + formatting
- **uv** for package management

**Pydantic Models:**
```python
from pydantic import BaseModel, ConfigDict

class TableSchema(BaseModel):
    # Note: Don't use strict=True with JSON APIs
    name: str
    schema_name: str = "public"
    columns: list[ColumnSchema]
```

**Async Patterns:**
```python
async def execute_query(self, query: QueryDefinition) -> QueryResult:
    async with self.pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
        return QueryResult(data=rows)
```

**SQL Safety (Critical):**
```python
# ALWAYS parameterize — use $1, $2 placeholders
sql = 'SELECT * FROM "public"."users" WHERE id = $1'
await conn.fetch(sql, user_id)

# ALWAYS quote identifiers with double quotes
sql = f'SELECT "{column}" FROM "{schema}"."{table}"'

# NEVER interpolate values
sql = f'SELECT * FROM users WHERE id = {user_id}'  # WRONG - SQL injection!
```

### React/TypeScript

**Requirements:**
- TypeScript strict mode
- Functional components + hooks only
- Export types from types.ts
- Handle loading/error states in all data hooks

**Custom Hooks Pattern:**
```typescript
export function useQuery(query: QueryDefinition | null): UseQueryResult {
  const client = useAnalyticsClient();
  const [state, setState] = useState<QueryState>({
    data: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!query) return;

    let cancelled = false;
    setState(s => ({ ...s, isLoading: true }));

    client.executeQuery(query)
      .then(data => {
        if (!cancelled) setState({ data, isLoading: false, error: null });
      })
      .catch(error => {
        if (!cancelled) setState({ data: null, isLoading: false, error });
      });

    return () => { cancelled = true; };  // Cleanup on unmount
  }, [query, client]);

  return state;
}
```

**Error Handling Pattern:**
```typescript
// Always handle all states
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorDisplay error={error} />;
if (!data) return null;
return <DataDisplay data={data} />;
```

### Testing

**Python Tests (pytest):**
```python
import pytest
from unittest.mock import AsyncMock, MagicMock

@pytest.fixture
def mock_pool():
    pool = MagicMock()
    pool.acquire = MagicMock(return_value=AsyncMock())
    return pool

class TestSchemaIntrospector:
    @pytest.mark.asyncio
    async def test_get_schema_returns_all_tables(self, mock_pool):
        # Arrange
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = [{"table_name": "users"}]
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        # Act
        schema = await introspector.get_schema()

        # Assert
        assert len(schema.tables) == 1
```

**Test Categories:**
1. **Happy path** — Normal expected behavior
2. **Edge cases** — Empty inputs, boundaries
3. **Error cases** — Invalid inputs, exceptions
4. **Integration** — Components working together

**Parametrize for Multiple Cases:**
```python
@pytest.mark.parametrize("operator,expected", [
    ("eq", "= $1"),
    ("gt", "> $1"),
    ("in_", "= ANY($1)"),
])
def test_filter_operator_sql(operator, expected):
    filter_def = FilterDefinition(column="id", operator=operator, value=5)
    sql = build_filter_clause(filter_def)
    assert expected in sql
```

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

## Development Roadmap

The project follows a phased approach. Execute phases in order — each depends on the previous.

| Phase | Task File | Priority | Description |
|-------|-----------|----------|-------------|
| **Phase 0** | `phase0-e2e-testing.md` | Foundation | Playwright setup, fixtures, CI |
| **Phase 1** | `phase1-database-persistence.md` | Critical | PostgreSQL storage for dashboards/widgets |
| **Phase 2** | `phase2-multi-tenancy.md` | Critical | AuthContext, tenant isolation, permissions |
| **Phase 3** | `phase3-dashboard-management-ui.md` | Critical | DashboardList, Dialog, WidgetEditor |
| **Phase 4** | `phase4-layout-persistence.md` | High | Debounced saves, drag-drop persistence |
| **Phase 5** | `phase5-advanced-features.md` | Future | Cross-filtering, saved queries, RLS |

### Autonomous Task Execution

To execute a phase autonomously:

1. **Read the task file** to understand scope and deliverables
2. **Use feature-dev plugin** for architecture decisions:
   ```
   /feature-dev:feature-dev
   ```
3. **Implement each task** following the code examples in the file
4. **Validate after each task** using the validation commands
5. **Run E2E tests** to verify integration
6. **Commit after each completed task** (not at the end)
7. **Review with pr-review-toolkit** before moving to next phase

### Task File Format

Each task file contains:
- **Overview**: What the phase accomplishes
- **Prerequisites**: Required prior phases
- **Validation Commands**: How to verify success
- **Tasks 1-N**: Specific implementation steps with:
  - File paths
  - Code examples (reference, adapt as needed)
  - Test requirements
- **E2E Tests**: Playwright tests for integration validation
- **Completion Criteria**: Checklist of deliverables

### Validation Per Phase

After completing each phase, run:

```bash
# Python validation
make check                                    # lint + typecheck + test

# React validation
cd packages/react && npm run typecheck && npm run build

# E2E validation (after Phase 0 is complete)
cd examples/demo/frontend && npm test         # Playwright tests
```

### Plugin Usage by Phase

| Phase | Recommended Plugins |
|-------|---------------------|
| Phase 0 | None (setup) |
| Phase 1 | `feature-dev:code-architect` for store design |
| Phase 2 | `pr-review-toolkit:type-design-analyzer` for AuthContext |
| Phase 3 | `frontend-design:frontend-design` for UI components |
| Phase 4 | `pr-review-toolkit:code-reviewer` for hook patterns |
| Phase 5 | `feature-dev:code-explorer` for cross-cutting features |

## E2E Testing

After Phase 0 is complete, use Playwright for integration testing:

```bash
# Run all e2e tests
cd examples/demo/frontend && npm test

# Run specific test file
cd examples/demo/frontend && npx playwright test e2e/dashboard.spec.ts

# Run with UI for debugging
cd examples/demo/frontend && npm run test:ui

# Run headed (see browser)
cd examples/demo/frontend && npm run test:headed
```

**Test files location:** `examples/demo/frontend/e2e/`

**Page objects:** `examples/demo/frontend/e2e/fixtures.ts`

### Writing E2E Tests

Use data-testid attributes for reliable selectors:
```tsx
// Component
<div data-testid="dashboard-container">

// Test
await page.locator('[data-testid="dashboard-container"]')
```

### Browser-Based Validation

Use Playwright MCP tools to visually verify UI changes:

```bash
# Navigate to demo app
mcp__plugin_playwright_playwright__browser_navigate url="http://localhost:5173"

# Take a snapshot to see current state
mcp__plugin_playwright_playwright__browser_snapshot

# Click on elements
mcp__plugin_playwright_playwright__browser_click element="Create Dashboard button" ref="[ref-from-snapshot]"

# Fill forms
mcp__plugin_playwright_playwright__browser_type element="Dashboard name input" ref="[ref]" text="My Dashboard"
```

**Before using browser tools:**
1. Start demo backend: `cd examples/demo/backend && python main.py`
2. Start demo frontend: `cd examples/demo/frontend && npm run dev`

**Use browser validation for:**
- Verifying UI components render correctly
- Testing user flows (create dashboard, add widget, etc.)
- Debugging E2E test failures
- Visual regression checking

## Current Sprint

Core features complete. See `tasks/` for remaining work (Phases 0-5).

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
