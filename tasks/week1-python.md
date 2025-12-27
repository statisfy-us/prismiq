# Week 1: Python Backend Foundation

## Overview
Build the core Python backend for Prismiq: schema introspection, query building, execution, and API routes.

## Prerequisites
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Setup Command
```bash
# From repo root
make install

# Or manually with uv
uv sync --dev

# Or with pip
python -m venv .venv && source .venv/bin/activate && pip install -e "packages/python[dev]"
```

## Validation Command
```bash
# From repo root
make check

# Or individual commands
uv run ruff check packages/python
uv run pyright packages/python/prismiq
uv run pytest packages/python -v
```

---

## Task 1: Project Setup

**Goal:** Initialize the Python package structure with dependencies.

**Files to create:**
- `packages/python/pyproject.toml`
- `packages/python/prismiq/__init__.py`
- `packages/python/prismiq/py.typed` (empty marker file)
- `packages/python/tests/__init__.py`
- `packages/python/tests/conftest.py`

**pyproject.toml requirements:**
```toml
[project]
name = "prismiq"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "asyncpg>=0.29.0",
    "pydantic>=2.0.0",
    "fastapi>=0.109.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "pyright>=1.1.350",
]
```

**Validation:** Package installs without errors.

---

## Task 2: Type Definitions

**Goal:** Create all Pydantic models for the query system.

**File:** `packages/python/prismiq/types.py`

**Models to implement:**

1. **Schema Types:**
   - `ColumnSchema`: name, data_type, is_nullable, is_primary_key, default_value
   - `TableSchema`: name, schema_name, columns
   - `Relationship`: from_table, from_column, to_table, to_column
   - `DatabaseSchema`: tables, relationships

2. **Query Types:**
   - `QueryTable`: id, name, alias
   - `JoinDefinition`: from_table_id, from_column, to_table_id, to_column, join_type
   - `AggregationType` (enum): none, sum, avg, count, count_distinct, min, max
   - `ColumnSelection`: table_id, column, aggregation, alias
   - `FilterOperator` (enum): eq, neq, gt, gte, lt, lte, in_, not_in, like, ilike, between, is_null, is_not_null
   - `FilterDefinition`: table_id, column, operator, value
   - `SortDefinition`: table_id, column, direction
   - `QueryDefinition`: tables, joins, columns, filters, group_by, order_by, limit, offset

3. **Result Types:**
   - `QueryResult`: columns, column_types, rows, row_count, truncated, execution_time_ms

4. **Exception Types:**
   - `PrismiqError` (base)
   - `QueryValidationError`
   - `QueryTimeoutError`
   - `QueryExecutionError`
   - `TableNotFoundError`

**Requirements:**
- All models use `ConfigDict(strict=True)`
- Add validator on QueryDefinition to ensure table_ids in joins/columns/filters reference existing tables
- Auto-derive group_by from non-aggregated columns when aggregations are present

**Validation:** `pyright` passes, basic model tests pass.

---

## Task 3: Schema Introspection

**Goal:** Create SchemaIntrospector class to read PostgreSQL metadata.

**File:** `packages/python/prismiq/schema.py`

**Class:** `SchemaIntrospector`

**Constructor:**
```python
def __init__(
    self,
    pool: asyncpg.Pool,
    exposed_tables: list[str] | None = None,
    schema_name: str = "public"
)
```

**Methods:**
1. `async def get_schema(self) -> DatabaseSchema`
   - Query information_schema.tables for table list
   - Query information_schema.columns for each table
   - Query for primary keys
   - Call detect_relationships()
   - Return complete DatabaseSchema

2. `async def get_table(self, table_name: str) -> TableSchema`
   - Return single table metadata
   - Raise TableNotFoundError if not in exposed_tables

3. `async def detect_relationships(self) -> list[Relationship]`
   - Query foreign key constraints
   - Only include relationships between exposed tables

**Requirements:**
- Filter to only exposed_tables if provided
- Use parameterized queries
- Handle case where table doesn't exist

**Tests:** `packages/python/tests/test_schema.py`
- Test with mock asyncpg pool
- Test exposed_tables filtering
- Test relationship detection

---

## Task 4: Query Builder

**Goal:** Convert QueryDefinition to parameterized SQL.

