"""SQLAlchemy-compatible SQL query builder.

This module provides a query builder that generates SQL with SQLAlchemy-style
named parameters (:param_name) instead of PostgreSQL positional parameters ($1, $2).

Use this when working with SQLAlchemy's `text()` function.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, Callable

from .sql_utils import (ALLOWED_AGGREGATIONS, ALLOWED_DATE_TRUNCS,
                        ALLOWED_JOIN_TYPES, ALLOWED_OPERATORS,
                        ALLOWED_ORDER_DIRECTIONS,
                        convert_revealbi_date_format_to_postgres,
                        validate_identifier)

if TYPE_CHECKING:
    pass


def _postprocess_scalar_subqueries(sql: str) -> str:
    """Replace scalar subquery placeholders with actual subqueries.

    Calculated fields that use "percent of total" patterns (like [Sum:arr] / [Sum:total])
    need the divisor to be computed across ALL rows, not just the grouped rows.
    This is achieved using scalar subqueries.

    The calculated_fields module generates placeholders like __SCALAR_SUM_columnname__
    which this function replaces with actual scalar subqueries using the FROM and WHERE
    clauses from the main query.

    Args:
        sql: Generated SQL query that may contain __SCALAR_SUM_*__ placeholders

    Returns:
        SQL with placeholders replaced by scalar subqueries

    Example:
        Input:  SELECT __SCALAR_SUM_arr__ FROM "public"."accounts" WHERE x = 1
        Output: SELECT (SELECT SUM(("arr")::numeric) FROM "public"."accounts" WHERE x = 1)
                FROM "public"."accounts" WHERE x = 1
    """
    # Pattern: __SCALAR_SUM_columnname__
    scalar_pattern = r"__SCALAR_SUM_(\w+)__"
    matches = re.findall(scalar_pattern, sql)

    if not matches:
        return sql

    # Extract FROM clause from SQL to reuse in scalar subqueries
    # Use negated character class to avoid ReDoS from backtracking
    # Match FROM until we hit a SQL keyword boundary
    from_match = re.search(
        r"FROM\s+([^;]+?)(?=\s+WHERE\s|\s+GROUP\s+BY\s|\s+ORDER\s+BY\s|\s+LIMIT\s|$)",
        sql,
        re.IGNORECASE,
    )
    if not from_match:
        # Can't extract FROM clause - return SQL as-is with placeholders
        # This shouldn't happen in practice but handles edge cases gracefully
        return sql

    from_clause = from_match.group(1).strip()

    # Extract WHERE clause if present
    # Use negated character class to avoid ReDoS from backtracking
    where_match = re.search(
        r"WHERE\s+([^;]+?)(?=\s+GROUP\s+BY\s|\s+ORDER\s+BY\s|\s+LIMIT\s|$)",
        sql,
        re.IGNORECASE,
    )
    where_clause = where_match.group(1).strip() if where_match else None

    # Replace each placeholder with a scalar subquery
    for column_name in matches:
        # Build scalar subquery: (SELECT SUM("column") FROM table WHERE filters)
        subquery = f'(SELECT SUM(("{column_name}")::numeric) FROM {from_clause}'
        if where_clause:
            subquery += f" WHERE {where_clause}"
        subquery += ")"

        # Replace placeholder with scalar subquery
        sql = sql.replace(f"__SCALAR_SUM_{column_name}__", subquery)

    return sql


def build_sql_from_dict(
    query: dict[str, Any],
    *,
    table_validator: Callable[[str], None] | None = None,
    preprocess_calculated_fields: bool = True,
) -> tuple[str, dict[str, Any]]:
    """Build SQL query from dictionary-based query definition.

    This function generates parameterized SQL with SQLAlchemy-style named
    parameters (e.g., :param_0, :param_1) for use with SQLAlchemy's text().

    Args:
        query: Query definition dict with keys:
            - tables: list[dict] with id, name, schema, optional alias
            - joins: list[dict] with join_type, from_table_id, to_table_id, etc.
            - columns: list[dict] with table_id, column, optional aggregation/alias
            - filters: list[dict] with table_id, column, operator, value
            - group_by: list[str] column names
            - order_by: list[dict] with column, direction
            - limit: int | None
            - calculated_fields: list[dict] with name and expression (optional)

        table_validator: Optional callback to validate table names against
                         application-specific whitelist. Should raise ValueError
                         if table is not allowed. This enables business-specific
                         table access control while keeping core logic generic.

        preprocess_calculated_fields: If True (default), automatically preprocess
                         calculated_fields in the query. Set to False if the caller
                         has already preprocessed them.

    Returns:
        Tuple of (sql, params) where params is a dict for SQLAlchemy text()

    Raises:
        ValueError: If query contains invalid identifiers, operators, or structure

    Security:
        - All identifiers validated with strict character checking
        - All operators validated against whitelist
        - All values parameterized (never interpolated)
        - Custom table validator for application-specific access control

    Example:
        >>> query = {
        ...     "tables": [{"id": "t1", "name": "users", "schema": "public"}],
        ...     "columns": [{"table_id": "t1", "column": "email"}],
        ...     "filters": [{"table_id": "t1", "column": "id", "operator": "eq", "value": 42}],
        ... }
        >>> sql, params = build_sql_from_dict(query)
        >>> # sql: 'SELECT "users"."email" FROM "public"."users" WHERE "users"."id" = :param_0'
        >>> # params: {"param_0": 42}
    """
    # Preprocess calculated fields if present and not already processed
    if preprocess_calculated_fields and query.get("calculated_fields"):
        from .calculated_field_processor import \
            preprocess_calculated_fields as preprocess_calc_fields

        query = preprocess_calc_fields(query)

    # Extract query parts
    tables = query.get("tables", [])
    joins = query.get("joins", [])
    columns = query.get("columns", [])
    filters = query.get("filters", [])
    group_by = query.get("group_by", [])
    order_by = query.get("order_by", [])
    limit = query.get("limit")

    if not tables or not columns:
        raise ValueError("Query must have at least one table and one column")

    # Validate all table names and aliases
    for table in tables:
        table_name = table.get("name", "")
        validate_identifier(table_name, "table name")

        # Optional: Application-specific table whitelist validation
        if table_validator:
            table_validator(table_name)

        # Validate alias if present
        if table.get("alias"):
            validate_identifier(table["alias"], "table alias")

    # Validate all column names and aliases
    for col in columns:
        column_name = col.get("column", "")
        # Skip validation if sql_expression is provided (calculated fields use expression directly)
        # Also allow wildcard for SELECT *
        if column_name != "*" and not col.get("sql_expression"):
            validate_identifier(column_name, "column name")

            # Validate column alias if present for regular columns
            # (aliases are double-quoted in SQL so they can contain special chars,
            # but we validate regular column aliases for consistency)
            if col.get("alias"):
                validate_identifier(col["alias"], "column alias")
        # Note: For calculated fields (with sql_expression), we skip alias validation
        # because calculated field names can contain spaces, %, etc. and are safely
        # quoted as AS "alias" in the generated SQL

    # Validate JOIN types against whitelist
    for join in joins:
        join_type = join.get("join_type", "INNER").upper()
        if join_type not in ALLOWED_JOIN_TYPES:
            raise ValueError(
                f"Invalid JOIN type: '{join_type}'. "
                f"Allowed types: {sorted(ALLOWED_JOIN_TYPES)}"
            )

    # Build table_id -> table reference mapping
    table_refs = {}
    for table in tables:
        table_id = table["id"]
        if table.get("alias"):
            table_refs[table_id] = f'"{table["alias"]}"'
        else:
            table_refs[table_id] = f'"{table["name"]}"'

    # Build SELECT clause
    select_parts = []
    for col in columns:
        table_id = col["table_id"]
        column_name = col["column"]
        agg = col.get("aggregation", "none")
        alias = col.get("alias")
        date_trunc = col.get("date_trunc")

        # Check for custom SQL expression (for calculated fields, etc.)
        sql_expression = col.get("sql_expression")

        # Validate aggregation function
        if agg not in ALLOWED_AGGREGATIONS:
            raise ValueError(
                f"Invalid aggregation function: '{agg}'. "
                f"Allowed functions: {sorted(ALLOWED_AGGREGATIONS)}"
            )

        # Validate date_trunc period if present
        if date_trunc and date_trunc not in ALLOWED_DATE_TRUNCS:
            raise ValueError(
                f"Invalid date_trunc period: '{date_trunc}'. "
                f"Allowed periods: {sorted(ALLOWED_DATE_TRUNCS)}"
            )

        # Get table reference for this column
        table_ref = table_refs.get(table_id, f'"{tables[0]["name"]}"')

        # Build column expression
        if sql_expression:
            # Use custom SQL expression (e.g., for calculated fields)
            # Check if expression already contains aggregation
            has_aggregation = col.get("_has_aggregation", False)

            # Only apply aggregation if requested and not already present
            if agg and agg != "none" and not has_aggregation:
                if agg == "count_distinct":
                    expr = f"COUNT(DISTINCT ({sql_expression}))"
                else:
                    expr = f"{agg.upper()}({sql_expression})"
            else:
                expr = sql_expression
        elif date_trunc:
            col_ref = f'{table_ref}."{column_name}"'
            date_trunc_expr = f"DATE_TRUNC('{date_trunc}', {col_ref})"
            # Apply date formatting if date_format is specified
            date_format = col.get("date_format")
            if date_format:
                pg_format = convert_revealbi_date_format_to_postgres(date_format)
                expr = f"TO_CHAR({date_trunc_expr}, '{pg_format}')"
            else:
                expr = date_trunc_expr
        elif agg and agg != "none":
            # Check if column needs type casting (e.g., boolean to int for SUM/AVG)
            cast_type = col.get("cast_type")

            if agg == "count_distinct":
                if column_name == "*":
                    expr = "COUNT(DISTINCT *)"
                else:
                    expr = f'COUNT(DISTINCT {table_ref}."{column_name}")'
            else:
                if column_name == "*":
                    expr = f"{agg.upper()}(*)"
                else:
                    col_ref = f'{table_ref}."{column_name}"'
                    # Apply type cast if specified (e.g., ::int for boolean SUM)
                    if cast_type:
                        col_ref = f"({col_ref})::{cast_type}"
                    expr = f"{agg.upper()}({col_ref})"
        else:
            if column_name == "*":
                expr = "*"
            else:
                expr = f'{table_ref}."{column_name}"'

        if alias:
            expr = f'{expr} AS "{alias}"'

        select_parts.append(expr)

    # Build FROM clause with JOINs
    main_table = tables[0]
    from_clause = f'"{main_table["schema"]}"."{main_table["name"]}"'
    if main_table.get("alias"):
        from_clause += f' AS "{main_table["alias"]}"'

    # Add JOIN clauses
    for join in joins:
        # Find the joined table
        to_table = next((t for t in tables if t["id"] == join["to_table_id"]), None)
        if not to_table:
            continue

        # Get table references
        from_ref = table_refs[join["from_table_id"]]
        to_ref = table_refs[join["to_table_id"]]

        # Validate and get JOIN type
        join_type = join.get("join_type", "INNER").upper()
        if join_type not in ALLOWED_JOIN_TYPES:
            raise ValueError(f"Invalid JOIN type: {join_type}")

        # Validate join column names
        from_column = join["from_column"]
        to_column = join["to_column"]
        validate_identifier(from_column, "join from_column")
        validate_identifier(to_column, "join to_column")

        table_sql = f'"{to_table["schema"]}"."{to_table["name"]}"'
        if to_table.get("alias"):
            table_sql += f' AS "{to_table["alias"]}"'

        from_clause += (
            f" {join_type} JOIN {table_sql} ON "
            f'{from_ref}."{from_column}" = {to_ref}."{to_column}"'
        )

    # Build WHERE clause
    where_parts = []
    params = {}
    param_counter = 0

    for filt in filters:
        table_id = filt.get("table_id", "t1")
        column = filt["column"]
        operator = filt["operator"]
        value = filt["value"]

        # Check for custom SQL expression (for calculated fields in filters)
        sql_expression = filt.get("sql_expression")

        # Validate filter column name (skip if using sql_expression)
        if not sql_expression:
            validate_identifier(column, "filter column")

        # Validate operator against whitelist
        if operator not in ALLOWED_OPERATORS:
            raise ValueError(
                f"Invalid filter operator: '{operator}'. "
                f"Allowed operators: {sorted(ALLOWED_OPERATORS)}"
            )

        # Build column reference - use sql_expression if provided, otherwise build from table.column
        if sql_expression:
            col_ref = f"({sql_expression})"
        else:
            # Get table reference for this filter
            table_ref = table_refs.get(table_id, f'"{tables[0]["name"]}"')
            col_ref = f'{table_ref}."{column}"'

        if operator == "eq":
            # Handle NULL equality (IS NULL)
            if value is None:
                where_parts.append(f"{col_ref} IS NULL")
            else:
                param_name = f"param_{param_counter}"
                # Handle boolean columns compared with 0 or 1 (cast to int)
                if value in (0, 1):
                    where_parts.append(f"({col_ref})::int = :{param_name}")
                else:
                    where_parts.append(f"{col_ref} = :{param_name}")
                params[param_name] = value
                param_counter += 1
        elif operator == "ne":
            if value is None:
                where_parts.append(f"{col_ref} IS NOT NULL")
            else:
                param_name = f"param_{param_counter}"
                where_parts.append(f"{col_ref} != :{param_name}")
                params[param_name] = value
                param_counter += 1
        elif operator == "gt":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} > :{param_name}")
            params[param_name] = value
            param_counter += 1
        elif operator == "gte":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} >= :{param_name}")
            params[param_name] = value
            param_counter += 1
        elif operator == "lt":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} < :{param_name}")
            params[param_name] = value
            param_counter += 1
        elif operator == "lte":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} <= :{param_name}")
            params[param_name] = value
            param_counter += 1
        elif operator == "in":
            # Guard against empty list (invalid SQL: IN ())
            if not value:
                # Empty IN list evaluates to FALSE (no rows match)
                where_parts.append("FALSE")
                continue

            param_names = []
            for val in value:
                param_name = f"param_{param_counter}"
                param_names.append(f":{param_name}")
                params[param_name] = val
                param_counter += 1
            where_parts.append(f'{col_ref} IN ({", ".join(param_names)})')
        elif operator == "in_or_null":
            # Handle mixed selection of concrete values AND NULL
            # Generates: (col IN (...) OR col IS NULL)
            if not value:
                # No concrete values, just NULL filter
                where_parts.append(f"{col_ref} IS NULL")
                continue

            param_names = []
            for val in value:
                param_name = f"param_{param_counter}"
                param_names.append(f":{param_name}")
                params[param_name] = val
                param_counter += 1
            where_parts.append(
                f'({col_ref} IN ({", ".join(param_names)}) OR {col_ref} IS NULL)'
            )
        elif operator == "in_subquery":
            # For subquery filters (used in RLS filtering)
            subquery_sql = value.get("sql", "").strip()
            if subquery_sql:
                where_parts.append(f"{col_ref} IN ({subquery_sql})")
        elif operator == "like":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} LIKE :{param_name}")
            params[param_name] = f"%{value}%"
            param_counter += 1
        elif operator == "not_like":
            param_name = f"param_{param_counter}"
            where_parts.append(f"{col_ref} NOT LIKE :{param_name}")
            params[param_name] = f"%{value}%"
            param_counter += 1

    # Build SQL
    sql = f"SELECT {', '.join(select_parts)} FROM {from_clause}"

    if where_parts:
        sql += f" WHERE {' AND '.join(where_parts)}"

    if group_by:
        # Build GROUP BY expressions
        group_cols = []
        for col_name in group_by:
            # Find the corresponding column definition first
            col_def = next(
                (
                    c
                    for c in columns
                    if c.get("column") == col_name or c.get("alias") == col_name
                ),
                None,
            )
            if col_def:
                # Skip columns that have aggregation - they shouldn't be in GROUP BY
                # This includes both calculated fields with _has_aggregation flag
                # and regular columns with aggregation set
                if col_def.get("_has_aggregation") or (
                    col_def.get("aggregation") and col_def.get("aggregation") != "none"
                ):
                    continue

                # Check if this is a calculated field with sql_expression
                if col_def.get("sql_expression"):
                    # Use the sql_expression directly for GROUP BY
                    # No validation needed - sql_expression is already validated/safe
                    group_cols.append(col_def["sql_expression"])
                else:
                    # Regular column - validate the identifier
                    column_name = col_def["column"]
                    validate_identifier(column_name, "group_by column")

                    # Get table reference and column name
                    table_id = col_def.get("table_id", "t1")
                    table_ref = table_refs.get(table_id, f'"{tables[0]["name"]}"')
                    col_ref = f'{table_ref}."{column_name}"'

                    if col_def.get("date_trunc"):
                        # Use the same expression as in SELECT - DATE_TRUNC
                        date_trunc = col_def["date_trunc"]
                        group_cols.append(f"DATE_TRUNC('{date_trunc}', {col_ref})")
                    else:
                        # Regular column
                        group_cols.append(col_ref)
            else:
                # Fallback: column not found in definitions - validate and quote as-is
                validate_identifier(col_name, "group_by column")
                group_cols.append(f'"{col_name}"')
        # Only add GROUP BY clause if there are non-aggregate columns to group by
        if group_cols:
            sql += f" GROUP BY {', '.join(group_cols)}"

    if order_by:
        order_parts = []
        for order in order_by:
            col = order["column"]
            direction = order.get("direction", "asc").upper()

            # Validate direction
            if direction not in ALLOWED_ORDER_DIRECTIONS:
                # Default to ASC for invalid directions
                direction = "ASC"

            # Find the column definition first
            col_def = next(
                (c for c in columns if c["column"] == col or c.get("alias") == col),
                None,
            )

            if col_def:
                # Check if this is a calculated field with sql_expression
                if col_def.get("sql_expression"):
                    # Use the sql_expression directly for ORDER BY
                    # No validation needed - sql_expression is already validated/safe
                    order_parts.append(f"{col_def['sql_expression']} {direction}")
                else:
                    # Regular column - validate the identifier
                    column_name = col_def["column"]
                    validate_identifier(column_name, "order_by column")

                    # Get table reference and column name
                    table_id = col_def.get("table_id", "t1")
                    table_ref = table_refs.get(table_id, f'"{tables[0]["name"]}"')
                    col_ref = f'{table_ref}."{column_name}"'

                    if col_def.get("date_trunc"):
                        # Use the same expression as in SELECT/GROUP BY - DATE_TRUNC
                        date_trunc = col_def["date_trunc"]
                        expr = f"DATE_TRUNC('{date_trunc}', {col_ref})"
                        order_parts.append(f"{expr} {direction}")
                    else:
                        # Regular column
                        order_parts.append(f"{col_ref} {direction}")
            else:
                # Fallback: column not found in definitions - validate and quote as-is
                validate_identifier(col, "order_by column")
                order_parts.append(f'"{col}" {direction}')
        sql += f" ORDER BY {', '.join(order_parts)}"

    # Handle LIMIT clause (use is not None to allow limit=0)
    if limit is not None:
        sql += f" LIMIT {int(limit)}"

    # Post-process scalar subquery placeholders (for percent-of-total patterns)
    sql = _postprocess_scalar_subqueries(sql)

    return sql, params
