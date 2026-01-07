# Week 3: Python Backend - Time Series & Transformations

## Overview
Add time series bucketing, data transformations, and trend calculations to support advanced chart visualizations.

## Prerequisites
- Week 2 complete (dates, formatting, schema config, validation)

## Validation Command
```bash
make check
```

---

## Task 1: Time Series Bucketing

**Goal:** Create utilities for grouping data by time intervals.

**File:** `packages/python/prismiq/timeseries.py`

**Enums and Types:**

```python
from enum import Enum
from pydantic import BaseModel, ConfigDict

class TimeInterval(str, Enum):
    """Time intervals for bucketing."""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"

class TimeBucket(BaseModel):
    """A time bucket with start and end times."""
    model_config = ConfigDict(strict=True)

    start: datetime
    end: datetime
    label: str  # Human-readable label like "Jan 2024"
```

**Functions to implement:**

```python
def get_date_trunc_sql(interval: TimeInterval, column: str) -> str:
    """Generate PostgreSQL date_trunc expression.
    Example: date_trunc('day', "order_date")
    """

def generate_time_buckets(
    start: datetime,
    end: datetime,
    interval: TimeInterval,
) -> list[TimeBucket]:
    """Generate all time buckets between start and end."""

def get_interval_format(interval: TimeInterval) -> str:
    """Get the appropriate date format string for the interval.
    day -> '%Y-%m-%d'
    month -> '%Y-%m'
    year -> '%Y'
    """

def fill_missing_buckets(
    data: list[dict],
    date_column: str,
    buckets: list[TimeBucket],
    fill_value: Any = 0,
) -> list[dict]:
    """Fill missing time buckets with default values."""
```

**Requirements:**
- Handle timezone-aware and naive datetimes
- Support all PostgreSQL date_trunc intervals
- Label formatting appropriate for interval (day: "Jan 15", month: "Jan 2024", etc.)

**Tests:** `packages/python/tests/test_timeseries.py`
- Test each interval type
- Test bucket generation across month/year boundaries
- Test missing bucket fill

---

## Task 2: Data Transformations

**Goal:** Create utilities for transforming query results.

**File:** `packages/python/prismiq/transforms.py`

**Functions to implement:**

```python
from typing import Any
from prismiq.types import QueryResult

def pivot_data(
    result: QueryResult,
    row_column: str,
    pivot_column: str,
    value_column: str,
    aggregation: str = "sum",
) -> QueryResult:
    """Pivot data from long to wide format.

    Example:
    Input:
      region | month | sales
      East   | Jan   | 100
      East   | Feb   | 150
      West   | Jan   | 200

    Output (pivot on month):
      region | Jan | Feb
      East   | 100 | 150
      West   | 200 | None
    """

def transpose_data(result: QueryResult) -> QueryResult:
    """Transpose rows and columns."""

def fill_nulls(
    result: QueryResult,
    column: str | None = None,
    value: Any = 0,
    method: str | None = None,  # 'ffill', 'bfill', 'interpolate'
) -> QueryResult:
    """Fill null values in result data.

    Args:
        column: Specific column to fill, or None for all
        value: Static fill value
        method: Fill method ('ffill' for forward fill, 'bfill' for backward fill)
    """

def calculate_running_total(
    result: QueryResult,
    value_column: str,
    order_column: str | None = None,
    group_column: str | None = None,
) -> QueryResult:
    """Add a running total column.

    If group_column provided, calculates running total within each group.
    """

def calculate_percent_of_total(
    result: QueryResult,
    value_column: str,
    group_column: str | None = None,
) -> QueryResult:
    """Add a percentage of total column.

    If group_column provided, calculates percentage within each group.
    """

def sort_result(
    result: QueryResult,
    column: str,
    descending: bool = False,
) -> QueryResult:
    """Sort query result by a column."""

def limit_result(
    result: QueryResult,
    limit: int,
    offset: int = 0,
) -> QueryResult:
    """Limit and offset query result rows."""
```

**Requirements:**
- All functions return new QueryResult (immutable)
- Handle None/null values gracefully
- Maintain column_types in output

**Tests:** `packages/python/tests/test_transforms.py`
- Test pivot with various configurations
- Test null filling methods
- Test running totals with and without groups

---

## Task 3: Trend Calculations

**Goal:** Create utilities for calculating trends and period-over-period comparisons.

**File:** `packages/python/prismiq/trends.py`

**Types:**

```python
from pydantic import BaseModel, ConfigDict
from enum import Enum

class TrendDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    FLAT = "flat"

class TrendResult(BaseModel):
    """Result of a trend calculation."""
    model_config = ConfigDict(strict=True)

    current_value: float
    previous_value: float | None
    absolute_change: float | None
    percent_change: float | None
    direction: TrendDirection

class ComparisonPeriod(str, Enum):
    """Period for comparison."""
    PREVIOUS_PERIOD = "previous_period"  # Same length as current
    PREVIOUS_YEAR = "previous_year"      # Same period last year
    PREVIOUS_MONTH = "previous_month"
    PREVIOUS_WEEK = "previous_week"
```

