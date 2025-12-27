"""
Data transformation utilities for Prismiq analytics.

This module provides functions for transforming query results including
pivot, transpose, null filling, running totals, and percentage calculations.
"""

from __future__ import annotations

import contextlib
from collections import defaultdict
from typing import Any

from prismiq.types import QueryResult


def pivot_data(
    result: QueryResult,
    row_column: str,
    pivot_column: str,
    value_column: str,
    aggregation: str = "sum",
) -> QueryResult:
    """
    Pivot data from long to wide format.

    Args:
        result: Query result to pivot.
        row_column: Column to use as row labels.
        pivot_column: Column whose unique values become new columns.
        value_column: Column containing the values to pivot.
        aggregation: Aggregation for duplicate values ('sum', 'avg', 'min', 'max', 'count').

    Returns:
        New QueryResult with pivoted data.

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
    if not result.rows:
        return QueryResult(
            columns=[row_column],
            column_types=["text"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    # Find column indices
    try:
        row_idx = result.columns.index(row_column)
        pivot_idx = result.columns.index(pivot_column)
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column not found in result: {e}") from e

    # Get unique pivot values (these become new columns)
    pivot_values: list[Any] = []
    seen_values: set[Any] = set()
    for row in result.rows:
        val = row[pivot_idx]
        if val not in seen_values:
            pivot_values.append(val)
            seen_values.add(val)

    # Group data by row_column
    data_map: dict[Any, dict[Any, list[float]]] = defaultdict(lambda: defaultdict(list))

    for row in result.rows:
        row_val = row[row_idx]
        pivot_val = row[pivot_idx]
        value = row[value_idx]

        if value is not None:
            try:
                data_map[row_val][pivot_val].append(float(value))
            except (ValueError, TypeError):
                # Non-numeric value, skip aggregation
                data_map[row_val][pivot_val].append(0)

    # Apply aggregation
    def aggregate(values: list[float]) -> float | None:
        if not values:
            return None
        if aggregation == "sum":
            return sum(values)
        if aggregation == "avg":
            return sum(values) / len(values)
        if aggregation == "min":
            return min(values)
        if aggregation == "max":
            return max(values)
        if aggregation == "count":
            return float(len(values))
        # Default to sum
        return sum(values)

    # Build output rows
    output_rows: list[list[Any]] = []
    for row_val in data_map:
        output_row: list[Any] = [row_val]
        for pivot_val in pivot_values:
            values = data_map[row_val].get(pivot_val, [])
            output_row.append(aggregate(values))
        output_rows.append(output_row)

    # Build column names and types
    output_columns = [row_column] + [str(v) for v in pivot_values]
    output_types = [result.column_types[row_idx]] + ["numeric"] * len(pivot_values)

    return QueryResult(
        columns=output_columns,
        column_types=output_types,
        rows=output_rows,
        row_count=len(output_rows),
        truncated=False,
        execution_time_ms=0,
    )


def transpose_data(result: QueryResult) -> QueryResult:
    """
    Transpose rows and columns.

    The first row becomes column headers (if present),
    and columns become rows.

    Args:
        result: Query result to transpose.

    Returns:
        New QueryResult with transposed data.
    """
    if not result.rows:
        return QueryResult(
            columns=["Column"],
            column_types=["text"],
            rows=[[col] for col in result.columns],
            row_count=len(result.columns),
            truncated=False,
            execution_time_ms=0,
        )

    # Use original column names as first column
    # Each original column becomes a row
    num_rows = len(result.rows)

    # New columns: "Column" + row indices (Row 1, Row 2, etc.)
    output_columns = ["Column"] + [f"Row {i + 1}" for i in range(num_rows)]
    output_types = ["text"] * len(output_columns)

    # Each original column becomes a row
    output_rows: list[list[Any]] = []
    for col_idx, col_name in enumerate(result.columns):
        row: list[Any] = [col_name]
        for result_row in result.rows:
            row.append(result_row[col_idx] if col_idx < len(result_row) else None)
        output_rows.append(row)

    return QueryResult(
        columns=output_columns,
        column_types=output_types,
        rows=output_rows,
        row_count=len(output_rows),
        truncated=False,
        execution_time_ms=0,
    )


def fill_nulls(
    result: QueryResult,
    column: str | None = None,
    value: Any = 0,
    method: str | None = None,
) -> QueryResult:
    """
    Fill null values in result data.

    Args:
        result: Query result to process.
        column: Specific column to fill, or None for all columns.
        value: Static fill value (used if method is None).
        method: Fill method ('ffill' for forward fill, 'bfill' for backward fill).

    Returns:
        New QueryResult with nulls filled.
    """
    if not result.rows:
        return result

    # Deep copy rows
    output_rows = [list(row) for row in result.rows]

    # Determine which columns to process
    if column is not None:
        try:
            col_indices = [result.columns.index(column)]
        except ValueError as e:
            raise ValueError(f"Column '{column}' not found in result") from e
    else:
        col_indices = list(range(len(result.columns)))

    for col_idx in col_indices:
        if method == "ffill":
            # Forward fill - use previous non-null value
            last_value: Any = value
            for row in output_rows:
                if row[col_idx] is None:
                    row[col_idx] = last_value
                else:
                    last_value = row[col_idx]
        elif method == "bfill":
            # Backward fill - use next non-null value
            last_value = value
            for row in reversed(output_rows):
                if row[col_idx] is None:
                    row[col_idx] = last_value
                else:
                    last_value = row[col_idx]
        else:
            # Static fill
            for row in output_rows:
                if row[col_idx] is None:
                    row[col_idx] = value

    return QueryResult(
        columns=result.columns,
        column_types=result.column_types,
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def calculate_running_total(
    result: QueryResult,
    value_column: str,
    order_column: str | None = None,
    group_column: str | None = None,
) -> QueryResult:
    """
    Add a running total column.

    Args:
        result: Query result to process.
        value_column: Column containing values to sum.
        order_column: Column to order by (uses existing order if None).
        group_column: Column to group by (calculates running total within each group).

    Returns:
        New QueryResult with running total column added.
    """
    if not result.rows:
        return QueryResult(
            columns=[*result.columns, f"{value_column}_running_total"],
            column_types=[*result.column_types, "numeric"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    try:
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column '{value_column}' not found in result") from e

    group_idx = None
    if group_column is not None:
        try:
            group_idx = result.columns.index(group_column)
        except ValueError as e:
            raise ValueError(f"Group column '{group_column}' not found") from e

    order_idx = None
    if order_column is not None:
        try:
            order_idx = result.columns.index(order_column)
        except ValueError as e:
            raise ValueError(f"Order column '{order_column}' not found") from e

    # Create indexed rows for sorting
    indexed_rows = list(enumerate(result.rows))

    # Sort by order column if specified
    if order_idx is not None:
        indexed_rows.sort(key=lambda x: (x[1][order_idx] or 0))

    # Calculate running totals
    running_totals: dict[Any, float] = defaultdict(float)
    row_totals: dict[int, float] = {}

    for original_idx, row in indexed_rows:
        group_key = row[group_idx] if group_idx is not None else "__all__"
        val = row[value_idx]

        if val is not None:
            with contextlib.suppress(ValueError, TypeError):
                running_totals[group_key] += float(val)

        row_totals[original_idx] = running_totals[group_key]

    # Build output with running totals in original order
    output_rows: list[list[Any]] = []
    for i, row in enumerate(result.rows):
        output_rows.append([*row, row_totals.get(i, 0)])

    return QueryResult(
        columns=[*result.columns, f"{value_column}_running_total"],
        column_types=[*result.column_types, "numeric"],
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def calculate_percent_of_total(
    result: QueryResult,
    value_column: str,
    group_column: str | None = None,
) -> QueryResult:
    """
    Add a percentage of total column.

    Args:
        result: Query result to process.
        value_column: Column containing values.
        group_column: Column to group by (calculates percentage within each group).

    Returns:
        New QueryResult with percentage column added.
    """
    if not result.rows:
        return QueryResult(
            columns=[*result.columns, f"{value_column}_pct"],
            column_types=[*result.column_types, "numeric"],
            rows=[],
            row_count=0,
            truncated=False,
            execution_time_ms=0,
        )

    try:
        value_idx = result.columns.index(value_column)
    except ValueError as e:
        raise ValueError(f"Column '{value_column}' not found in result") from e

    group_idx = None
    if group_column is not None:
        try:
            group_idx = result.columns.index(group_column)
        except ValueError as e:
            raise ValueError(f"Group column '{group_column}' not found") from e

    # Calculate totals per group
    group_totals: dict[Any, float] = defaultdict(float)

    for row in result.rows:
        group_key = row[group_idx] if group_idx is not None else "__all__"
        val = row[value_idx]

        if val is not None:
            with contextlib.suppress(ValueError, TypeError):
                group_totals[group_key] += float(val)

    # Calculate percentages
    output_rows: list[list[Any]] = []
    for row in result.rows:
        group_key = row[group_idx] if group_idx is not None else "__all__"
        val = row[value_idx]
        total = group_totals[group_key]

        if val is not None and total > 0:
            try:
                pct = (float(val) / total) * 100
            except (ValueError, TypeError):
                pct = None
        else:
            pct = None

        output_rows.append([*row, pct])

    return QueryResult(
        columns=[*result.columns, f"{value_column}_pct"],
        column_types=[*result.column_types, "numeric"],
        rows=output_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def sort_result(
    result: QueryResult,
    column: str,
    descending: bool = False,
) -> QueryResult:
    """
    Sort query result by a column.

    Args:
        result: Query result to sort.
        column: Column to sort by.
        descending: Sort in descending order if True.

    Returns:
        New QueryResult with sorted rows.
    """
    if not result.rows:
        return result

    try:
        col_idx = result.columns.index(column)
    except ValueError as e:
        raise ValueError(f"Column '{column}' not found in result") from e

    # Sort with None values at the end
    def sort_key(row: list[Any]) -> tuple[bool, Any]:
        val = row[col_idx]
        # Put None values last
        return (val is None, val or 0)

    sorted_rows = sorted(result.rows, key=sort_key, reverse=descending)

    return QueryResult(
        columns=result.columns,
        column_types=result.column_types,
        rows=sorted_rows,
        row_count=result.row_count,
        truncated=result.truncated,
        execution_time_ms=0,
    )


def limit_result(
    result: QueryResult,
    limit: int,
    offset: int = 0,
) -> QueryResult:
    """
    Limit and offset query result rows.

    Args:
        result: Query result to limit.
        limit: Maximum number of rows to return.
        offset: Number of rows to skip.

    Returns:
        New QueryResult with limited rows.
    """
    if offset < 0:
        offset = 0
    if limit < 0:
        limit = 0

    sliced_rows = result.rows[offset : offset + limit]
    truncated = (offset + limit) < len(result.rows) or result.truncated

    return QueryResult(
        columns=result.columns,
        column_types=result.column_types,
        rows=sliced_rows,
        row_count=len(sliced_rows),
        truncated=truncated,
        execution_time_ms=0,
    )
