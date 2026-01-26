"""Calculated field preprocessing for query building.

This module provides functions to preprocess queries with calculated fields,
applying SQL expressions to columns and filters before SQL generation.

Usage:
    from prismiq.calculated_field_processor import preprocess_calculated_fields

    # Apply calculated fields to a query dict
    processed_query = preprocess_calculated_fields(query)

    # Then build SQL
    sql, params = build_sql_from_dict(processed_query)
"""

from __future__ import annotations

import logging
import re
from typing import Any

from .calculated_fields import resolve_calculated_fields

logger = logging.getLogger(__name__)


def _has_special_characters(column_name: str) -> bool:
    """Check if column name contains special characters.

    Special characters indicate a calculated field name (e.g., "Total
    Revenue %") rather than a regular database column (e.g.,
    "account_id").
    """
    if not column_name:
        return False
    if column_name == "*":
        return False
    # Allow alphanumeric, underscore, and dot (for table.column refs)
    # Everything else is considered special
    return bool(re.search(r"[^a-zA-Z0-9_.]", column_name))


def _apply_calculated_fields_to_columns(
    columns: list[dict[str, Any]],
    calc_field_sql_map: dict[str, tuple[str, bool]],
) -> tuple[list[dict[str, Any]], bool]:
    """Replace calculated field references with SQL expressions in columns.

    This modifies the column definitions to include SQL expressions for calculated fields.
    The SQL builder will then use the sql_expression field instead of building table.column.

    Args:
        columns: Column definitions from query
        calc_field_sql_map: Mapping of field names to (SQL expression, has_aggregation) tuples

    Returns:
        Tuple of (modified_columns, uses_window_functions):
        - modified_columns: Column definitions with calculated fields resolved
        - uses_window_functions: True if any column uses window functions (OVER ()),
          indicating GROUP BY should be cleared
    """
    modified_columns = []

    # First pass: check if any calculated field uses window functions (OVER ())
    # If so, we need to convert all aggregations to window functions to avoid conflicts
    has_window_function = False
    for col in columns:
        column_name = col.get("column", "")
        if column_name in calc_field_sql_map:
            expr, _ = calc_field_sql_map[column_name]
            if " OVER " in expr.upper():
                has_window_function = True
                break

    for col in columns:
        col_copy = col.copy()
        column_name = col.get("column", "")
        aggregation = col.get("aggregation", "none")

        # Check if this is a calculated field
        if column_name in calc_field_sql_map:
            expr, has_aggregation = calc_field_sql_map[column_name]

            # Use sql_expression field (SQL builder will use this instead of building table.column)
            col_copy["sql_expression"] = expr
            col_copy["_has_aggregation"] = has_aggregation
        elif has_window_function and aggregation and aggregation != "none":
            # Convert regular aggregations to window functions to match calculated fields
            # This prevents the "column must appear in GROUP BY" error when mixing
            # window functions with regular aggregates
            # Escape double quotes to prevent SQL injection
            safe_column_name = column_name.replace('"', '""')
            if column_name == "*" and aggregation == "count":
                # COUNT(*) -> COUNT(*) OVER ()
                col_copy["sql_expression"] = "COUNT(*) OVER ()"
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"  # Don't double-wrap
            elif aggregation == "count":
                col_copy["sql_expression"] = f'COUNT("{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
            elif aggregation == "count_distinct":
                col_copy["sql_expression"] = f'COUNT(DISTINCT "{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
            elif aggregation == "sum":
                col_copy["sql_expression"] = f'SUM("{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
            elif aggregation == "avg":
                col_copy["sql_expression"] = f'AVG("{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
            elif aggregation == "min":
                col_copy["sql_expression"] = f'MIN("{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
            elif aggregation == "max":
                col_copy["sql_expression"] = f'MAX("{safe_column_name}") OVER ()'
                col_copy["_has_aggregation"] = True
                col_copy["aggregation"] = "none"
        elif column_name and _has_special_characters(column_name):
            # Column name has special characters (spaces, %, etc.), which typically indicates
            # a calculated field or custom name. If it's not found in calc_field_sql_map,
            # it might be a calculated field defined elsewhere.
            # Use the column name as a raw expression without table qualification.
            # Escape double quotes to prevent SQL injection
            safe_name = column_name.replace('"', '""')
            col_copy["sql_expression"] = f'"{safe_name}"'
            col_copy["_has_aggregation"] = False

        modified_columns.append(col_copy)

    return modified_columns, has_window_function