**Functions to implement:**

```python
def calculate_trend(
    current: float | None,
    previous: float | None,
    threshold: float = 0.001,  # Changes smaller than this are "flat"
) -> TrendResult:
    """Calculate trend between two values."""

def calculate_period_comparison(
    result: QueryResult,
    date_column: str,
    value_column: str,
    comparison: ComparisonPeriod,
    current_start: date,
    current_end: date,
) -> TrendResult:
    """Calculate trend comparing current period to comparison period."""

def add_trend_column(
    result: QueryResult,
    value_column: str,
    order_column: str,
    group_column: str | None = None,
) -> QueryResult:
    """Add columns for trend calculation to each row.

    Adds: {value_column}_prev, {value_column}_change, {value_column}_pct_change
    """

def calculate_moving_average(
    result: QueryResult,
    value_column: str,
    window: int = 7,
    order_column: str | None = None,
) -> QueryResult:
    """Add a moving average column."""

def calculate_year_over_year(
    result: QueryResult,
    date_column: str,
    value_column: str,
) -> QueryResult:
    """Add year-over-year comparison columns."""
```

**Requirements:**
- Handle None/null values (return None for calculations)
- Use Decimal for precise financial calculations where appropriate
- Threshold for "flat" direction

**Tests:** `packages/python/tests/test_trends.py`
- Test trend calculations
- Test period comparisons
- Test moving averages

---

## Task 4: Query Extensions for Time Series

**Goal:** Extend QueryBuilder to support time series queries.

**File:** Update `packages/python/prismiq/query.py`

**Add to QueryDefinition:**

```python
class TimeSeriesConfig(BaseModel):
    """Configuration for time series queries."""
    model_config = ConfigDict(strict=True)

    date_column: str
    interval: TimeInterval
    fill_missing: bool = True
    fill_value: Any = 0

class QueryDefinition(BaseModel):
    # ... existing fields ...
    time_series: TimeSeriesConfig | None = None
```

**Update QueryBuilder:**

```python
class QueryBuilder:
    def build(self, query: QueryDefinition) -> tuple[str, list[Any]]:
        # If time_series config present:
        # - Add date_trunc to SELECT
        # - Add to GROUP BY
        # - Order by date bucket
```

**Requirements:**
- Automatically add date truncation to queries with time_series config
- Validate date_column exists and is date/timestamp type

**Tests:** Update `packages/python/tests/test_query.py`
- Test time series query building
- Test validation of time series config

---

## Task 5: API Extensions

**Goal:** Add endpoints for transformations and trends.

**File:** Update `packages/python/prismiq/api.py`

**New endpoints:**

```python
@router.post("/query/execute/timeseries")
async def execute_timeseries_query(
    query: QueryDefinition,
    interval: TimeInterval,
    fill_missing: bool = True,
) -> QueryResult:
    """Execute a time series query with automatic bucketing."""

@router.post("/transform/pivot")
async def pivot_result(
    result: QueryResult,
    row_column: str,
    pivot_column: str,
    value_column: str,
) -> QueryResult:
    """Pivot query result data."""

@router.post("/transform/trend")
async def add_trend(
    result: QueryResult,
    value_column: str,
    order_column: str,
) -> QueryResult:
    """Add trend columns to result."""

@router.post("/metrics/trend")
async def calculate_metric_trend(
    query: QueryDefinition,
    comparison: ComparisonPeriod,
    current_start: date,
    current_end: date,
) -> TrendResult:
    """Calculate trend for a metric query."""
```

**Requirements:**
- All transformations work on QueryResult (client can chain them)
- Return proper error codes for invalid configurations

**Tests:** Update `packages/python/tests/test_api.py`
- Test new endpoints

---

## Task 6: Update Engine and Exports

**Goal:** Integrate new functionality into PrismiqEngine.

**File:** Update `packages/python/prismiq/engine.py`

**Add methods:**

```python
class PrismiqEngine:
    async def execute_timeseries_query(
        self,
        query: QueryDefinition,
        interval: TimeInterval,
        fill_missing: bool = True,
    ) -> QueryResult:
        """Execute a time series query."""

    def transform_pivot(
        self,
        result: QueryResult,
        row_column: str,
        pivot_column: str,
        value_column: str,
    ) -> QueryResult:
        """Pivot a query result."""

    def calculate_trend(
        self,
        current: float,
        previous: float,
    ) -> TrendResult:
        """Calculate a trend."""
```

**Update `__init__.py` exports:**
- TimeInterval, TimeBucket
- TrendDirection, TrendResult, ComparisonPeriod
- All transform functions
- TimeSeriesConfig

---

## Completion Criteria

All tasks complete when:
- [ ] Time series bucketing works for all intervals
- [ ] Pivot transformation works correctly
- [ ] Trend calculations are accurate
- [ ] Time series queries auto-bucket dates
- [ ] API endpoints work for transforms
- [ ] `make check` passes (lint, types, tests)
