"""
Query executor for running validated queries against PostgreSQL.

This module provides the QueryExecutor class that executes queries
with timeout handling, row limits, and proper result formatting.
"""

from __future__ import annotations

import asyncio
import time
from datetime import date, datetime, timedelta
from datetime import time as time_type
from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID

from prismiq.query import QueryBuilder
from prismiq.sql_validator import SQLValidationError, SQLValidator
from prismiq.types import (
    DatabaseSchema,
    QueryDefinition,
    QueryExecutionError,
    QueryResult,
    QueryTimeoutError,
    QueryValidationError,
)

if TYPE_CHECKING:
    from asyncpg import Pool


def serialize_value(value: Any) -> Any:
    """Convert database values to JSON-serializable Python types."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        # Convert Decimal to float for JSON serialization
        return float(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, time_type):
        return value.isoformat()
    if isinstance(value, timedelta):
        return value.total_seconds()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    if isinstance(value, list | tuple):
        return [serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {k: serialize_value(v) for k, v in value.items()}
    return value


class QueryExecutor:
    """
    Executes validated queries against a PostgreSQL database.

    Handles query validation, timeout enforcement, row limits,
    and result formatting.

    Example:
        >>> executor = QueryExecutor(pool, schema, query_timeout=30.0)
        >>> result = await executor.execute(query_definition)
        >>> print(result.row_count)
        100
    """

    def __init__(
        self,
        pool: Pool,
        schema: DatabaseSchema,
        query_timeout: float = 30.0,
        max_rows: int = 10000,
    ) -> None:
        """
        Initialize the query executor.

        Args:
            pool: asyncpg connection pool.
            schema: Database schema for validation.
            query_timeout: Maximum query execution time in seconds.
            max_rows: Maximum number of rows to return.
        """
        self._pool = pool
        self._schema = schema
        self._query_timeout = query_timeout
        self._max_rows = max_rows
        self._builder = QueryBuilder(schema)
        self._sql_validator = SQLValidator(schema)

    async def execute(self, query: QueryDefinition) -> QueryResult:
        """
        Execute a query and return results.

        Args:
            query: Query definition to execute.

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            QueryValidationError: If the query fails validation.
            QueryTimeoutError: If the query exceeds the timeout.
            QueryExecutionError: If the query execution fails.
        """
        # Validate first
        errors = self._builder.validate(query)
        if errors:
            raise QueryValidationError("Query validation failed", errors=errors)

        # Build SQL
        sql, params = self._builder.build(query)

        # Apply row limit if not already specified
        effective_limit = query.limit
        truncated = False
        if effective_limit is None or effective_limit > self._max_rows:
            # Add limit to params and update SQL
            # We need to rebuild with the limit
            limited_query = query.model_copy(update={"limit": self._max_rows + 1})
            sql, params = self._builder.build(limited_query)
            truncated = True

        # Execute with timeout
        start_time = time.perf_counter()
        try:
            rows = await self._execute_with_timeout(sql, params)
        except asyncio.TimeoutError as e:
            raise QueryTimeoutError(
                f"Query exceeded timeout of {self._query_timeout} seconds",
                timeout_seconds=self._query_timeout,
            ) from e
        except Exception as e:
            raise QueryExecutionError(str(e), sql=sql) from e

        execution_time_ms = (time.perf_counter() - start_time) * 1000

        # Check if result was truncated
        if truncated and len(rows) > self._max_rows:
            rows = rows[: self._max_rows]
            truncated = True
        else:
            truncated = False

        # Convert to QueryResult
        return self._format_result(rows, execution_time_ms, truncated)

    async def preview(self, query: QueryDefinition, limit: int = 100) -> QueryResult:
        """
        Execute a query with a smaller limit for quick preview.

        Args:
            query: Query definition to execute.
            limit: Maximum rows to return (default: 100).

        Returns:
            QueryResult with limited rows.
        """
        # Create a copy with the specified limit
        preview_query = query.model_copy(update={"limit": min(limit, self._max_rows)})
        return await self.execute(preview_query)

    async def explain(self, query: QueryDefinition) -> dict[str, Any]:
        """
        Run EXPLAIN ANALYZE on a query.

        Args:
            query: Query definition to analyze.

        Returns:
            Query plan as a dictionary.

        Raises:
            QueryValidationError: If the query fails validation.
            QueryExecutionError: If the explain fails.
        """
        # Validate first
        errors = self._builder.validate(query)
        if errors:
            raise QueryValidationError("Query validation failed", errors=errors)

        # Build SQL
        sql, params = self._builder.build(query)

        # Wrap with EXPLAIN ANALYZE
        explain_sql = f"EXPLAIN (ANALYZE, FORMAT JSON) {sql}"

        try:
            async with self._pool.acquire() as conn:
                result = await conn.fetchval(explain_sql, *params)
                if result and isinstance(result, list) and len(result) > 0:
                    return result[0]
                return {"plan": result}
        except Exception as e:
            raise QueryExecutionError(str(e), sql=explain_sql) from e

    async def execute_raw_sql(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
        tenant_id: str | None = None,
        tenant_column: str = "tenant_id",
    ) -> QueryResult:
        """
        Execute a raw SQL query with validation.

        Args:
            sql: Raw SQL query (must be SELECT only).
            params: Optional named parameters for the query.
            tenant_id: Optional tenant ID for row-level filtering.
            tenant_column: Column name for tenant filtering (default: 'tenant_id').

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            SQLValidationError: If the SQL fails validation.
            QueryTimeoutError: If the query exceeds the timeout.
            QueryExecutionError: If the query execution fails.
        """
        # Validate the SQL
        validation = self._sql_validator.validate(sql)
        if not validation.valid:
            raise SQLValidationError(
                "SQL validation failed: " + "; ".join(validation.errors),
                errors=validation.errors,
            )

        # Use the sanitized SQL from validation
        safe_sql = validation.sanitized_sql
        assert safe_sql is not None  # Guaranteed by valid=True

        # Apply row limit using a CTE wrapper
        limited_sql = f"WITH _cte AS ({safe_sql}) SELECT * FROM _cte LIMIT {self._max_rows + 1}"

        # Convert named params to positional for asyncpg
        # asyncpg uses $1, $2, etc. for positional params
        param_list: list[Any] = []
        if params:
            # Replace :name with $n
            import re

            param_index = 1
            param_mapping: dict[str, int] = {}

            def replace_param(match: re.Match[str]) -> str:
                nonlocal param_index
                name = match.group(1)
                if name not in param_mapping:
                    param_mapping[name] = param_index
                    param_index += 1
                return f"${param_mapping[name]}"

            limited_sql = re.sub(r":([a-zA-Z_][a-zA-Z0-9_]*)", replace_param, limited_sql)

            # Build param list in order
            param_list = [None] * len(param_mapping)
            for name, idx in param_mapping.items():
                if name in params:
                    param_list[idx - 1] = params[name]
                else:
                    raise SQLValidationError(
                        f"Missing parameter: {name}",
                        errors=[f"Parameter '{name}' referenced in SQL but not provided"],
                    )

        # Execute with timeout
        start_time = time.perf_counter()
        try:
            rows = await self._execute_with_timeout(limited_sql, param_list)
        except asyncio.TimeoutError as e:
            raise QueryTimeoutError(
                f"Query exceeded timeout of {self._query_timeout} seconds",
                timeout_seconds=self._query_timeout,
            ) from e
        except Exception as e:
            raise QueryExecutionError(str(e), sql=sql) from e

        execution_time_ms = (time.perf_counter() - start_time) * 1000

        # Check if result was truncated
        truncated = len(rows) > self._max_rows
        if truncated:
            rows = rows[: self._max_rows]

        return self._format_result(rows, execution_time_ms, truncated)

    async def _execute_with_timeout(self, sql: str, params: list[Any]) -> list[Any]:
        """Execute SQL with timeout."""
        async with self._pool.acquire() as conn:
            # Set statement timeout on the connection
            timeout_ms = int(self._query_timeout * 1000)
            await conn.execute(f"SET statement_timeout = {timeout_ms}")

            try:
                return await asyncio.wait_for(
                    conn.fetch(sql, *params),
                    timeout=self._query_timeout,
                )
            finally:
                # Reset statement timeout
                await conn.execute("SET statement_timeout = 0")

    def _format_result(
        self, rows: list[Any], execution_time_ms: float, truncated: bool
    ) -> QueryResult:
        """Format raw database rows into QueryResult."""
        if not rows:
            return QueryResult(
                columns=[],
                column_types=[],
                rows=[],
                row_count=0,
                truncated=False,
                execution_time_ms=execution_time_ms,
            )

        # Extract column names and types from first row
        first_row = rows[0]
        columns = list(first_row.keys())

        # Get column types (using Python type names)
        # Note: Must iterate over keys(), not the record itself (which yields values)
        column_types: list[str] = []
        for key in columns:
            value = first_row[key]
            if value is None:
                column_types.append("unknown")
            else:
                column_types.append(type(value).__name__)

        # Convert rows to lists with JSON-serializable values
        result_rows = [[serialize_value(v) for v in row.values()] for row in rows]

        return QueryResult(
            columns=columns,
            column_types=column_types,
            rows=result_rows,
            row_count=len(result_rows),
            truncated=truncated,
            execution_time_ms=execution_time_ms,
        )
