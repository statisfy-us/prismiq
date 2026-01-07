# Week 2: Python Backend - Utilities & Schema Customization

## Overview
Add date/time utilities, number formatting, and schema customization to the Prismiq backend.

## Prerequisites
- Week 1 complete (types, schema, query, executor, api, engine)

## Validation Command
```bash
make check
```

---

## Task 1: Date/Time Utilities

**Goal:** Create utilities for date manipulation and relative date expressions.

**File:** `packages/python/prismiq/dates.py`

**Functions to implement:**

```python
from datetime import date, datetime, timedelta
from enum import Enum

class DatePreset(str, Enum):
    """Relative date presets for dashboard filters."""
    TODAY = "today"
    YESTERDAY = "yesterday"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    LAST_QUARTER = "last_quarter"
    THIS_YEAR = "this_year"
    LAST_YEAR = "last_year"
    ALL_TIME = "all_time"

def resolve_date_preset(preset: DatePreset, reference: date | None = None) -> tuple[date, date]:
    """Convert a date preset to a concrete (start_date, end_date) tuple."""

def date_trunc(unit: str, dt: datetime) -> datetime:
    """Truncate datetime to the specified unit (day, week, month, quarter, year)."""

def date_add(dt: date, years: int = 0, months: int = 0, days: int = 0) -> date:
    """Add years, months, and days to a date."""

def get_date_range_sql(preset: DatePreset, column: str) -> tuple[str, list[date]]:
    """Generate SQL WHERE clause for a date preset.
    Returns (sql_fragment, params).
    Example: ("\"order_date\" >= $1 AND \"order_date\" <= $2", [date(2024, 1, 1), date(2024, 1, 31)])
    """
```

**Requirements:**
- Handle edge cases (leap years, month boundaries)
- Use `from __future__ import annotations`
- All functions must be pure (no side effects)
- reference defaults to today if not provided

**Tests:** `packages/python/tests/test_dates.py`
- Test each preset
- Test edge cases (end of month, leap year)
- Test SQL generation

---

## Task 2: Number Formatting

**Goal:** Create utilities for formatting numbers in various styles.

**File:** `packages/python/prismiq/formatting.py`

**Functions to implement:**

```python
from enum import Enum
from decimal import Decimal

class NumberFormat(str, Enum):
    """Number formatting styles."""
    PLAIN = "plain"           # 1234567.89
    COMPACT = "compact"       # 1.2M
    CURRENCY = "currency"     # $1,234,567.89
    PERCENT = "percent"       # 12.34%
    FIXED = "fixed"           # 1234567.89 (with specified decimals)

def format_number(
    value: int | float | Decimal | None,
    format_type: NumberFormat = NumberFormat.PLAIN,
    decimals: int = 2,
    currency_symbol: str = "$",
    compact_threshold: int = 1000,
    locale: str = "en_US",
) -> str:
    """Format a number according to the specified style."""

def format_compact(value: float, decimals: int = 1) -> str:
    """Format number in compact notation (K, M, B, T)."""

def format_currency(
    value: float,
    symbol: str = "$",
    decimals: int = 2,
    locale: str = "en_US",
) -> str:
    """Format as currency with thousands separators."""

def format_percent(value: float, decimals: int = 2) -> str:
    """Format as percentage (0.1234 -> 12.34%)."""

def parse_number(value: str) -> float | None:
    """Parse a formatted number string back to float."""
```

**Requirements:**
- Handle None and NaN gracefully (return empty string or "N/A")
- Support negative numbers
- Compact notation: K (1000), M (1M), B (1B), T (1T)
- Thread-safe (no global state)

**Tests:** `packages/python/tests/test_formatting.py`
- Test each format type
- Test edge cases (0, negative, very large, very small)
- Test round-trip (format then parse)

---

## Task 3: Schema Customization

**Goal:** Allow customization of schema display (friendly names, hidden columns, metadata).

**File:** `packages/python/prismiq/schema_config.py`

**Models:**

```python
from pydantic import BaseModel, ConfigDict

class ColumnConfig(BaseModel):
    """Configuration for a single column."""
    model_config = ConfigDict(strict=True)

    display_name: str | None = None  # Friendly name for UI
    description: str | None = None   # Tooltip/help text
    hidden: bool = False             # Hide from schema explorer
    format: str | None = None        # Number format (plain, currency, percent, compact)
    date_format: str | None = None   # Date format string

class TableConfig(BaseModel):
    """Configuration for a single table."""
    model_config = ConfigDict(strict=True)

    display_name: str | None = None
    description: str | None = None
    hidden: bool = False
    columns: dict[str, ColumnConfig] = {}

class SchemaConfig(BaseModel):
    """Complete schema customization configuration."""
    model_config = ConfigDict(strict=True)

    tables: dict[str, TableConfig] = {}

    def get_table_config(self, table_name: str) -> TableConfig:
        """Get config for a table, with defaults if not configured."""

    def get_column_config(self, table_name: str, column_name: str) -> ColumnConfig:
        """Get config for a column, with defaults if not configured."""

    def get_display_name(self, table_name: str, column_name: str | None = None) -> str:
        """Get display name for table or column, falling back to actual name."""
```

**Class:** `SchemaConfigManager`

