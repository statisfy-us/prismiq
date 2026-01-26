"""Query builder for converting QueryDefinition to parameterized SQL.

This module provides the QueryBuilder class that generates safe,
parameterized SQL queries from QueryDefinition objects.
"""

from __future__ import annotations

from datetime import date, datetime
from difflib import get_close_matches
from typing import Any

from pydantic import BaseModel, ConfigDict

from prismiq.calculated_fields import ExpressionParser
from prismiq.types import (
    AggregationType,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    JoinType,
    QueryDefinition,
)

# ============================================================================
# Validation Models
# ============================================================================


class ValidationError(BaseModel):
    """Detailed validation error."""

    model_config = ConfigDict(strict=True)

    code: str
    """Machine-readable error code."""

    message: str
    """User-friendly error message."""

    field: str | None = None
    """Path to the problematic field (e.g., 'tables[0].name')."""

    suggestion: str | None = None
    """Suggested fix."""


class ValidationResult(BaseModel):
    """Complete validation result."""

    model_config = ConfigDict(strict=True)

    valid: bool
    """Whether the query is valid."""

    errors: list[ValidationError]
    """List of validation errors (empty if valid)."""


# Error codes
ERROR_TABLE_NOT_FOUND = "TABLE_NOT_FOUND"
ERROR_COLUMN_NOT_FOUND = "COLUMN_NOT_FOUND"
ERROR_INVALID_JOIN = "INVALID_JOIN"
ERROR_TYPE_MISMATCH = "TYPE_MISMATCH"
ERROR_INVALID_AGGREGATION = "INVALID_AGGREGATION"
ERROR_EMPTY_QUERY = "EMPTY_QUERY"
ERROR_CIRCULAR_JOIN = "CIRCULAR_JOIN"
ERROR_AMBIGUOUS_COLUMN = "AMBIGUOUS_COLUMN"
ERROR_INVALID_TIME_SERIES = "INVALID_TIME_SERIES"


