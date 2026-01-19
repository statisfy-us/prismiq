"""
Trend calculation utilities for Prismiq analytics.

This module provides utilities for calculating trends, period-over-period
comparisons, and moving averages.
"""

from __future__ import annotations

import contextlib
from collections import defaultdict
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict

from prismiq.types import QueryResult


class TrendDirection(str, Enum):
    """Direction of a trend."""

    UP = "up"
    DOWN = "down"
    FLAT = "flat"


class TrendResult(BaseModel):
    """Result of a trend calculation."""

    model_config = ConfigDict(strict=True)

    current_value: float
    """Current period value."""

    previous_value: float | None
    """Previous period value (None if no comparison available)."""

    absolute_change: float | None
    """Absolute difference (current - previous)."""

    percent_change: float | None
    """Percentage change ((current - previous) / previous * 100)."""

    direction: TrendDirection
    """Direction of the trend."""


class ComparisonPeriod(str, Enum):
    """Period for comparison."""

    PREVIOUS_PERIOD = "previous_period"  # Same length as current
    PREVIOUS_YEAR = "previous_year"  # Same period last year
    PREVIOUS_MONTH = "previous_month"
    PREVIOUS_WEEK = "previous_week"


def calculate_trend(
    current: float | None,
    previous: float | None,
    threshold: float = 0.001,
) -> TrendResult:
    """
    Calculate trend between two values.

    Args:
        current: Current period value.
        previous: Previous period value.
        threshold: Changes smaller than this percentage are considered "flat".

    Returns:
        TrendResult with change calculations and direction.

    Example:
        >>> result = calculate_trend(150, 100)
        >>> result.percent_change
        50.0
        >>> result.direction
        TrendDirection.UP
    """
    # Handle None current value
    if current is None:
        current = 0.0

    # Calculate changes
    if previous is None:
        return TrendResult(
            current_value=current,
            previous_value=None,
            absolute_change=None,
            percent_change=None,
            direction=TrendDirection.FLAT,
        )

    absolute_change = current - previous

    # Calculate percent change (handle division by zero)
    if previous == 0:
        if current == 0:
            percent_change = 0.0
        elif current > 0:
            percent_change = 100.0  # Treat as 100% increase from zero
        else:
            percent_change = -100.0  # Treat as 100% decrease
    else:
        percent_change = (absolute_change / abs(previous)) * 100

    # Determine direction
    if abs(percent_change) < threshold * 100:  # threshold is a ratio, not percent
        direction = TrendDirection.FLAT
    elif percent_change > 0:
        direction = TrendDirection.UP
    else:
        direction = TrendDirection.DOWN

    return TrendResult(
        current_value=current,
        previous_value=previous,
        absolute_change=absolute_change,
        percent_change=percent_change,
        direction=direction,
    )


def _get_comparison_date_range(
    current_start: date,
    current_end: date,
    comparison: ComparisonPeriod,
) -> tuple[date, date]:
    """
    Calculate the comparison period date range.

    Args:
        current_start: Start of current period.
        current_end: End of current period.
        comparison: Type of comparison.

    Returns:
        Tuple of (previous_start, previous_end).
    """
    period_length = (current_end - current_start).days + 1

    if comparison == ComparisonPeriod.PREVIOUS_PERIOD:
        # Same length, immediately before
        prev_end = current_start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_length - 1)
        return prev_start, prev_end

    if comparison == ComparisonPeriod.PREVIOUS_YEAR:
        # Same dates, one year earlier
        try:
            prev_start = current_start.replace(year=current_start.year - 1)
            prev_end = current_end.replace(year=current_end.year - 1)
        except ValueError:
            # Handle Feb 29 in non-leap year
            prev_start = current_start.replace(year=current_start.year - 1, day=28)
            prev_end = current_end.replace(year=current_end.year - 1, day=28)
        return prev_start, prev_end

    if comparison == ComparisonPeriod.PREVIOUS_MONTH:
        # One month earlier
        if current_start.month == 1:
            prev_start = current_start.replace(year=current_start.year - 1, month=12)
        else:
            # Handle day overflow (e.g., Mar 31 -> Feb 28)
            try:
                prev_start = current_start.replace(month=current_start.month - 1)
            except ValueError:
                # Day doesn't exist in previous month
                prev_start = current_start.replace(month=current_start.month - 1, day=1)
                # Move to last day of that month
                if prev_start.month == 12:
                    next_month = prev_start.replace(year=prev_start.year + 1, month=1)
                else:
                    next_month = prev_start.replace(month=prev_start.month + 1)
                prev_start = next_month - timedelta(days=1)

        if current_end.month == 1:
            prev_end = current_end.replace(year=current_end.year - 1, month=12)
        else:
            try:
                prev_end = current_end.replace(month=current_end.month - 1)
            except ValueError:
                prev_end = current_end.replace(month=current_end.month - 1, day=1)
                if prev_end.month == 12:
                    next_month = prev_end.replace(year=prev_end.year + 1, month=1)
                else:
                    next_month = prev_end.replace(month=prev_end.month + 1)
                prev_end = next_month - timedelta(days=1)

        return prev_start, prev_end

    if comparison == ComparisonPeriod.PREVIOUS_WEEK:
        # One week earlier
        prev_start = current_start - timedelta(weeks=1)
        prev_end = current_end - timedelta(weeks=1)
        return prev_start, prev_end

    # Default to previous period
    prev_end = current_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_length - 1)
    return prev_start, prev_end


