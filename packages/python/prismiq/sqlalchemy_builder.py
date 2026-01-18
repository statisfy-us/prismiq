"""SQLAlchemy-compatible SQL query builder.

This module provides a query builder that generates SQL with SQLAlchemy-style
named parameters (:param_name) instead of PostgreSQL positional parameters ($1, $2).

Use this when working with SQLAlchemy's `text()` function.
"""

from __future__ import annotations

from typing import Any, Callable

from .sql_utils import (ALLOWED_AGGREGATIONS, ALLOWED_DATE_TRUNCS,
                        ALLOWED_JOIN_TYPES, ALLOWED_OPERATORS,
                        ALLOWED_ORDER_DIRECTIONS, validate_identifier)


def build_sql_from_dict(
    query: dict[str, Any],
    *,
    table_validator: Callable[[str], None] | None = None,
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
            - calculated_fields: list[dict] (optional, handled by caller)

        table_validator: Optional callback to validate table names against
                         application-specific whitelist. Should raise ValueError
                         if table is not allowed. This enables business-specific
                         table access control while keeping core logic generic.

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

        # Validate column alias if present (alias must always be valid for SELECT ... AS "alias")
        if col.get("alias"):
            validate_identifier(col["alias"], "column alias")

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
            expr = f"DATE_TRUNC('{date_trunc}', {col_ref})"
        elif agg and agg != "none":
            if agg == "count_distinct":
                if column_name == "*":
                    expr = "COUNT(DISTINCT *)"
                else:
                    expr = f'COUNT(DISTINCT {table_ref}."{column_name}")'
            else:
                if column_name == "*":
                    expr = f"{agg.upper()}(*)"
                else:
                    expr = f'{agg.upper()}({table_ref}."{column_name}")'
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
            # Validate group by column name
            validate_identifier(col_name, "group_by column")

            # Find the corresponding column definition to check for date_trunc
            col_def = next(
                (
                    c
                    for c in columns
                    if c.get("column") == col_name or c.get("alias") == col_name
                ),
                None,
            )
            if col_def:
                # Get table reference and column name
                table_id = col_def.get("table_id", "t1")
                column_name = col_def["column"]
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
                # Fallback: column not found in definitions, quote as-is
                group_cols.append(f'"{col_name}"')
        sql += f" GROUP BY {', '.join(group_cols)}"

    if order_by:
        order_parts = []
        for order in order_by:
            col = order["column"]
            direction = order.get("direction", "asc").upper()

            # Validate order by column name
            validate_identifier(col, "order_by column")

            # Validate direction
            if direction not in ALLOWED_ORDER_DIRECTIONS:
                # Default to ASC for invalid directions
                direction = "ASC"

            # Find the column definition to check for date_trunc
            col_def = next(
                (c for c in columns if c["column"] == col or c.get("alias") == col),
                None,
            )

            if col_def:
                # Get table reference and column name
                table_id = col_def.get("table_id", "t1")
                column_name = col_def["column"]
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
                # Fallback: column not found in definitions, quote as-is
                order_parts.append(f'"{col}" {direction}')
        sql += f" ORDER BY {', '.join(order_parts)}"

    # Handle LIMIT clause (use is not None to allow limit=0)
    if limit is not None:
        sql += f" LIMIT {int(limit)}"

    return sql, params