class QueryBuilder:
    """Builds parameterized SQL queries from QueryDefinition objects.

    Uses the database schema to validate table and column references,
    and generates SQL with proper identifier quoting for safety.

    Example:
        >>> builder = QueryBuilder(schema)
        >>> sql, params = builder.build(query_definition)
        >>> # sql: 'SELECT "users"."email" FROM "users" WHERE "users"."id" = $1'
        >>> # params: [42]

    With schema qualification:
        >>> builder = QueryBuilder(schema, schema_name="org_123")
        >>> sql, params = builder.build(query_definition)
        >>> # sql: 'SELECT "org_123"."users"."email" FROM "org_123"."users" ...'
    """

    def __init__(
        self,
        schema: DatabaseSchema,
        schema_name: str | None = None,
    ) -> None:
        """Initialize the query builder.

        Args:
            schema: Database schema for validation.
            schema_name: PostgreSQL schema name for schema-qualified table references.
                If None, tables are referenced without schema prefix (uses search_path).
        """
        self._schema = schema
        self._schema_name = schema_name

    def validate(self, query: QueryDefinition) -> list[str]:
        """Validate a query definition against the schema.

        Args:
            query: Query definition to validate.

        Returns:
            List of validation error messages (empty if valid).

        Note:
            This method returns simple string errors for backward compatibility.
            Use validate_detailed() for richer error information.
        """
        result = self.validate_detailed(query)
        return [err.message for err in result.errors]

    def validate_detailed(self, query: QueryDefinition) -> ValidationResult:
        """Validate a query definition with detailed error information.

        Args:
            query: Query definition to validate.

        Returns:
            ValidationResult with detailed errors including suggestions.
        """
        errors: list[ValidationError] = []

        # Build table_id -> table_name mapping
        table_map: dict[str, str] = {}
        for qt in query.tables:
            table_map[qt.id] = qt.name

        # Get all available table names for suggestions
        available_tables = self._schema.table_names()

        # Validate tables exist in schema
        for i, qt in enumerate(query.tables):
            if not self._schema.has_table(qt.name):
                suggestion = self._suggest_similar(qt.name, available_tables)
                errors.append(
                    ValidationError(
                        code=ERROR_TABLE_NOT_FOUND,
                        message=f"Table '{qt.name}' not found in schema",
                        field=f"tables[{i}].name",
                        suggestion=suggestion,
                    )
                )

        # Build set of calculated field names for reference checking
        calculated_field_names = {cf.name for cf in query.calculated_fields}

        # Validate columns exist in tables
        for i, col in enumerate(query.columns):
            table_name = table_map.get(col.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table:
                    # Allow "*" for COUNT(*) - this is a valid SQL pattern
                    if col.column == "*" and col.aggregation == AggregationType.COUNT:
                        continue  # Skip further validation for COUNT(*)

                    # Allow references to calculated fields - they're defined in calculated_fields
                    if col.column in calculated_field_names:
                        continue  # Skip further validation for calculated field references

                    if not table.has_column(col.column):
                        available_columns = [c.name for c in table.columns]
                        suggestion = self._suggest_similar(col.column, available_columns)
                        errors.append(
                            ValidationError(
                                code=ERROR_COLUMN_NOT_FOUND,
                                message=f"Column '{col.column}' not found in table '{table_name}'",
                                field=f"columns[{i}].column",
                                suggestion=suggestion,
                            )
                        )
                    else:
                        # Validate aggregation is valid for column type
                        if col.aggregation != AggregationType.NONE:
                            column_schema = table.get_column(col.column)
                            if column_schema:
                                agg_error = self._validate_aggregation(
                                    col.aggregation, column_schema.data_type, col.column
                                )
                                if agg_error:
                                    errors.append(
                                        ValidationError(
                                            code=ERROR_INVALID_AGGREGATION,
                                            message=agg_error,
                                            field=f"columns[{i}].aggregation",
                                            suggestion=self._suggest_aggregation(
                                                column_schema.data_type
                                            ),
                                        )
                                    )

        # Validate join columns
        for i, join in enumerate(query.joins):
            # From column
            from_table_name = table_map.get(join.from_table_id)
            if from_table_name:
                from_table = self._schema.get_table(from_table_name)
                if from_table and not from_table.has_column(join.from_column):
                    available_columns = [c.name for c in from_table.columns]
                    suggestion = self._suggest_similar(join.from_column, available_columns)
                    errors.append(
                        ValidationError(
                            code=ERROR_INVALID_JOIN,
                            message=f"Join column '{join.from_column}' not found in table '{from_table_name}'",
                            field=f"joins[{i}].from_column",
                            suggestion=suggestion,
                        )
                    )

            # To column
            to_table_name = table_map.get(join.to_table_id)
            if to_table_name:
                to_table = self._schema.get_table(to_table_name)
                if to_table and not to_table.has_column(join.to_column):
                    available_columns = [c.name for c in to_table.columns]
                    suggestion = self._suggest_similar(join.to_column, available_columns)
                    errors.append(
                        ValidationError(
                            code=ERROR_INVALID_JOIN,
                            message=f"Join column '{join.to_column}' not found in table '{to_table_name}'",
                            field=f"joins[{i}].to_column",
                            suggestion=suggestion,
                        )
                    )

        # Validate filter columns
        for i, f in enumerate(query.filters):
            table_name = table_map.get(f.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table:
                    # Allow references to calculated fields - they're defined in calculated_fields
                    if f.column in calculated_field_names:
                        continue  # Skip further validation for calculated field references

                    if not table.has_column(f.column):
                        available_columns = [c.name for c in table.columns]
                        suggestion = self._suggest_similar(f.column, available_columns)
                        errors.append(
                            ValidationError(
                                code=ERROR_COLUMN_NOT_FOUND,
                                message=f"Filter column '{f.column}' not found in table '{table_name}'",
                                field=f"filters[{i}].column",
                                suggestion=suggestion,
                            )
                        )
                    else:
                        # Validate filter value type matches column type
                        column_schema = table.get_column(f.column)
                        if column_schema and f.value is not None:
                            type_error = self._validate_filter_type(
                                f.operator, f.value, column_schema.data_type, f.column
                            )
                            if type_error:
                                errors.append(
                                    ValidationError(
                                        code=ERROR_TYPE_MISMATCH,
                                        message=type_error,
                                        field=f"filters[{i}].value",
                                        suggestion=None,
                                    )
                                )

        # Validate order by columns
        for i, o in enumerate(query.order_by):
            # Allow references to calculated fields
            if o.column in calculated_field_names:
                continue

            table_name = table_map.get(o.table_id)
            if table_name:
                table = self._schema.get_table(table_name)
                if table and not table.has_column(o.column):
                    available_columns = [c.name for c in table.columns]
                    suggestion = self._suggest_similar(o.column, available_columns)
                    errors.append(
                        ValidationError(
                            code=ERROR_COLUMN_NOT_FOUND,
                            message=f"Order by column '{o.column}' not found in table '{table_name}'",
                            field=f"order_by[{i}].column",
                            suggestion=suggestion,
                        )
                    )

        # Validate time series configuration
        if query.time_series:
            ts_errors = self._validate_time_series(query, table_map)
            errors.extend(ts_errors)

        # Check for circular joins
        circular_error = self._check_circular_joins(query)
        if circular_error:
            errors.append(circular_error)

        return ValidationResult(valid=len(errors) == 0, errors=errors)

    def _validate_time_series(
        self, query: QueryDefinition, table_map: dict[str, str]
    ) -> list[ValidationError]:
        """Validate time series configuration."""
        errors: list[ValidationError] = []

        if not query.time_series:
            return errors

        ts = query.time_series
        table_name = table_map.get(ts.table_id)

        if not table_name:
            errors.append(
                ValidationError(
                    code=ERROR_INVALID_TIME_SERIES,
                    message=f"Time series table_id '{ts.table_id}' not found",
                    field="time_series.table_id",
                    suggestion=None,
                )
            )
            return errors

        table = self._schema.get_table(table_name)
        if not table:
            return errors

        # Validate date column exists
        if not table.has_column(ts.date_column):
            available_columns = [c.name for c in table.columns]
            suggestion = self._suggest_similar(ts.date_column, available_columns)
            errors.append(
                ValidationError(
                    code=ERROR_INVALID_TIME_SERIES,
                    message=f"Date column '{ts.date_column}' not found in table '{table_name}'",
                    field="time_series.date_column",
                    suggestion=suggestion,
                )
            )
        else:
            # Validate column is a date/timestamp type
            column_schema = table.get_column(ts.date_column)
            if column_schema:
                date_types = {
                    "date",
                    "timestamp",
                    "timestamp without time zone",
                    "timestamp with time zone",
                    "timestamptz",
                }
                is_date_type = any(dt in column_schema.data_type.lower() for dt in date_types)
                if not is_date_type:
                    errors.append(
                        ValidationError(
                            code=ERROR_INVALID_TIME_SERIES,
                            message=f"Column '{ts.date_column}' is not a date/timestamp type (found: {column_schema.data_type})",
                            field="time_series.date_column",
                            suggestion="Use a column with date, timestamp, or timestamptz type",
                        )
                    )

        return errors

    def _suggest_similar(
        self, name: str, candidates: list[str], max_suggestions: int = 3
    ) -> str | None:
        """Find similar names for suggestions."""
        matches = get_close_matches(
            name.lower(), [c.lower() for c in candidates], n=max_suggestions, cutoff=0.6
        )
        if matches:
            # Map back to original case
            original_matches = []
            for match in matches:
                for candidate in candidates:
                    if candidate.lower() == match:
                        original_matches.append(candidate)
                        break
            if len(original_matches) == 1:
                return f"Did you mean '{original_matches[0]}'?"
            elif len(original_matches) > 1:
                return f"Did you mean one of: {', '.join(repr(m) for m in original_matches)}?"
        return None

    def _validate_aggregation(
        self, agg: AggregationType, data_type: str, column_name: str
    ) -> str | None:
        """Validate that an aggregation is valid for a data type."""
        # Numeric aggregations
        numeric_aggs = {AggregationType.SUM, AggregationType.AVG}
        numeric_types = {
            "integer",
            "bigint",
            "smallint",
            "numeric",
            "decimal",
            "real",
            "double precision",
        }

        if agg in numeric_aggs:
            # Check if type is numeric-ish
            data_type_lower = data_type.lower()
            is_numeric = any(nt in data_type_lower for nt in numeric_types)
            if not is_numeric:
                return f"Aggregation '{agg.value}' is not valid for column '{column_name}' of type '{data_type}'"

        return None

    def _suggest_aggregation(self, data_type: str) -> str | None:
        """Suggest valid aggregations for a data type."""
        data_type_lower = data_type.lower()
        numeric_types = {
            "integer",
            "bigint",
            "smallint",
            "numeric",
            "decimal",
            "real",
            "double precision",
        }

        is_numeric = any(nt in data_type_lower for nt in numeric_types)
        if is_numeric:
            return "Valid aggregations for this column: sum, avg, min, max, count"
        else:
            return "Valid aggregations for this column: min, max, count"

    def _validate_filter_type(
        self, operator: FilterOperator, value: Any, data_type: str, column_name: str
    ) -> str | None:
        """Validate that a filter value is compatible with the column type."""
        data_type_lower = data_type.lower()

        # Check for list operators - combined condition
        if operator in (FilterOperator.IN, FilterOperator.NOT_IN) and not isinstance(value, list):
            return f"Operator '{operator.value}' requires a list value for column '{column_name}'"

        # Check for between operator - combined condition
        if operator == FilterOperator.BETWEEN and (
            not isinstance(value, list | tuple) or len(value) != 2
        ):
            return f"Operator 'between' requires a list/tuple of exactly 2 values for column '{column_name}'"

        # Basic numeric type checking
        numeric_types = {
            "integer",
            "bigint",
            "smallint",
            "numeric",
            "decimal",
            "real",
            "double precision",
        }
        is_numeric_column = any(nt in data_type_lower for nt in numeric_types)

        if is_numeric_column and operator not in (
            FilterOperator.IS_NULL,
            FilterOperator.IS_NOT_NULL,
        ):
            # For IN/NOT_IN, check list items
            if operator in (FilterOperator.IN, FilterOperator.NOT_IN) and isinstance(value, list):
                for v in value:
                    if v is not None and not isinstance(v, int | float):
                        return f"Column '{column_name}' is numeric but received non-numeric value in list"
            elif operator == FilterOperator.BETWEEN and isinstance(value, list | tuple):
                for v in value:
                    if not isinstance(v, int | float):
                        return f"Column '{column_name}' is numeric but received non-numeric value in range"
            elif not isinstance(value, int | float | list | tuple):
                return f"Column '{column_name}' is numeric but received non-numeric value"

        return None

    def _check_circular_joins(self, query: QueryDefinition) -> ValidationError | None:
        """Check for circular join references."""
        if not query.joins:
            return None

        # Build a simple adjacency list
        # For simplicity, we just check if any table joins to itself
        for i, join in enumerate(query.joins):
            if join.from_table_id == join.to_table_id:
                return ValidationError(
                    code=ERROR_CIRCULAR_JOIN,
                    message="Join references the same table on both sides",
                    field=f"joins[{i}]",
                    suggestion="A join should connect two different tables",
                )

        return None

    def build(self, query: QueryDefinition) -> tuple[str, list[Any]]:
        """Build a parameterized SQL query.

        Args:
            query: Query definition to build.

        Returns:
            Tuple of (sql_string, parameters) where parameters use $1, $2 placeholders.
        """
        params: list[Any] = []

        # Build table_id -> table_name mapping for schema lookup
        table_map: dict[str, str] = {}
        for qt in query.tables:
            table_map[qt.id] = qt.name

        # Build table_id -> table reference mapping
        table_refs = self._build_table_refs(query)

        # Build calculated field SQL map (shared across SELECT, WHERE, ORDER BY)
        calc_sql_map = self._build_calc_sql_map(query)

        # SELECT clause - with time series support
        select_clause = self._build_select(query, table_refs, calc_sql_map)

        # FROM clause
        from_clause = self._build_from(query, table_refs)

        # WHERE clause
        where_clause, params = self._build_where(
            query.filters, table_refs, table_map, calc_sql_map, params
        )

        # GROUP BY clause - with time series support
        group_by_clause = self._build_group_by(query, table_refs, calc_sql_map)

        # ORDER BY clause - with time series support
        order_by_clause = self._build_order_by(query, table_refs, calc_sql_map)

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

    def _build_calc_sql_map(self, query: QueryDefinition) -> dict[str, str]:
        """Build mapping from calculated field names to their SQL expressions.

        Uses pre-computed sql_expression if available (recommended for inter-field
        dependency resolution). Otherwise parses the expression on-demand.

        Args:
            query: Query definition containing calculated_fields.

        Returns:
            Dict mapping calculated field name to SQL expression.
        """
        calc_sql_map: dict[str, str] = {}

        # Get base table reference for qualifying unqualified column references.
        # Prefer alias over name since FROM clause uses alias when present.
        # This prevents "ambiguous column" errors in multi-table queries.
        if query.tables:
            base_table = query.tables[0]
            base_table_ref = base_table.alias or base_table.name
        else:
            base_table_ref = None

        for cf in query.calculated_fields:
            # Use pre-computed SQL if available (handles inter-field dependencies).
            # IMPORTANT: sql_expression must be pre-validated and use parameterized
            # values. It should have all column references fully qualified with the
            # correct table alias/name to match the FROM clause.
            if cf.sql_expression:
                if not cf.sql_expression.strip():
                    raise ValueError(f"Calculated field '{cf.name}' has empty sql_expression")
                calc_sql_map[cf.name] = cf.sql_expression
            elif cf.expression:
                # Fall back to parsing on-demand. This is a secondary code path
                # that won't resolve inter-field references correctly. Prefer
                # providing sql_expression from resolve_calculated_fields().
                try:
                    parser = ExpressionParser()
                    ast = parser.parse(cf.expression)
                    calc_sql_map[cf.name] = ast.to_sql({}, default_table_ref=base_table_ref)
                except ValueError as e:
                    # Fail closed: raise a clear error instead of injecting raw text
                    raise ValueError(
                        f"Failed to parse calculated field '{cf.name}': {e}. "
                        f"Expression: {cf.expression!r}"
                    ) from e

        return calc_sql_map

    def _build_table_refs(self, query: QueryDefinition) -> dict[str, str]:
        """Build mapping from table_id to quoted table reference."""
        refs: dict[str, str] = {}
        for qt in query.tables:
            if qt.alias:
                refs[qt.id] = self._quote_identifier(qt.alias)
            else:
                refs[qt.id] = self._quote_identifier(qt.name)
        return refs

    def _build_select(
        self,
        query: QueryDefinition,
        table_refs: dict[str, str],
        calc_sql_map: dict[str, str],
    ) -> str:
        """Build the SELECT clause, including time series bucket if
        configured."""
        parts: list[str] = []

        # Add time series bucket column first if configured
        if query.time_series:
            ts = query.time_series
            table_ref = table_refs[ts.table_id]
            date_col = f"{table_ref}.{self._quote_identifier(ts.date_column)}"
            date_trunc = f"date_trunc('{ts.interval}', {date_col})"

            # Add alias if specified
            alias = ts.alias or f"{ts.date_column}_bucket"
            date_trunc = f"{date_trunc} AS {self._quote_identifier(alias)}"

            parts.append(date_trunc)

        # Add regular columns
        for col in query.columns:
            table_ref = table_refs[col.table_id]

            # Handle COUNT(*) specially - don't quote the asterisk
            if col.column == "*" and col.aggregation == AggregationType.COUNT:
                col_ref = "COUNT(*)"
            # Handle column with inline sql_expression (e.g., calculated field)
            elif col.sql_expression:
                col_ref = f"({col.sql_expression})"

                # Apply aggregation if specified
                if col.aggregation != AggregationType.NONE:
                    col_ref = self._apply_aggregation(col_ref, col.aggregation)
            # Handle calculated field references - expand to SQL expression
            elif col.column in calc_sql_map:
                # Use the converted SQL expression
                col_ref = f"({calc_sql_map[col.column]})"

                # Apply aggregation if specified
                if col.aggregation != AggregationType.NONE:
                    col_ref = self._apply_aggregation(col_ref, col.aggregation)
            else:
                col_ref = f"{table_ref}.{self._quote_identifier(col.column)}"

                # Apply date_trunc if specified (for date columns)
                if col.date_trunc:
                    col_ref = f"date_trunc('{col.date_trunc}', {col_ref})"

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
        """Build the FROM clause including JOINs.

        Uses schema-qualified table names if schema_name is set.
        """
        if not query.tables:
            return ""

        # Track which tables are already in the FROM clause
        tables_in_from: set[str] = set()

        # First table
        first_table = query.tables[0]
        sql = self._quote_table(first_table.name)
        if first_table.alias:
            sql += f" AS {self._quote_identifier(first_table.alias)}"
        tables_in_from.add(first_table.id)

        # Add JOINs
        for join in query.joins:
            # Find the table being joined (to_table)
            to_table = query.get_table_by_id(join.to_table_id)
            if to_table is None:
                continue

            join_type = self._join_type_sql(join.join_type)
            from_ref = table_refs[join.from_table_id]
            to_ref = table_refs[join.to_table_id]

            table_sql = self._quote_table(to_table.name)
            if to_table.alias:
                table_sql += f" AS {self._quote_identifier(to_table.alias)}"

            sql += (
                f" {join_type} JOIN {table_sql} ON "
                f"{from_ref}.{self._quote_identifier(join.from_column)} = "
                f"{to_ref}.{self._quote_identifier(join.to_column)}"
            )
            tables_in_from.add(join.to_table_id)

        # Add any remaining tables that aren't joined (creates implicit cross join)
        # This handles cases where columns are selected from multiple tables without explicit joins
        for qt in query.tables[1:]:
            if qt.id not in tables_in_from:
                table_sql = self._quote_table(qt.name)
                if qt.alias:
                    table_sql += f" AS {self._quote_identifier(qt.alias)}"
                sql += f", {table_sql}"
                tables_in_from.add(qt.id)

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
        table_map: dict[str, str],
        calc_sql_map: dict[str, str],
        params: list[Any],
    ) -> tuple[str, list[Any]]:
        """Build the WHERE clause."""
        if not filters:
            return "", params

        conditions: list[str] = []
        for f in filters:
            # Handle filter with inline sql_expression (e.g., calculated field)
            if f.sql_expression:
                col_ref = f"({f.sql_expression})"
                # No type coercion for calculated fields (type not known from schema)
                data_type = None
            # Handle calculated field references - expand to SQL expression
            elif f.column in calc_sql_map:
                col_ref = f"({calc_sql_map[f.column]})"
                # No type coercion for calculated fields (type not known from schema)
                data_type = None
            else:
                table_ref = table_refs[f.table_id]
                col_ref = f"{table_ref}.{self._quote_identifier(f.column)}"

                # Get column data type for value coercion
                table_name = table_map.get(f.table_id)
                data_type = None
                if table_name:
                    table = self._schema.get_table(table_name)
                    if table:
                        column = table.get_column(f.column)
                        if column:
                            data_type = column.data_type

            condition, params = self._build_condition(col_ref, f, data_type, params)
            conditions.append(condition)

        return " AND ".join(conditions), params

    def _build_condition(
        self,
        col_ref: str,
        f: FilterDefinition,
        data_type: str | None,
        params: list[Any],
    ) -> tuple[str, list[Any]]:
        """Build a single filter condition."""
        op = f.operator

        # Coerce the filter value to the appropriate Python type
        coerced_value = self._coerce_value(f.value, data_type)

        if op == FilterOperator.EQ:
            params.append(coerced_value)
            return f"{col_ref} = ${len(params)}", params

        if op == FilterOperator.NEQ:
            params.append(coerced_value)
            return f"{col_ref} <> ${len(params)}", params

        if op == FilterOperator.GT:
            params.append(coerced_value)
            return f"{col_ref} > ${len(params)}", params

        if op == FilterOperator.GTE:
            params.append(coerced_value)
            return f"{col_ref} >= ${len(params)}", params

        if op == FilterOperator.LT:
            params.append(coerced_value)
            return f"{col_ref} < ${len(params)}", params

        if op == FilterOperator.LTE:
            params.append(coerced_value)
            return f"{col_ref} <= ${len(params)}", params

        if op == FilterOperator.IN:
            if isinstance(coerced_value, list):
                placeholders: list[str] = []
                for v in coerced_value:
                    params.append(v)
                    placeholders.append(f"${len(params)}")
                return f"{col_ref} IN ({', '.join(placeholders)})", params
            params.append(coerced_value)
            return f"{col_ref} IN (${len(params)})", params

        if op == FilterOperator.NOT_IN:
            if isinstance(coerced_value, list):
                placeholders = []
                for v in coerced_value:
                    params.append(v)
                    placeholders.append(f"${len(params)}")
                return f"{col_ref} NOT IN ({', '.join(placeholders)})", params
            params.append(coerced_value)
            return f"{col_ref} NOT IN (${len(params)})", params

        if op == FilterOperator.LIKE:
            params.append(coerced_value)
            return f"{col_ref} LIKE ${len(params)}", params

        if op == FilterOperator.ILIKE:
            params.append(coerced_value)
            return f"{col_ref} ILIKE ${len(params)}", params

        if op == FilterOperator.BETWEEN:
            if isinstance(coerced_value, list | tuple) and len(coerced_value) == 2:
                params.append(coerced_value[0])
                p1 = len(params)
                params.append(coerced_value[1])
                p2 = len(params)
                return f"{col_ref} BETWEEN ${p1} AND ${p2}", params
            # Invalid BETWEEN value - raise error instead of silent fallback
            value_desc = (
                f"{len(coerced_value)} values"
                if isinstance(coerced_value, list | tuple)
                else type(coerced_value).__name__
            )
            raise ValueError(
                f"BETWEEN filter on column '{f.column}' requires exactly 2 values, got {value_desc}"
            )

        if op == FilterOperator.IS_NULL:
            return f"{col_ref} IS NULL", params

        if op == FilterOperator.IS_NOT_NULL:
            return f"{col_ref} IS NOT NULL", params

        if op == FilterOperator.IN_SUBQUERY:
            # For subquery filters (used in RLS filtering).
            # SECURITY: The SQL in value["sql"] is interpolated directly without
            # parameterization. Callers MUST ensure the SQL is safely generated
            # (e.g., from trusted internal code, not user input). This is by design
            # since subqueries cannot be parameterized.
            if not isinstance(f.value, dict):
                raise ValueError(
                    f"IN_SUBQUERY filter on column '{f.column}' requires "
                    f"value={{'sql': '...'}}, got {type(f.value).__name__}"
                )
            if "sql" not in f.value:
                raise ValueError(
                    f"IN_SUBQUERY filter on column '{f.column}' requires "
                    f"value={{'sql': '...'}}, missing 'sql' key"
                )
            subquery_sql = f.value["sql"].strip()
            if not subquery_sql:
                raise ValueError(f"IN_SUBQUERY filter on column '{f.column}' has empty SQL")
            return f"{col_ref} IN ({subquery_sql})", params

        # Unknown operator - raise error instead of silent fallback
        raise ValueError(f"Unknown filter operator: {op}")

    def _build_group_by(
        self,
        query: QueryDefinition,
        table_refs: dict[str, str],
        calc_sql_map: dict[str, str],
    ) -> str:
        """Build the GROUP BY clause, including time series bucket if
        configured."""
        group_by_parts: list[str] = []

        # Add time series bucket to GROUP BY if present
        if query.time_series:
            ts = query.time_series
            table_ref = table_refs[ts.table_id]
            date_col = f"{table_ref}.{self._quote_identifier(ts.date_column)}"
            group_by_parts.append(f"date_trunc('{ts.interval}', {date_col})")

        # Build set of calculated fields that have internal aggregation
        calc_fields_with_agg = {
            cf.name for cf in query.calculated_fields if cf.has_internal_aggregation
        }

        # Build lookup from (table_id, column) to column selection for date_trunc/sql_expression
        column_lookup: dict[tuple[str, str], ColumnSelection] = {
            (col.table_id, col.column): col for col in query.columns
        }

        # Add regular GROUP BY columns
        group_by_cols = query.derive_group_by()
        for g in group_by_cols:
            # Skip calculated fields that have internal aggregation
            # These fields contain SUM, COUNT, etc. and should NOT be in GROUP BY
            if g.column in calc_fields_with_agg:
                continue

            # Look up the column selection to check for date_trunc/sql_expression
            col_sel = column_lookup.get((g.table_id, g.column))

            # Handle column with inline sql_expression (e.g., calculated field)
            if col_sel and col_sel.sql_expression:
                group_by_parts.append(f"({col_sel.sql_expression})")
            # Handle calculated field references - expand to SQL expression
            elif g.column in calc_sql_map:
                group_by_parts.append(f"({calc_sql_map[g.column]})")
            else:
                table_ref = table_refs[g.table_id]
                col_ref = f"{table_ref}.{self._quote_identifier(g.column)}"

                # Apply date_trunc if specified (must match SELECT clause)
                if col_sel and col_sel.date_trunc:
                    col_ref = f"date_trunc('{col_sel.date_trunc}', {col_ref})"

                group_by_parts.append(col_ref)

        # If time series is present and there are aggregations, we need GROUP BY
        if query.time_series and query.has_aggregations() and not group_by_cols:
            # Only have the time series bucket
            pass
        elif not group_by_parts:
            return ""

        return ", ".join(group_by_parts)

    def _build_order_by(
        self,
        query: QueryDefinition,
        table_refs: dict[str, str],
        calc_sql_map: dict[str, str],
    ) -> str:
        """Build the ORDER BY clause, adding time series bucket if
        configured."""
        parts: list[str] = []

        # If time series is present and no explicit order by, order by date bucket
        if query.time_series and not query.order_by:
            ts = query.time_series
            table_ref = table_refs[ts.table_id]
            date_col = f"{table_ref}.{self._quote_identifier(ts.date_column)}"
            parts.append(f"date_trunc('{ts.interval}', {date_col}) ASC")
        else:
            # Use explicit order by
            for o in query.order_by:
                # Handle calculated field references - expand to SQL expression
                if o.column in calc_sql_map:
                    col_ref = f"({calc_sql_map[o.column]})"
                else:
                    table_ref = table_refs[o.table_id]
                    col_ref = f"{table_ref}.{self._quote_identifier(o.column)}"
                parts.append(f"{col_ref} {o.direction.value}")

        return ", ".join(parts)

    def _coerce_value(self, value: Any, data_type: str | None) -> Any:
        """Coerce a filter value to the appropriate Python type for asyncpg.

        asyncpg requires Python date/datetime objects for date/timestamp columns,
        not strings. This method converts string values to appropriate Python types
        based on the column's data type.

        Args:
            value: The filter value (may be a string, list, or other type).
            data_type: The PostgreSQL data type of the column (e.g., 'date', 'timestamp').

        Returns:
            The value coerced to the appropriate Python type.
        """
        if value is None or data_type is None:
            return value

        data_type_lower = data_type.lower()

        # Check if this is a date/timestamp column
        date_types = {"date"}
        timestamp_types = {
            "timestamp",
            "timestamp without time zone",
            "timestamp with time zone",
            "timestamptz",
        }

        is_date = (
            any(dt in data_type_lower for dt in date_types) and "timestamp" not in data_type_lower
        )
        is_timestamp = any(dt in data_type_lower for dt in timestamp_types)

        if not is_date and not is_timestamp:
            return value

        # Handle list values (for IN, NOT_IN, BETWEEN)
        if isinstance(value, list):
            return [self._coerce_single_date_value(v, is_date) for v in value]

        if isinstance(value, tuple):
            return tuple(self._coerce_single_date_value(v, is_date) for v in value)

        return self._coerce_single_date_value(value, is_date)

    def _coerce_single_date_value(self, value: Any, is_date: bool) -> Any:
        """Coerce a single value to date or datetime.

        Args:
            value: The value to coerce.
            is_date: True for date columns, False for timestamp columns.

        Returns:
            Python date or datetime object, or original value if not a string/date type.

        Raises:
            ValueError: If a string value cannot be parsed as a valid date/datetime.
        """
        # Already the correct type
        if isinstance(value, datetime):
            return value.date() if is_date else value
        if isinstance(value, date):
            return value if is_date else datetime.combine(value, datetime.min.time())

        # Try to parse string values
        if isinstance(value, str):
            expected_type = "date" if is_date else "datetime"
            try:
                # Try ISO format with time first (e.g., "2026-01-01T00:00:00")
                if "T" in value or " " in value:
                    # Handle both 'T' separator and space separator
                    dt = datetime.fromisoformat(value.replace(" ", "T"))
                    return dt.date() if is_date else dt
                # Date only format (e.g., "2026-01-01")
                dt = datetime.strptime(value, "%Y-%m-%d")
                return dt.date() if is_date else dt
            except ValueError as e:
                raise ValueError(
                    f"Invalid {expected_type} value: {value!r}. "
                    f"Expected ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)."
                ) from e

        return value

    def _quote_identifier(self, identifier: str) -> str:
        """Quote a SQL identifier to prevent injection.

        Args:
            identifier: Column or table name.

        Returns:
            Quoted identifier (e.g., "column_name").
        """
        # Escape any existing double quotes
        escaped = identifier.replace('"', '""')
        return f'"{escaped}"'

    def _quote_table(self, table_name: str) -> str:
        """Quote a table name with optional schema qualification.

        Args:
            table_name: Name of the table.

        Returns:
            Schema-qualified table name if schema_name is set,
            otherwise just the quoted table name.
            E.g., "org_123"."users" or just "users"
        """
        quoted_table = self._quote_identifier(table_name)
        if self._schema_name:
            return f"{self._quote_identifier(self._schema_name)}.{quoted_table}"
        return quoted_table