def calculate_period_comparison(
    result: QueryResult,
    date_column: str,
    value_column: str,
    comparison: ComparisonPeriod,
    current_start: date,
    current_end: date,
) -> TrendResult:
    """
    Calculate trend comparing current period to comparison period.

    Args:
        result: Query result containing date and value columns.
        date_column: Name of the date column.
        value_column: Name of the value column.
        comparison: Type of period comparison.
        current_start: Start of current period.
        current_end: End of current period.

    Returns:
        TrendResult with period comparison.
    """
    if not result.rows:
        return TrendResult(
            current_value=0,
            previous_value=None,
            absolute_change=None,
            percent_change=None,
            direction=TrendDirection.FLAT,
        )

    try:
        date_idx = result.columns.index(date_column)
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column not found: {e}") from e

    # Calculate comparison period
    prev_start, prev_end = _get_comparison_date_range(current_start, current_end, comparison)

    # Sum values for each period
    current_sum = 0.0
    previous_sum = 0.0

    for row in result.rows:
        date_val = row[date_idx]
        value = row[value_idx]

        if date_val is None or value is None:
            continue

        # Convert to date if datetime
        if isinstance(date_val, datetime):
            row_date = date_val.date()
        elif isinstance(date_val, date):
            row_date = date_val
        else:
            continue

        try:
            float_value = float(value)
        except (ValueError, TypeError):
            continue

        if current_start <= row_date <= current_end:
            current_sum += float_value
        elif prev_start <= row_date <= prev_end:
            previous_sum += float_value

    return calculate_trend(current_sum, previous_sum if previous_sum != 0 else None)


