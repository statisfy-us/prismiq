"""
Query builder for converting QueryDefinition to parameterized SQL.

This module provides the QueryBuilder class that generates safe,
parameterized SQL queries from QueryDefinition objects.
"""

from __future__ import annotations

from typing import Any

from prismiq.types import (
    AggregationType,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    JoinType,
    QueryDefinition,
    SortDefinition,
)


class QueryBuilder:
    """
    Builds parameterized SQL queries from QueryDefinition objects.

    Uses the database schema to validate table and column references,
    and generates SQL with proper identifier quoting for safety.

    Example:
        >>> builder = QueryBuilder(schema)
        >>> sql, params = builder.build(query_definition)
        >>> # sql: 'SELECT "users"."email" FROM "users" WHERE "users"."id" = $1'
        >>> # params: [42]
    """

    def __init__(self, schema: DatabaseSchema) -> None:
        """
        Initialize the query builder.

        Args:
            schema: Database schema for validation.
        """
        self._schema = schema

    def validate(self, query: QueryDefinition) -> list[str]:
        """
        Validate a query definition against the schema.

        Args:
            query: Query definition to validate.

        Returns:
            List of validation error messages (empty if valid).
        """
        errors: list[str] = []

        # Build table_id -> table_name mapping
        table_map: dict[str, str] = {}
        for qt in query.tables:
            table_map[qt.id] = qt.name

        # Validate tables exist in schema
        for qt in query.tables:
            if not self._schema.has_table(qt.name):
                errors.append(f"Table '{qt.name}' not found in schema")

        # Validate columns exist in tables
        for col in query.columns:
            table_name = table_map.get(col.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table and not table.has_column(col.column):
                    errors.append(f"Column '{col.column}' not found in table '{table_name}'")

        # Validate join columns
        for join in query.joins:
            # From column
            from_table_name = table_map.get(join.from_table_id)
            if from_table_name:
                from_table = self._schema.get_table(from_table_name)
                if from_table and not from_table.has_column(join.from_column):
                    errors.append(
                        f"Join column '{join.from_column}' not found in table '{from_table_name}'"
                    )

            # To column
            to_table_name = table_map.get(join.to_table_id)
            if to_table_name:
                to_table = self._schema.get_table(to_table_name)
                if to_table and not to_table.has_column(join.to_column):
                    errors.append(
                        f"Join column '{join.to_column}' not found in table '{to_table_name}'"
                    )

        # Validate filter columns
        for f in query.filters:
            table_name = table_map.get(f.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table and not table.has_column(f.column):
                    errors.append(f"Filter column '{f.column}' not found in table '{table_name}'")

        # Validate order by columns
        for o in query.order_by:
            table_name = table_map.get(o.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table and not table.has_column(o.column):
                    errors.append(f"Order by column '{o.column}' not found in table '{table_name}'")

        return errors

    def build(self, query: QueryDefinition) -> tuple[str, list[Any]]:
        """
        Build a parameterized SQL query.

        Args:
            query: Query definition to build.

        Returns:
            Tuple of (sql_string, parameters) where parameters use $1, $2 placeholders.
        """
        params: list[Any] = []

        # Build table_id -> table reference mapping
        table_refs = self._build_table_refs(query)

        # SELECT clause
        select_clause = self._build_select(query.columns, table_refs)

        # FROM clause
        from_clause = self._build_from(query, table_refs)

        # WHERE clause
        where_clause, params = self._build_where(query.filters, table_refs, params)

        # GROUP BY clause
        group_by_clause = self._build_group_by(query, table_refs)

        # ORDER BY clause
        order_by_clause = self._build_order_by(query.order_by, table_refs)

        # LIMIT and OFFSET
        limit_clause = ""
        if query.limit is not None:
            params.append(query.limit)
            limit_clause = f" LIMIT ${len(params)}"

        offset_clause = ""
        if query.offset is not None:
            params.append(query.offset)
            offset_clause = f" OFFSET ${len(params)}"

        # Combine all clauses
        sql = f"SELECT {select_clause} FROM {from_clause}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        if group_by_clause:
            sql += f" GROUP BY {group_by_clause}"
        if order_by_clause:
            sql += f" ORDER BY {order_by_clause}"
        sql += limit_clause + offset_clause

        return sql, params

    def _build_table_refs(self, query: QueryDefinition) -> dict[str, str]:
        """Build mapping from table_id to quoted table reference."""
        refs: dict[str, str] = {}
        for qt in query.tables:
            if qt.alias:
                refs[qt.id] = self._quote_identifier(qt.alias)
            else:
                refs[qt.id] = self._quote_identifier(qt.name)
        return refs

    def _build_select(self, columns: list[ColumnSelection], table_refs: dict[str, str]) -> str:
        """Build the SELECT clause."""
        parts: list[str] = []
        for col in columns:
            table_ref = table_refs[col.table_id]
            col_ref = f"{table_ref}.{self._quote_identifier(col.column)}"

            # Apply aggregation if specified
            if col.aggregation != AggregationType.NONE:
                col_ref = self._apply_aggregation(col_ref, col.aggregation)

            # Apply alias if specified
            if col.alias:
                col_ref = f"{col_ref} AS {self._quote_identifier(col.alias)}"

            parts.append(col_ref)

        return ", ".join(parts)

    def _apply_aggregation(self, col_ref: str, agg: AggregationType) -> str:
        """Apply aggregation function to column reference."""
        agg_map = {
            AggregationType.SUM: "SUM",
            AggregationType.AVG: "AVG",
            AggregationType.COUNT: "COUNT",
            AggregationType.COUNT_DISTINCT: "COUNT_DISTINCT",
            AggregationType.MIN: "MIN",
            AggregationType.MAX: "MAX",
        }

        if agg == AggregationType.COUNT_DISTINCT:
            return f"COUNT(DISTINCT {col_ref})"

        func = agg_map.get(agg, "")
        if func:
            return f"{func}({col_ref})"

        return col_ref

    def _build_from(self, query: QueryDefinition, table_refs: dict[str, str]) -> str:
        """Build the FROM clause including JOINs."""
        if not query.tables:
            return ""

        # First table
        first_table = query.tables[0]
        sql = self._quote_identifier(first_table.name)
        if first_table.alias:
            sql += f" AS {self._quote_identifier(first_table.alias)}"

        # Add JOINs
        for join in query.joins:
            # Find the table being joined (to_table)
            to_table = query.get_table_by_id(join.to_table_id)
            if to_table is None:
                continue

            join_type = self._join_type_sql(join.join_type)
            from_ref = table_refs[join.from_table_id]
            to_ref = table_refs[join.to_table_id]

            table_sql = self._quote_identifier(to_table.name)
            if to_table.alias:
                table_sql += f" AS {self._quote_identifier(to_table.alias)}"

            sql += (
                f" {join_type} JOIN {table_sql} ON "
                f"{from_ref}.{self._quote_identifier(join.from_column)} = "
                f"{to_ref}.{self._quote_identifier(join.to_column)}"
            )

        return sql

    def _join_type_sql(self, join_type: JoinType) -> str:
        """Convert JoinType enum to SQL keyword."""
        return {
            JoinType.INNER: "INNER",
            JoinType.LEFT: "LEFT",
            JoinType.RIGHT: "RIGHT",
            JoinType.FULL: "FULL",
        }.get(join_type, "INNER")

    def _build_where(
        self,
        filters: list[FilterDefinition],
        table_refs: dict[str, str],
        params: list[Any],
    ) -> tuple[str, list[Any]]:
        """Build the WHERE clause."""
        if not filters:
            return "", params

        conditions: list[str] = []
        for f in filters:
            table_ref = table_refs[f.table_id]
            col_ref = f"{table_ref}.{self._quote_identifier(f.column)}"

            condition, params = self._build_condition(col_ref, f, params)
            conditions.append(condition)

        return " AND ".join(conditions), params

    def _build_condition(
        self, col_ref: str, f: FilterDefinition, params: list[Any]
    ) -> tuple[str, list[Any]]:
        """Build a single filter condition."""
        op = f.operator

        if op == FilterOperator.EQ:
            params.append(f.value)
            return f"{col_ref} = ${len(params)}", params

        if op == FilterOperator.NEQ:
            params.append(f.value)
            return f"{col_ref} <> ${len(params)}", params

        if op == FilterOperator.GT:
            params.append(f.value)
            return f"{col_ref} > ${len(params)}", params

        if op == FilterOperator.GTE:
            params.append(f.value)
            return f"{col_ref} >= ${len(params)}", params

        if op == FilterOperator.LT:
            params.append(f.value)
            return f"{col_ref} < ${len(params)}", params

        if op == FilterOperator.LTE:
            params.append(f.value)
            return f"{col_ref} <= ${len(params)}", params

        if op == FilterOperator.IN:
            if isinstance(f.value, list):
                placeholders: list[str] = []
                for v in f.value:
                    params.append(v)
                    placeholders.append(f"${len(params)}")
                return f"{col_ref} IN ({', '.join(placeholders)})", params
            params.append(f.value)
            return f"{col_ref} IN (${len(params)})", params

        if op == FilterOperator.NOT_IN:
            if isinstance(f.value, list):
                placeholders = []
                for v in f.value:
                    params.append(v)
                    placeholders.append(f"${len(params)}")
                return f"{col_ref} NOT IN ({', '.join(placeholders)})", params
            params.append(f.value)
            return f"{col_ref} NOT IN (${len(params)})", params

        if op == FilterOperator.LIKE:
            params.append(f.value)
            return f"{col_ref} LIKE ${len(params)}", params

        if op == FilterOperator.ILIKE:
            params.append(f.value)
            return f"{col_ref} ILIKE ${len(params)}", params

        if op == FilterOperator.BETWEEN:
            if isinstance(f.value, list | tuple) and len(f.value) == 2:
                params.append(f.value[0])
                p1 = len(params)
                params.append(f.value[1])
                p2 = len(params)
                return f"{col_ref} BETWEEN ${p1} AND ${p2}", params
            # Fallback for invalid between value
            return "1=1", params

        if op == FilterOperator.IS_NULL:
            return f"{col_ref} IS NULL", params

        if op == FilterOperator.IS_NOT_NULL:
            return f"{col_ref} IS NOT NULL", params

        # Unknown operator - return tautology
        return "1=1", params

    def _build_group_by(self, query: QueryDefinition, table_refs: dict[str, str]) -> str:
        """Build the GROUP BY clause."""
        group_by_cols = query.derive_group_by()
        if not group_by_cols:
            return ""

        parts: list[str] = []
        for g in group_by_cols:
            table_ref = table_refs[g.table_id]
            parts.append(f"{table_ref}.{self._quote_identifier(g.column)}")

        return ", ".join(parts)

    def _build_order_by(self, order_by: list[SortDefinition], table_refs: dict[str, str]) -> str:
        """Build the ORDER BY clause."""
        if not order_by:
            return ""

        parts: list[str] = []
        for o in order_by:
            table_ref = table_refs[o.table_id]
            parts.append(f"{table_ref}.{self._quote_identifier(o.column)} {o.direction.value}")

        return ", ".join(parts)

    def _quote_identifier(self, identifier: str) -> str:
        """
        Quote a SQL identifier to prevent injection.

        Args:
            identifier: Column or table name.

        Returns:
            Quoted identifier (e.g., "column_name").
        """
        # Escape any existing double quotes
        escaped = identifier.replace('"', '""')
        return f'"{escaped}"'