```python
class SchemaConfigManager:
    """Manages schema configuration persistence."""

    def __init__(self, config: SchemaConfig | None = None):
        ...

    def get_config(self) -> SchemaConfig:
        """Get current configuration."""

    def update_table_config(self, table_name: str, config: TableConfig) -> None:
        """Update configuration for a table."""

    def update_column_config(self, table_name: str, column_name: str, config: ColumnConfig) -> None:
        """Update configuration for a column."""

    def apply_to_schema(self, schema: DatabaseSchema) -> DatabaseSchema:
        """Apply configuration to a schema (adds display_name fields, filters hidden)."""

    def to_json(self) -> str:
        """Serialize configuration to JSON."""

    @classmethod
    def from_json(cls, json_str: str) -> "SchemaConfigManager":
        """Deserialize configuration from JSON."""
```

**Requirements:**
- Configuration is optional (defaults to showing everything)
- Hidden tables/columns excluded from schema response
- Display names returned alongside actual names
- Immutable operations (return new objects, don't mutate)

**Tests:** `packages/python/tests/test_schema_config.py`
- Test config creation
- Test display name resolution
- Test hidden filtering
- Test JSON serialization

---

## Task 4: Enhanced Query Validation

**Goal:** Improve query validation with detailed, user-friendly error messages.

**File:** Update `packages/python/prismiq/query.py`

**Enhance `QueryBuilder.validate()` method:**

```python
class ValidationError(BaseModel):
    """Detailed validation error."""
    model_config = ConfigDict(strict=True)

    code: str           # Machine-readable error code
    message: str        # User-friendly error message
    field: str | None   # Path to the problematic field (e.g., "tables[0].name")
    suggestion: str | None  # Suggested fix

class ValidationResult(BaseModel):
    """Complete validation result."""
    model_config = ConfigDict(strict=True)

    valid: bool
    errors: list[ValidationError]
```

**Error codes to implement:**
- `TABLE_NOT_FOUND` - Table doesn't exist in schema
- `COLUMN_NOT_FOUND` - Column doesn't exist in table
- `INVALID_JOIN` - Join references invalid tables or columns
- `TYPE_MISMATCH` - Filter value type doesn't match column type
- `INVALID_AGGREGATION` - Aggregation not valid for column type
- `EMPTY_QUERY` - No tables or columns selected
- `CIRCULAR_JOIN` - Join creates a cycle
- `AMBIGUOUS_COLUMN` - Column name exists in multiple tables without table qualifier

**Requirements:**
- Collect ALL errors, not just first one
- Include field paths for IDE-style error highlighting
- Suggestions should be actionable (e.g., "Did you mean 'users' instead of 'user'?")
- Use fuzzy matching to suggest similar table/column names

**Tests:** `packages/python/tests/test_validation.py`
- Test each error code
- Test multiple errors returned
- Test suggestion generation

---

## Task 5: Update API Routes

**Goal:** Add schema config endpoints and enhanced validation response.

**File:** Update `packages/python/prismiq/api.py`

**New endpoints:**

```python
@router.get("/schema/config")
async def get_schema_config() -> SchemaConfig:
    """Get current schema customization config."""

@router.put("/schema/config")
async def update_schema_config(config: SchemaConfig) -> SchemaConfig:
    """Update schema customization config."""

@router.put("/schema/config/tables/{table_name}")
async def update_table_config(table_name: str, config: TableConfig) -> TableConfig:
    """Update config for a single table."""

@router.put("/schema/config/tables/{table_name}/columns/{column_name}")
async def update_column_config(
    table_name: str,
    column_name: str,
    config: ColumnConfig
) -> ColumnConfig:
    """Update config for a single column."""
```

**Update existing endpoints:**
- `GET /schema` should apply SchemaConfig (add display names, filter hidden)
- `POST /query/validate` should return ValidationResult with detailed errors

**Requirements:**
- Schema config stored in engine instance
- Thread-safe config updates
- Return 404 if table/column doesn't exist

**Tests:** Update `packages/python/tests/test_api.py`
- Test new config endpoints
- Test schema returns display names
- Test validation returns detailed errors

---

## Task 6: Update Engine Integration

**Goal:** Integrate new utilities into PrismiqEngine.

**File:** Update `packages/python/prismiq/engine.py`

**Add to PrismiqEngine:**

```python
class PrismiqEngine:
    def __init__(
        self,
        database_url: str,
        exposed_tables: list[str] | None = None,
        schema_config: SchemaConfig | None = None,  # NEW
        query_timeout: float = 30.0,
        max_rows: int = 10000,
    ):
        ...

    @property
    def schema_config(self) -> SchemaConfigManager:
        """Get schema configuration manager."""

    async def get_schema(self, apply_config: bool = True) -> DatabaseSchema:
        """Get schema, optionally applying config (display names, hidden filter)."""

    def validate_query(self, query: QueryDefinition) -> ValidationResult:
        """Validate query with detailed errors."""
```

**Update `__init__.py` exports:**
- Add DatePreset, resolve_date_preset
- Add NumberFormat, format_number, format_compact, format_currency, format_percent
- Add SchemaConfig, TableConfig, ColumnConfig, SchemaConfigManager
- Add ValidationError, ValidationResult

**Tests:** Update `packages/python/tests/test_engine.py`
- Test schema config integration
- Test validation result format

---

## Completion Criteria

All tasks complete when:
- [ ] Date utilities work for all presets
- [ ] Number formatting handles all cases
- [ ] Schema config can hide tables/columns and set display names
- [ ] Validation returns detailed, actionable errors
- [ ] API routes support config CRUD
- [ ] `make check` passes (lint, types, tests)