**File:** `packages/python/prismiq/query.py`

**Class:** `QueryBuilder`

**Constructor:**
```python
def __init__(self, schema: DatabaseSchema)
```

**Methods:**
1. `def build(self, query: QueryDefinition) -> tuple[str, list[Any]]`
   - Returns (sql_string, parameters)
   - Uses $1, $2, etc. for asyncpg parameters

2. `def validate(self, query: QueryDefinition) -> list[str]`
   - Returns list of validation errors (empty if valid)
   - Check tables exist in schema
   - Check columns exist in tables
   - Check join columns compatible

**SQL Generation Requirements:**
- Quote all identifiers with double quotes
- Handle all aggregation types
- Handle all filter operators
- Auto-generate GROUP BY for aggregated queries
- Apply LIMIT and OFFSET

**Tests:** `packages/python/tests/test_query.py`
- Simple single-table SELECT
- JOIN with aggregation
- All filter operators
- GROUP BY auto-generation
- SQL injection prevention (identifiers validated against schema)

---

## Task 5: Query Executor

**Goal:** Execute queries with timeout and row limits.

**File:** `packages/python/prismiq/executor.py`

**Class:** `QueryExecutor`

**Constructor:**
```python
def __init__(
    self,
    pool: asyncpg.Pool,
    schema: DatabaseSchema,
    query_timeout: float = 30.0,
    max_rows: int = 10000
)
```

**Methods:**
1. `async def execute(self, query: QueryDefinition) -> QueryResult`
   - Validate query first
   - Build SQL
   - Execute with timeout
   - Return QueryResult

2. `async def preview(self, query: QueryDefinition, limit: int = 100) -> QueryResult`
   - Execute with smaller limit for quick preview

3. `async def explain(self, query: QueryDefinition) -> dict`
   - Run EXPLAIN ANALYZE
   - Return query plan as dict

**Requirements:**
- Validate before executing
- Enforce max_rows limit
- Apply query timeout
- Track execution time
- Set truncated=True if limit hit
- Convert asyncpg Records to QueryResult format

**Tests:** `packages/python/tests/test_executor.py`
- Mock pool execution
- Timeout handling
- Row limit enforcement

---

## Task 6: FastAPI Routes

**Goal:** Create REST API for analytics engine.

**File:** `packages/python/prismiq/api.py`

**Function:**
```python
def create_router(engine: "PrismiqEngine") -> APIRouter
```

**Endpoints:**
1. `GET /schema` → DatabaseSchema
2. `GET /tables` → list[str] (table names only)
3. `GET /tables/{table_name}` → TableSchema
4. `POST /query/validate` → {valid: bool, errors: list[str]}
5. `POST /query/execute` → QueryResult
6. `POST /query/preview` → QueryResult (with limit param)

**Requirements:**
- Proper response models for OpenAPI docs
- Error handling with HTTPException
- Return appropriate status codes (400 for validation, 404 for not found)

**Tests:** `packages/python/tests/test_api.py`
- Use FastAPI TestClient
- Test each endpoint
- Test error responses

---

## Task 7: Main Engine Class

**Goal:** Create the main PrismiqEngine class that ties everything together.

**File:** `packages/python/prismiq/engine.py`

**Class:** `PrismiqEngine`

**Constructor:**
```python
def __init__(
    self,
    database_url: str,
    exposed_tables: list[str] | None = None,
    query_timeout: float = 30.0,
    max_rows: int = 10000
)
```

**Methods:**
1. `async def startup(self)` — Create pool, introspect schema
2. `async def shutdown(self)` — Close pool
3. `async def get_schema(self) -> DatabaseSchema`
4. `async def execute_query(self, query: QueryDefinition) -> QueryResult`
5. `def validate_query(self, query: QueryDefinition) -> list[str]`

**Update `__init__.py`:**
Export:
- PrismiqEngine
- create_router
- All types

**Tests:** `packages/python/tests/test_engine.py`
- Test lifecycle (startup/shutdown)
- Test query execution flow

---

## Completion Criteria

All tasks complete when:
- [ ] `pip install -e ".[dev]"` succeeds
- [ ] `pyright` reports no errors
- [ ] `pytest` all tests pass
- [ ] All public APIs have docstrings