def _apply_calculated_fields_to_filters(
    filters: list[dict[str, Any]],
    calc_field_sql_map: dict[str, tuple[str, bool]],
) -> list[dict[str, Any]]:
    """Replace calculated field references in filters with SQL expressions.

    When a filter references a calculated field, we need to use the SQL expression
    instead of the field name.

    Args:
        filters: Filter definitions from query
        calc_field_sql_map: Mapping of field names to (SQL expression, has_aggregation) tuples

    Returns:
        Modified filter definitions with sql_expression added where needed
    """
    if not filters:
        return filters

    modified_filters = []
    for f in filters:
        f_copy = f.copy()
        column = f.get("column", "")

        if column in calc_field_sql_map:
            expr, _ = calc_field_sql_map[column]
            f_copy["sql_expression"] = expr

        modified_filters.append(f_copy)

    return modified_filters


def preprocess_calculated_fields(
    query: dict[str, Any],
    base_table_name: str | None = None,
) -> dict[str, Any]:
    """Preprocess a query dict to resolve calculated fields.

    This is the main entry point for calculated field processing. It:
    1. Resolves calculated field expressions to SQL using resolve_calculated_fields()
    2. Applies the resolved expressions to columns and filters
    3. Handles window function conflicts by converting regular aggregations

    Args:
        query: Query dict with columns, filters, calculated_fields, etc.
        base_table_name: Optional base table name to prefix unqualified column references.
                         If not provided, will be extracted from the first table in the query.

    Returns:
        Modified query dict with calculated fields resolved to sql_expression fields.
        The original query is not mutated.
    """
    calculated_fields = query.get("calculated_fields", [])

    # Extract base table name from first table if not provided
    if base_table_name is None:
        tables = query.get("tables", [])
        if tables and isinstance(tables[0], dict):
            base_table_name = tables[0].get("table_id") or tables[0].get("name")
        elif tables and isinstance(tables[0], str):
            base_table_name = tables[0]

    # Resolve calculated field expressions to SQL
    calc_field_sql_map: dict[str, tuple[str, bool]] = {}
    if calculated_fields:
        try:
            calc_field_sql_map = resolve_calculated_fields(
                query_columns=query.get("columns", []),
                calculated_fields=calculated_fields,
                base_table_name=base_table_name,
            )
        except Exception as e:
            # Log the error but continue without calculated fields rather than failing
            logger.warning(
                "Failed to resolve calculated fields: %s. Fields: %s",
                str(e),
                [cf.get("name") for cf in calculated_fields],
            )
            calc_field_sql_map = {}

    # Always process columns and filters to handle calculated field references
    # Even if calc_field_sql_map is empty, some columns might have names with spaces
    # that need special handling (e.g., calculated fields not found in current widget)
    result = query.copy()

    columns, uses_window_functions = _apply_calculated_fields_to_columns(
        query.get("columns", []), calc_field_sql_map
    )
    result["columns"] = columns

    # If window functions are used, clear GROUP BY to avoid conflicts
    # Window functions (OVER ()) operate on all rows and don't need grouping
    if uses_window_functions:
        result["group_by"] = []

    # Also apply calculated fields to filters
    result["filters"] = _apply_calculated_fields_to_filters(
        query.get("filters", []), calc_field_sql_map
    )

    return result
