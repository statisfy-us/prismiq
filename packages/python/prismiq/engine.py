"""
Main PrismiqEngine class that ties all components together.

This module provides the central engine class for the Prismiq
embedded analytics platform.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

import asyncpg

from prismiq.cache import CacheBackend, CacheConfig, QueryCache
from prismiq.dashboard_store import DashboardStore, InMemoryDashboardStore
from prismiq.executor import QueryExecutor
from prismiq.metrics import record_cache_hit, record_query_execution, set_active_connections
from prismiq.persistence import PostgresDashboardStore, SavedQueryStore, ensure_tables
from prismiq.query import QueryBuilder, ValidationResult
from prismiq.schema import SchemaIntrospector
from prismiq.schema_config import (
    ColumnConfig,
    EnhancedDatabaseSchema,
    SchemaConfig,
    SchemaConfigManager,
    TableConfig,
)
from prismiq.sql_validator import SQLValidationResult, SQLValidator
from prismiq.timeseries import TimeInterval
from prismiq.transforms import pivot_data
from prismiq.trends import ComparisonPeriod, TrendResult, calculate_trend
from prismiq.types import (
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    QueryDefinition,
    QueryResult,
    TableSchema,
    TimeSeriesConfig,
)

if TYPE_CHECKING:
    from asyncpg import Pool


class PrismiqEngine:
    """
    Main engine for embedded analytics.

    Provides a high-level interface for schema introspection,
    query building, and execution.

    Example:
        >>> engine = PrismiqEngine(
        ...     database_url="postgresql://user:pass@localhost/db",
        ...     exposed_tables=["users", "orders"],
        ... )
        >>> await engine.startup()
        >>>
        >>> schema = await engine.get_schema()
        >>> result = await engine.execute_query(query_definition)
        >>>
        >>> await engine.shutdown()

    With FastAPI:
        >>> from fastapi import FastAPI
        >>> from prismiq import PrismiqEngine, create_router
        >>>
        >>> app = FastAPI()
        >>> engine = PrismiqEngine(database_url)
        >>>
        >>> @app.on_event("startup")
        >>> async def startup():
        ...     await engine.startup()
        ...     app.include_router(create_router(engine), prefix="/api/analytics")
        >>>
        >>> @app.on_event("shutdown")
        >>> async def shutdown():
        ...     await engine.shutdown()

    With caching:
        >>> from prismiq import PrismiqEngine, InMemoryCache
        >>>
        >>> cache = InMemoryCache()
        >>> engine = PrismiqEngine(
        ...     database_url="postgresql://...",
        ...     cache=cache,
        ...     cache_ttl=300,  # 5 minutes
        ... )
    """

    def __init__(
        self,
        database_url: str,
        exposed_tables: list[str] | None = None,
        query_timeout: float = 30.0,
        max_rows: int = 10000,
        schema_name: str = "public",
        schema_config: SchemaConfig | None = None,
        cache: CacheBackend | None = None,
        cache_ttl: int = 300,
        enable_metrics: bool = True,
        persist_dashboards: bool = False,
    ) -> None:
        """
        Initialize the Prismiq engine.

        Args:
            database_url: PostgreSQL connection URL.
            exposed_tables: List of tables to expose. If None, all tables are exposed.
            query_timeout: Maximum query execution time in seconds.
            max_rows: Maximum number of rows to return per query.
            schema_name: PostgreSQL schema to use (default: "public").
            schema_config: Initial schema configuration for display names, hidden items, etc.
            cache: Optional cache backend for query result caching.
            cache_ttl: Default cache TTL in seconds (default: 300).
            enable_metrics: Whether to record Prometheus metrics (default: True).
            persist_dashboards: Store dashboards in PostgreSQL (default: False uses in-memory).
        """
        self._database_url = database_url
        self._exposed_tables = exposed_tables
        self._query_timeout = query_timeout
        self._max_rows = max_rows
        self._schema_name = schema_name
        self._cache_ttl = cache_ttl
        self._enable_metrics = enable_metrics
        self._persist_dashboards = persist_dashboards

        # Schema config manager
        self._schema_config_manager = SchemaConfigManager(schema_config)

        # Cache backend
        self._cache: CacheBackend | None = cache
        self._query_cache: QueryCache | None = None
        if cache:
            cache_config = CacheConfig(
                default_ttl=cache_ttl,
                query_ttl=cache_ttl,
                schema_ttl=cache_ttl * 12,  # Schema cache lasts 12x longer
            )
            self._query_cache = QueryCache(cache, config=cache_config)

        # These will be initialized in startup()
        self._pool: Pool | None = None
        self._introspector: SchemaIntrospector | None = None
        self._executor: QueryExecutor | None = None
        self._builder: QueryBuilder | None = None
        self._sql_validator: SQLValidator | None = None
        self._schema: DatabaseSchema | None = None
        self._dashboard_store: DashboardStore | None = None
        self._saved_query_store: SavedQueryStore | None = None

    @property
    def cache(self) -> CacheBackend | None:
        """Get the cache backend."""
        return self._cache

    @property
    def dashboard_store(self) -> DashboardStore:
        """Get the dashboard store.

        Returns:
            The dashboard store (PostgreSQL or in-memory).

        Raises:
            RuntimeError: If engine has not been started.
        """
        if self._dashboard_store is None:
            raise RuntimeError("Engine not started. Call 'await engine.startup()' first.")
        return self._dashboard_store

    @property
    def dashboards(self) -> DashboardStore:
        """Alias for dashboard_store for convenience.

        Returns:
            The dashboard store.
        """
        return self.dashboard_store

    @property
    def saved_query_store(self) -> SavedQueryStore:
        """Get the saved query store.

        Returns:
            The saved query store (PostgreSQL-backed).

        Raises:
            RuntimeError: If engine has not been started.
        """
        if self._saved_query_store is None:
            raise RuntimeError("Engine not started. Call 'await engine.startup()' first.")
        return self._saved_query_store

    async def startup(self) -> None:
        """
        Initialize the engine.

        Creates the database connection pool and introspects the schema.
        Must be called before using other methods.
        """
        # Create connection pool
        self._pool = await asyncpg.create_pool(
            self._database_url,
            min_size=1,
            max_size=10,
        )

        # Create schema introspector with optional caching
        self._introspector = SchemaIntrospector(
            self._pool,
            exposed_tables=self._exposed_tables,
            schema_name=self._schema_name,
            cache=self._cache,
            cache_ttl=self._cache_ttl,
        )

        # Introspect schema
        self._schema = await self._introspector.get_schema()

        # Create query builder, executor, and SQL validator
        self._builder = QueryBuilder(self._schema)
        self._sql_validator = SQLValidator(self._schema)
        self._executor = QueryExecutor(
            self._pool,
            self._schema,
            query_timeout=self._query_timeout,
            max_rows=self._max_rows,
        )

        # Initialize dashboard store
        if self._persist_dashboards:
            # Create tables if they don't exist
            await ensure_tables(self._pool)
            self._dashboard_store = PostgresDashboardStore(self._pool)
            self._saved_query_store = SavedQueryStore(self._pool)
        else:
            self._dashboard_store = InMemoryDashboardStore()
            # SavedQueryStore requires PostgreSQL - no in-memory fallback
            self._saved_query_store = None  # type: ignore[assignment]

        # Update metrics
        if self._enable_metrics:
            set_active_connections(self._pool.get_size())

    async def shutdown(self) -> None:
        """
        Shutdown the engine.

        Closes the database connection pool. Should be called on application shutdown.
        """
        if self._pool:
            await self._pool.close()
            self._pool = None

        self._introspector = None
        self._executor = None
        self._builder = None
        self._sql_validator = None
        self._schema = None
        self._dashboard_store = None
        self._saved_query_store = None

        # Update metrics
        if self._enable_metrics:
            set_active_connections(0)

    # ========================================================================
    # Health Check Methods
    # ========================================================================

    async def check_connection(self) -> bool:
        """
        Check if the database connection is healthy.

        Executes a simple query to verify the database connection.

        Returns:
            True if the connection is healthy.

        Raises:
            RuntimeError: If the engine has not been started.
            Exception: If the database connection fails.
        """
        self._ensure_started()
        assert self._pool is not None

        async with self._pool.acquire() as conn:
            await conn.fetchval("SELECT 1")

        return True

    # ========================================================================
    # Schema Methods
    # ========================================================================

    async def get_schema(self, force_refresh: bool = False) -> DatabaseSchema:
        """
        Get the complete database schema (raw, without config applied).

        Args:
            force_refresh: If True, bypass cache and introspect fresh.

        Returns:
            DatabaseSchema containing all exposed tables and relationships.

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        assert self._introspector is not None
        return await self._introspector.get_schema(force_refresh=force_refresh)

    async def get_enhanced_schema(self) -> EnhancedDatabaseSchema:
        """
        Get the database schema with configuration applied.

        Returns schema with display names, descriptions, and hidden
        tables/columns filtered out.

        Returns:
            EnhancedDatabaseSchema with configuration applied.

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        schema = await self.get_schema()
        return self._schema_config_manager.apply_to_schema(schema)

    async def get_table(self, table_name: str) -> TableSchema:
        """
        Get schema information for a single table.

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            TableSchema for the requested table.

        Raises:
            RuntimeError: If the engine has not been started.
            TableNotFoundError: If the table is not found.
        """
        self._ensure_started()
        assert self._introspector is not None
        return await self._introspector.get_table(table_name)

    # ========================================================================
    # Query Methods
    # ========================================================================

    async def execute_query(
        self,
        query: QueryDefinition,
        use_cache: bool = True,
    ) -> QueryResult:
        """
        Execute a query and return results.

        Args:
            query: Query definition to execute.
            use_cache: Whether to use cached results if available.

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            RuntimeError: If the engine has not been started.
            QueryValidationError: If the query fails validation.
            QueryTimeoutError: If the query exceeds the timeout.
            QueryExecutionError: If the query execution fails.
        """
        self._ensure_started()
        assert self._executor is not None

        start = time.perf_counter()

        # Check cache first
        if use_cache and self._query_cache:
            cached = await self._query_cache.get_result(query)
            if cached:
                if self._enable_metrics:
                    record_cache_hit(True)
                return cached
            if self._enable_metrics:
                record_cache_hit(False)

        # Execute query
        try:
            result = await self._executor.execute(query)

            # Cache the result
            if use_cache and self._query_cache:
                await self._query_cache.cache_result(query, result)

            # Record metrics
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "success")

            return result

        except Exception:
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "error")
            raise

    async def preview_query(self, query: QueryDefinition, limit: int = 100) -> QueryResult:
        """
        Execute a query with a limited number of rows.

        Args:
            query: Query definition to execute.
            limit: Maximum number of rows to return.

        Returns:
            QueryResult with limited rows.

        Raises:
            RuntimeError: If the engine has not been started.
            QueryValidationError: If the query fails validation.
        """
        self._ensure_started()
        assert self._executor is not None
        return await self._executor.preview(query, limit=limit)

    async def sample_column_values(
        self,
        table_name: str,
        column_name: str,
        limit: int = 5,
    ) -> list[Any]:
        """
        Get sample values from a column for data preview.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.
            limit: Maximum number of distinct values to return.

        Returns:
            List of sample values from the column.

        Raises:
            RuntimeError: If the engine has not been started.
            ValueError: If the table or column doesn't exist.
        """
        self._ensure_started()
        assert self._pool is not None
        assert self._schema is not None

        # Validate table exists
        table = self._schema.get_table(table_name)
        if table is None:
            raise ValueError(f"Table '{table_name}' not found")

        # Validate column exists
        column_exists = any(col.name == column_name for col in table.columns)
        if not column_exists:
            raise ValueError(f"Column '{column_name}' not found in table '{table_name}'")

        # Query distinct values with limit
        # Note: table_name and column_name are validated against the schema above,
        # so this is safe from SQL injection despite string interpolation
        sql = f"""
            SELECT DISTINCT "{column_name}"
            FROM "{table_name}"
            WHERE "{column_name}" IS NOT NULL
            ORDER BY "{column_name}"
            LIMIT {limit}
        """  # noqa: S608

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql)

        # Extract values and serialize
        from prismiq.executor import serialize_value

        return [serialize_value(row[0]) for row in rows]

    def validate_query(self, query: QueryDefinition) -> list[str]:
        """
        Validate a query without executing it.

        Args:
            query: Query definition to validate.

        Returns:
            List of validation error messages (empty if valid).

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        assert self._builder is not None
        return self._builder.validate(query)

    def validate_query_detailed(self, query: QueryDefinition) -> ValidationResult:
        """
        Validate a query with detailed error information.

        Args:
            query: Query definition to validate.

        Returns:
            ValidationResult with detailed errors including suggestions.

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        assert self._builder is not None
        return self._builder.validate_detailed(query)

    def generate_sql(self, query: QueryDefinition) -> str:
        """
        Generate SQL from a query definition without executing.

        Useful for previewing the SQL that will be executed.

        Args:
            query: Query definition to generate SQL for.

        Returns:
            The generated SQL string.

        Raises:
            RuntimeError: If the engine has not been started.
            QueryValidationError: If the query is invalid.
        """
        self._ensure_started()
        assert self._builder is not None

        # Validate first
        errors = self._builder.validate(query)
        if errors:
            from .types import QueryValidationError

            raise QueryValidationError("; ".join(errors), errors)

        sql, _ = self._builder.build(query)
        return sql

    # ========================================================================
    # Custom SQL Methods
    # ========================================================================

    async def validate_sql(self, sql: str) -> SQLValidationResult:
        """
        Validate a raw SQL query without executing.

        Checks that the SQL is a valid SELECT statement and only
        references tables visible in the schema.

        Args:
            sql: Raw SQL query to validate.

        Returns:
            SQLValidationResult with validation status and details.

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        assert self._sql_validator is not None
        return self._sql_validator.validate(sql)

    async def execute_raw_sql(
        self,
        sql: str,
        params: dict[str, Any] | None = None,
    ) -> QueryResult:
        """
        Execute a raw SQL query.

        Only SELECT statements are allowed. Queries are restricted
        to tables visible in the schema.

        Args:
            sql: Raw SQL query (SELECT only).
            params: Optional named parameters for the query.

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            RuntimeError: If the engine has not been started.
            SQLValidationError: If the SQL fails validation.
            QueryTimeoutError: If the query exceeds the timeout.
            QueryExecutionError: If the query execution fails.
        """
        self._ensure_started()
        assert self._executor is not None

        start = time.perf_counter()

        try:
            result = await self._executor.execute_raw_sql(sql, params)

            # Record metrics
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "success")

            return result

        except Exception:
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "error")
            raise

    # ========================================================================
    # Cache Methods
    # ========================================================================

    async def invalidate_cache(self, table_name: str | None = None) -> int:
        """
        Invalidate cached data.

        Args:
            table_name: If provided, invalidate only queries involving this table.
                        If None, invalidate all query cache.

        Returns:
            Number of cache entries invalidated.
        """
        if not self._query_cache or not self._cache:
            return 0

        if table_name:
            return await self._query_cache.invalidate_table(table_name)
        else:
            return await self._cache.clear("query:*")

    async def invalidate_schema_cache(self) -> None:
        """
        Invalidate the schema cache.

        Forces the next get_schema() call to introspect the database.
        """
        if self._introspector:
            await self._introspector.invalidate_cache()

    # ========================================================================
    # Time Series Methods
    # ========================================================================

    async def execute_timeseries_query(
        self,
        query: QueryDefinition,
        interval: TimeInterval,
        date_column: str,
        fill_missing: bool = True,
    ) -> QueryResult:
        """
        Execute a time series query with automatic bucketing.

        Adds date_trunc to the query for time bucketing and optionally
        fills missing time buckets.

        Args:
            query: Query definition to execute.
            interval: Time interval for bucketing.
            date_column: Name of the date/timestamp column to bucket.
            fill_missing: Whether to fill missing time buckets with default values.

        Returns:
            QueryResult with time-bucketed data.

        Raises:
            RuntimeError: If the engine has not been started.
            QueryValidationError: If the query fails validation.
            ValueError: If the date column is not found.
        """
        self._ensure_started()
        assert self._executor is not None

        # Find the table ID for the date column
        table_id = self._find_table_for_column(query, date_column)
        if table_id is None:
            raise ValueError(f"Date column '{date_column}' not found in query tables")

        # Create a modified query with time series config
        modified_query = QueryDefinition(
            tables=query.tables,
            joins=query.joins,
            columns=query.columns,
            filters=query.filters,
            group_by=query.group_by,
            order_by=query.order_by,
            limit=query.limit,
            offset=query.offset,
            time_series=TimeSeriesConfig(
                table_id=table_id,
                date_column=date_column,
                interval=interval.value,
                fill_missing=fill_missing,
            ),
        )

        return await self._executor.execute(modified_query)

    def _find_table_for_column(self, query: QueryDefinition, column_name: str) -> str | None:
        """Find the table ID that contains the specified column."""
        self._ensure_started()
        assert self._schema is not None

        for query_table in query.tables:
            table_schema = self._schema.get_table(query_table.name)
            if table_schema and table_schema.has_column(column_name):
                return query_table.id

        return None

    # ========================================================================
    # Transform Methods
    # ========================================================================

    def transform_pivot(
        self,
        result: QueryResult,
        row_column: str,
        pivot_column: str,
        value_column: str,
        aggregation: str = "sum",
    ) -> QueryResult:
        """
        Pivot a query result from long to wide format.

        Args:
            result: Query result to pivot.
            row_column: Column to use as row headers.
            pivot_column: Column to pivot into separate columns.
            value_column: Column containing values to aggregate.
            aggregation: Aggregation function: sum, avg, count, min, max.

        Returns:
            Pivoted QueryResult.
        """
        return pivot_data(
            result=result,
            row_column=row_column,
            pivot_column=pivot_column,
            value_column=value_column,
            aggregation=aggregation,
        )

    # ========================================================================
    # Trend Methods
    # ========================================================================

    def calculate_trend(
        self,
        current: float | None,
        previous: float | None,
        threshold: float = 0.001,
    ) -> TrendResult:
        """
        Calculate a trend between two values.

        Args:
            current: Current value.
            previous: Previous value for comparison.
            threshold: Changes smaller than this are considered "flat".

        Returns:
            TrendResult with direction and change metrics.
        """
        return calculate_trend(current, previous, threshold)

    async def calculate_metric_trend(
        self,
        query: QueryDefinition,
        comparison: ComparisonPeriod,
        current_start: date,
        current_end: date,
        value_column: str,
        date_column: str,
    ) -> TrendResult:
        """
        Calculate trend for a metric query.

        Executes the query for both current and comparison periods,
        then calculates the trend between them.

        Args:
            query: Query definition for the metric.
            comparison: Period to compare against.
            current_start: Start date of current period.
            current_end: End date of current period.
            value_column: Column containing the metric value.
            date_column: Column containing the date for filtering.

        Returns:
            TrendResult with current value, previous value, and change metrics.

        Raises:
            RuntimeError: If the engine has not been started.
            ValueError: If the date or value column is not found.
        """
        self._ensure_started()
        assert self._executor is not None

        # Find the table ID for the date column
        table_id = self._find_table_for_column(query, date_column)
        if table_id is None:
            raise ValueError(f"Date column '{date_column}' not found in query tables")

        # Calculate comparison period dates
        previous_start, previous_end = self._get_comparison_dates(
            comparison, current_start, current_end
        )

        # Execute query for current period
        current_query = self._add_date_filter(
            query, table_id, date_column, current_start, current_end
        )
        current_result = await self._executor.execute(current_query)

        # Execute query for previous period
        previous_query = self._add_date_filter(
            query, table_id, date_column, previous_start, previous_end
        )
        previous_result = await self._executor.execute(previous_query)

        # Extract values
        current_value = self._extract_value(current_result, value_column)
        previous_value = self._extract_value(previous_result, value_column)

        return calculate_trend(current_value, previous_value)

    def _get_comparison_dates(
        self,
        comparison: ComparisonPeriod,
        current_start: date,
        current_end: date,
    ) -> tuple[date, date]:
        """Calculate the comparison period dates."""
        period_days = (current_end - current_start).days + 1

        if comparison == ComparisonPeriod.PREVIOUS_PERIOD:
            previous_end = current_start - timedelta(days=1)
            previous_start = previous_end - timedelta(days=period_days - 1)
        elif comparison == ComparisonPeriod.PREVIOUS_YEAR:
            previous_start = current_start.replace(year=current_start.year - 1)
            previous_end = current_end.replace(year=current_end.year - 1)
        elif comparison == ComparisonPeriod.PREVIOUS_MONTH:
            # Move back one month
            if current_start.month == 1:
                previous_start = current_start.replace(year=current_start.year - 1, month=12)
            else:
                previous_start = current_start.replace(month=current_start.month - 1)

            if current_end.month == 1:
                previous_end = current_end.replace(year=current_end.year - 1, month=12)
            else:
                previous_end = current_end.replace(month=current_end.month - 1)
        elif comparison == ComparisonPeriod.PREVIOUS_WEEK:
            previous_start = current_start - timedelta(days=7)
            previous_end = current_end - timedelta(days=7)
        else:
            raise ValueError(f"Unknown comparison period: {comparison}")

        return previous_start, previous_end

    def _add_date_filter(
        self,
        query: QueryDefinition,
        table_id: str,
        date_column: str,
        start_date: date,
        end_date: date,
    ) -> QueryDefinition:
        """Add date range filters to a query."""
        new_filters = list(query.filters)
        new_filters.extend(
            [
                FilterDefinition(
                    table_id=table_id,
                    column=date_column,
                    operator=FilterOperator.GTE,
                    value=start_date.isoformat(),
                ),
                FilterDefinition(
                    table_id=table_id,
                    column=date_column,
                    operator=FilterOperator.LTE,
                    value=end_date.isoformat(),
                ),
            ]
        )

        return QueryDefinition(
            tables=query.tables,
            joins=query.joins,
            columns=query.columns,
            filters=new_filters,
            group_by=query.group_by,
            order_by=query.order_by,
            limit=query.limit,
            offset=query.offset,
            time_series=query.time_series,
        )

    def _extract_value(self, result: QueryResult, column: str) -> float | None:
        """Extract a single value from a query result."""
        if not result.rows:
            return None

        try:
            col_idx = result.columns.index(column)
        except ValueError:
            # Try finding by alias pattern (e.g., "sum_amount" for aggregated column)
            for i, col_name in enumerate(result.columns):
                if col_name == column or col_name.endswith(f"_{column}"):
                    col_idx = i
                    break
            else:
                raise ValueError(f"Column '{column}' not found in result")

        value = result.rows[0][col_idx]
        if value is None:
            return None

        return float(value)

    # ========================================================================
    # Schema Configuration Methods
    # ========================================================================

    def get_schema_config(self) -> SchemaConfig:
        """
        Get the current schema configuration.

        Returns:
            Current SchemaConfig with all table and column settings.
        """
        return self._schema_config_manager.get_config()

    def set_schema_config(self, config: SchemaConfig) -> None:
        """
        Replace the entire schema configuration.

        Args:
            config: New schema configuration.
        """
        self._schema_config_manager = SchemaConfigManager(config)

    def update_table_config(self, table_name: str, config: TableConfig) -> None:
        """
        Update configuration for a specific table.

        Args:
            table_name: Name of the table.
            config: New configuration for the table.
        """
        self._schema_config_manager.update_table_config(table_name, config)

    def update_column_config(self, table_name: str, column_name: str, config: ColumnConfig) -> None:
        """
        Update configuration for a specific column.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.
            config: New configuration for the column.
        """
        self._schema_config_manager.update_column_config(table_name, column_name, config)

    # ========================================================================
    # Private Methods
    # ========================================================================

    def _ensure_started(self) -> None:
        """Ensure the engine has been started."""
        if self._pool is None:
            raise RuntimeError("Engine not started. Call 'await engine.startup()' first.")