def add_trend_column(
    result: QueryResult,
    value_column: str,
    order_column: str,
    group_column: str | None = None,
) -> QueryResult:
    """
    Add columns for trend calculation to each row.

    Adds: {value_column}_prev, {value_column}_change, {value_column}_pct_change

    Args:
        result: Query result to process.
        value_column: Column containing values.
        order_column: Column to order by (for determining previous row).
        group_column: Column to group by (calculate trends within groups).

    Returns:
        New QueryResult with trend columns added.
    """
    if not result.rows:
        return QueryResult(
            columns=[
                *result.columns,
                f"{value_column}_prev",
                f"{value_column}_change",
                f"{value_column}_pct_change",
            ],
            column_types=[*result.column_types, "numeric", "numeric", "numeric"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    try:
        value_idx = result.columns.index(value_column)
        order_idx = result.columns.index(order_column)
    except ValueError as e:
        raise ValueError(f"Column not found: {e}") from e

    group_idx = None
    if group_column is not None:
        try:
            group_idx = result.columns.index(group_column)
        except ValueError as e:
            raise ValueError(f"Group column not found: {e}") from e

    # Create indexed rows and sort
    indexed_rows = list(enumerate(result.rows))
    indexed_rows.sort(key=lambda x: (x[1][order_idx] or 0))

    # Calculate previous values per group
    previous_values: dict[Any, float | None] = defaultdict(lambda: None)
    row_trends: dict[int, tuple[float | None, float | None, float | None]] = {}

    for original_idx, row in indexed_rows:
        group_key = row[group_idx] if group_idx is not None else "__all__"
        current = row[value_idx]
        previous = previous_values[group_key]

        if current is not None:
            try:
                current_float = float(current)
            except (ValueError, TypeError):
                current_float = None
        else:
            current_float = None

        # Calculate trend
        if current_float is not None and previous is not None:
            change = current_float - previous
            if previous != 0:
                pct_change = (change / abs(previous)) * 100
            else:
                pct_change = 100.0 if current_float > 0 else (-100.0 if current_float < 0 else 0.0)
        else:
            change = None
            pct_change = None

        row_trends[original_idx] = (previous, change, pct_change)

        # Update previous value for group
        if current_float is not None:
            previous_values[group_key] = current_float

    # Build output with trend columns in original order
    output_rows: list[list[Any]] = []
    for i, row in enumerate(result.rows):
        prev, change, pct = row_trends.get(i, (None, None, None))
        output_rows.append([*row, prev, change, pct])

    return QueryResult(
        columns=[
            *result.columns,
            f"{value_column}_prev",
            f"{value_column}_change",
            f"{value_column}_pct_change",
        ],
        column_types=[*result.column_types, "numeric", "numeric", "numeric"],
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def calculate_moving_average(
    result: QueryResult,
    value_column: str,
    window: int = 7,
    order_column: str | None = None,
) -> QueryResult:
    """
    Add a moving average column.

    Args:
        result: Query result to process.
        value_column: Column containing values.
        window: Number of periods for the moving average.
        order_column: Column to order by (uses existing order if None).

    Returns:
        New QueryResult with moving average column added.
    """
    if not result.rows:
        return QueryResult(
            columns=[*result.columns, f"{value_column}_ma{window}"],
            column_types=[*result.column_types, "numeric"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    try:
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column '{value_column}' not found") from e

    order_idx = None
    if order_column is not None:
        try:
            order_idx = result.columns.index(order_column)
        except ValueError as e:
            raise ValueError(f"Order column '{order_column}' not found") from e

    # Create indexed rows and optionally sort
    indexed_rows = list(enumerate(result.rows))
    if order_idx is not None:
        indexed_rows.sort(key=lambda x: (x[1][order_idx] or 0))

    # Calculate moving averages
    values: list[float] = []
    row_averages: dict[int, float | None] = {}

    for original_idx, row in indexed_rows:
        val = row[value_idx]

        if val is not None:
            with contextlib.suppress(ValueError, TypeError):
                values.append(float(val))

        # Calculate moving average for this position
        if len(values) >= window:
            window_values = values[-window:]
            row_averages[original_idx] = sum(window_values) / len(window_values)
        elif values:
            # Partial window
            row_averages[original_idx] = sum(values) / len(values)
        else:
            row_averages[original_idx] = None

    # Build output in original order
    output_rows: list[list[Any]] = []
    for i, row in enumerate(result.rows):
        ma = row_averages.get(i)
        output_rows.append([*row, ma])

    return QueryResult(
        columns=[*result.columns, f"{value_column}_ma{window}"],
        column_types=[*result.column_types, "numeric"],
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def calculate_year_over_year(
    result: QueryResult,
    date_column: str,
    value_column: str,
) -> QueryResult:
    """
    Add year-over-year comparison columns.

    Adds: {value_column}_prev_year, {value_column}_yoy_change, {value_column}_yoy_pct

    Args:
        result: Query result to process.
        date_column: Column containing dates.
        value_column: Column containing values.

    Returns:
        New QueryResult with YoY comparison columns.
    """
    if not result.rows:
        return QueryResult(
            columns=[
                *result.columns,
                f"{value_column}_prev_year",
                f"{value_column}_yoy_change",
                f"{value_column}_yoy_pct",
            ],
            column_types=[*result.column_types, "numeric", "numeric", "numeric"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    try:
        date_idx = result.columns.index(date_column)
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column not found: {e}") from e

    # Build a map of (month, day or period) -> value for previous year
    # We'll use (month, day) as key for matching
    year_data: dict[int, dict[tuple[int, int], float]] = defaultdict(dict)

    for row in result.rows:
        date_val = row[date_idx]
        value = row[value_idx]

        if date_val is None or value is None:
            continue

        if isinstance(date_val, datetime):
            row_date = date_val.date()
        elif isinstance(date_val, date):
            row_date = date_val
        else:
            continue

        try:
            float_value = float(value)
        except (ValueError, TypeError):
            continue

        key = (row_date.month, row_date.day)
        year_data[row_date.year][key] = float_value

    # Calculate YoY for each row
    output_rows: list[list[Any]] = []
    for row in result.rows:
        date_val = row[date_idx]
        value = row[value_idx]

        prev_year_val: float | None = None
        yoy_change: float | None = None
        yoy_pct: float | None = None

        if date_val is not None:
            if isinstance(date_val, datetime):
                row_date = date_val.date()
            elif isinstance(date_val, date):
                row_date = date_val
            else:
                row_date = None  # type: ignore[assignment]

            if row_date is not None:
                key = (row_date.month, row_date.day)
                prev_year = row_date.year - 1
                prev_year_val = year_data.get(prev_year, {}).get(key)

                if prev_year_val is not None and value is not None:
                    try:
                        current_float = float(value)
                        yoy_change = current_float - prev_year_val
                        if prev_year_val != 0:
                            yoy_pct = (yoy_change / abs(prev_year_val)) * 100
                        else:
                            yoy_pct = 100.0 if current_float > 0 else 0.0
                    except (ValueError, TypeError):
                        pass

        output_rows.append([*row, prev_year_val, yoy_change, yoy_pct])

    return QueryResult(
        columns=[
            *result.columns,
            f"{value_column}_prev_year",
            f"{value_column}_yoy_change",
            f"{value_column}_yoy_pct",
        ],
        column_types=[*result.column_types, "numeric", "numeric", "numeric"],
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )
