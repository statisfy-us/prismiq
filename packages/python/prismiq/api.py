"""FastAPI routes for the Prismiq analytics engine.

This module provides a factory function to create an API router that
exposes schema, validation, and query execution endpoints.
"""

# ruff: noqa: B008  # FastAPI's Depends() in function defaults is standard pattern

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from datetime import date
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict

from prismiq import __version__
from prismiq.auth import AuthContext, create_header_auth_dependency
from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardExport,
    DashboardUpdate,
    Widget,
    WidgetCreate,
    WidgetUpdate,
)
from prismiq.filter_merge import FilterValue, merge_filters
from prismiq.logging import get_logger
from prismiq.permissions import (
    can_delete_dashboard,
    can_edit_dashboard,
    can_edit_widget,
    can_view_dashboard,
)
from prismiq.pins import PinnedDashboard, PinRequest, ReorderPinsRequest, UnpinRequest
from prismiq.query import ValidationResult
from prismiq.schema_config import EnhancedDatabaseSchema, EnhancedTableSchema
from prismiq.sql_validator import SQLValidationError
from prismiq.timeseries import TimeInterval
from prismiq.transforms import pivot_data
from prismiq.trends import ComparisonPeriod, TrendResult, add_trend_column
from prismiq.types import (
    DatabaseSchema,
    QueryDefinition,
    QueryResult,
    QueryValidationError,
    SavedQuery,
    SavedQueryCreate,
    SavedQueryUpdate,
    TableNotFoundError,
    TableSchema,
)

if TYPE_CHECKING:
    from prismiq.engine import PrismiqEngine

# Track startup time for uptime calculation
_startup_time: float | None = None

# Module logger for cache operations
_logger = get_logger(__name__)


def _get_uptime() -> float:
    """Get uptime in seconds since router was created."""
    if _startup_time is None:
        return 0.0
    return time.time() - _startup_time


# ============================================================================
# Response Models
# ============================================================================


class ValidationResponse(BaseModel):
    """Response model for query validation endpoint."""

    valid: bool
    """Whether the query is valid."""

    errors: list[str]
    """List of validation error messages (empty if valid)."""


class DetailedValidationResponse(BaseModel):
    """Response model for detailed query validation endpoint."""

    result: ValidationResult
    """Complete validation result with detailed errors."""


class TableListResponse(BaseModel):
    """Response model for table list endpoint."""

    tables: list[str]
    """List of table names."""


class ExecuteQueryRequest(BaseModel):
    """Request model for query execution endpoint."""

    query: QueryDefinition
    """Query definition to execute."""

    bypass_cache: bool = False
    """If True, bypass cache and re-execute query, then update cache."""


class QueryResultWithCache(BaseModel):
    """Query result with cache metadata."""

    columns: list[str]
    """Column names in result order."""

    column_types: list[str]
    """Column data types."""

    rows: list[list[Any]]
    """Result rows as list of lists."""

    row_count: int
    """Number of rows returned."""

    truncated: bool
    """Whether results were truncated due to limit."""

    execution_time_ms: float
    """Query execution time in milliseconds."""

    cached_at: float | None = None
    """Unix timestamp when result was cached (None if not from cache)."""

    is_from_cache: bool = False
    """Whether this result came from cache."""


class PreviewRequest(BaseModel):
    """Request model for query preview endpoint."""

    query: QueryDefinition
    """Query definition to preview."""

    limit: int = 100
    """Maximum number of rows to return."""


class ExecuteSQLRequest(BaseModel):
    """Request model for raw SQL execution endpoint."""

    sql: str
    """Raw SQL query (SELECT only)."""

    params: dict[str, Any] | None = None
    """Optional named parameters for the query."""


class SQLValidationResponse(BaseModel):
    """Response model for SQL validation endpoint."""

    valid: bool
    """Whether the SQL is valid."""

    errors: list[str]
    """List of validation errors (empty if valid)."""

    tables: list[str]
    """List of tables referenced in the query."""


class SuccessResponse(BaseModel):
    """Generic success response."""

    success: bool = True
    """Whether the operation succeeded."""

    message: str = "OK"
    """Success message."""


# ============================================================================
# Health Check Models
# ============================================================================


class HealthCheck(BaseModel):
    """Individual health check result."""

    model_config = ConfigDict(strict=True)

    status: str
    """Status of the check: 'healthy', 'degraded', or 'unhealthy'."""

    message: str | None = None
    """Optional message with details (e.g., error message)."""

    latency_ms: float | None = None
    """Optional latency of the health check in milliseconds."""


class HealthStatus(BaseModel):
    """Overall health status response."""

    model_config = ConfigDict(strict=True)

    status: str
    """Overall status: 'healthy', 'degraded', or 'unhealthy'."""

    version: str
    """Application version."""

    uptime_seconds: float
    """Time since the application started in seconds."""

    checks: dict[str, HealthCheck]
    """Individual health check results."""


class LivenessResponse(BaseModel):
    """Response for liveness probe."""

    status: str = "ok"
    """Liveness status."""


class ReadinessResponse(BaseModel):
    """Response for readiness probe."""

    status: str = "ok"
    """Readiness status."""


# ============================================================================
# Time Series Request Models
# ============================================================================


class TimeSeriesQueryRequest(BaseModel):
    """Request model for time series query execution."""

    query: QueryDefinition
    """Query definition to execute."""

    interval: TimeInterval
    """Time interval for bucketing (minute, hour, day, week, month, quarter, year)."""

    date_column: str
    """Name of the date/timestamp column to bucket."""

    fill_missing: bool = True
    """Whether to fill missing time buckets with default values."""


class PivotRequest(BaseModel):
    """Request model for pivot transformation."""

    result: QueryResult
    """Query result to pivot."""

    row_column: str
    """Column to use as row headers."""

    pivot_column: str
    """Column to pivot into separate columns."""

    value_column: str
    """Column containing values to aggregate."""

    aggregation: str = "sum"
    """Aggregation function: sum, avg, count, min, max."""


class TrendColumnRequest(BaseModel):
    """Request model for adding trend columns."""

    result: QueryResult
    """Query result to add trend columns to."""

    value_column: str
    """Column containing values to calculate trends for."""

    order_column: str
    """Column to order by for trend calculation."""

    group_column: str | None = None
    """Optional column to group by for separate trend calculations."""


class MetricTrendRequest(BaseModel):
    """Request model for calculating metric trend."""

    query: QueryDefinition
    """Query definition for the metric."""

    comparison: ComparisonPeriod
    """Period to compare against."""

    current_start: date
    """Start date of current period."""

    current_end: date
    """End date of current period."""

    value_column: str
    """Column containing the metric value."""

    date_column: str
    """Column containing the date for filtering."""


# ============================================================================
# Dashboard Request/Response Models
# ============================================================================


class DashboardListResponse(BaseModel):
    """Response model for dashboard list endpoint."""

    dashboards: list[Dashboard]
    """List of dashboards."""


class WidgetQueryRequest(BaseModel):
    """Request model for executing a widget's query with dashboard filters."""

    widget_id: str
    """ID of the widget to execute."""

    filter_values: list[FilterValue] = []
    """Current dashboard filter values."""


class DashboardImportRequest(BaseModel):
    """Request model for importing a dashboard."""

    export_data: DashboardExport
    """Dashboard export data to import."""

    name_override: str | None = None
    """Optional name to use instead of the export's name."""


# ============================================================================
# Saved Query Request/Response Models
# ============================================================================


class SavedQueryListResponse(BaseModel):
    """Response model for saved query list endpoint."""

    queries: list[SavedQuery]
    """List of saved queries."""


# ============================================================================
# Pin Request/Response Models
# ============================================================================


class PinnedDashboardsResponse(BaseModel):
    """Response model for getting pinned dashboards."""

    dashboards: list[Dashboard]
    """List of pinned dashboards, ordered by position."""

    pins: list[PinnedDashboard]
    """List of pin entries with metadata."""


class DashboardPinContextsResponse(BaseModel):
    """Response model for getting contexts where a dashboard is pinned."""

    contexts: list[str]
    """List of context names where the dashboard is pinned."""


# ============================================================================
# Router Factory
# ============================================================================


def create_router(
    engine: PrismiqEngine,
    get_auth_context: Callable[..., Awaitable[AuthContext]] | None = None,
) -> APIRouter:
    """Create a FastAPI router for the Prismiq analytics engine.

    Args:
        engine: Initialized PrismiqEngine instance.
        get_auth_context: FastAPI dependency that returns an AuthContext.
            Called ONCE per request - no duplicate auth processing.
            If None, uses a default that requires X-Tenant-ID header.

    Returns:
        APIRouter with analytics endpoints.

    Example:
        # Simple header-based auth
        from prismiq.auth import create_header_auth_dependency
        router = create_router(engine, get_auth_context=create_header_auth_dependency())

        # Custom auth with your provider
        async def get_auth(request: Request) -> MyAuthContext:
            token = request.headers.get("Authorization", "").replace("Bearer ", "")
            user = await my_auth_provider.verify(token)
            return MyAuthContext(tenant_id=user.org_id, user_id=user.id)

        router = create_router(engine, get_auth_context=get_auth)
    """
    global _startup_time
    _startup_time = time.time()

    router = APIRouter(tags=["analytics"])

    # Default auth dependency if none provided
    if get_auth_context is None:
        get_auth_context = create_header_auth_dependency()

    # Use engine's dashboard store
    store = engine.dashboard_store

    # ========================================================================
    # Health Check Endpoints
    # ========================================================================

    @router.get("/health", response_model=HealthStatus)
    async def health_check() -> HealthStatus:
        """Comprehensive health check endpoint.

        Checks the health of all dependencies (database, cache, etc.)
        and returns an overall status.

        Returns:
            HealthStatus with overall status and individual check results.
        """
        checks: dict[str, HealthCheck] = {}

        # Check database connection
        try:
            start = time.perf_counter()
            await engine.check_connection()
            latency = (time.perf_counter() - start) * 1000
            checks["database"] = HealthCheck(
                status="healthy",
                latency_ms=round(latency, 2),
            )
        except (TypeError, AttributeError, ImportError, AssertionError):
            # Re-raise programming bugs - these need to be fixed, not reported as unhealthy
            raise
        except Exception as e:
            # Infrastructure errors - report as unhealthy
            checks["database"] = HealthCheck(
                status="unhealthy",
                message=str(e),
            )

        # Check cache if configured (using getattr for forward compatibility)
        # The cache property will be added in Task 7 (Engine Integration)
        cache = getattr(engine, "cache", None)
        if cache is not None:
            try:
                start = time.perf_counter()
                await cache.set("health_check", "ok", ttl=1)
                result = await cache.get("health_check")
                latency = (time.perf_counter() - start) * 1000

                if result == "ok":
                    checks["cache"] = HealthCheck(
                        status="healthy",
                        latency_ms=round(latency, 2),
                    )
                else:
                    checks["cache"] = HealthCheck(
                        status="degraded",
                        message="Cache read/write verification failed",
                    )
            except (TypeError, AttributeError, ImportError, AssertionError):
                # Re-raise programming bugs
                raise
            except Exception as e:
                # Infrastructure errors - report as unhealthy
                checks["cache"] = HealthCheck(
                    status="unhealthy",
                    message=str(e),
                )

        # Determine overall status
        all_healthy = all(c.status == "healthy" for c in checks.values())
        any_unhealthy = any(c.status == "unhealthy" for c in checks.values())

        if all_healthy:
            overall_status = "healthy"
        elif any_unhealthy:
            overall_status = "unhealthy"
        else:
            overall_status = "degraded"

        return HealthStatus(
            status=overall_status,
            version=__version__,
            uptime_seconds=round(_get_uptime(), 2),
            checks=checks,
        )

    @router.get("/health/live", response_model=LivenessResponse)
    async def liveness() -> LivenessResponse:
        """Kubernetes liveness probe endpoint.

        Indicates whether the application process is running.
        This should only fail if the process is in a broken state
        and needs to be restarted.

        Returns:
            LivenessResponse with status 'ok'.
        """
        return LivenessResponse(status="ok")

    @router.get("/health/ready", response_model=ReadinessResponse)
    async def readiness() -> ReadinessResponse:
        """Kubernetes readiness probe endpoint.

        Indicates whether the application is ready to receive traffic.
        Checks if the database connection is available.

        Returns:
            ReadinessResponse with status 'ok'.

        Raises:
            HTTPException: 503 if the application is not ready.
        """
        try:
            await engine.check_connection()
            return ReadinessResponse(status="ok")
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Service not ready: {e!s}",
            ) from e

    # ========================================================================
    # Schema Endpoints
    # ========================================================================

    @router.get("/schema", response_model=DatabaseSchema)
    async def get_schema(
        auth: AuthContext = Depends(get_auth_context),
    ) -> DatabaseSchema:
        """Get the complete database schema (raw).

        Returns all exposed tables, their columns, and relationships
        without any configuration applied.

        Uses the schema_name from AuthContext for multi-tenant schema isolation.
        """
        schema_name = auth.schema_name
        return await engine.get_schema(schema_name=schema_name)

    @router.get("/schema/enhanced", response_model=EnhancedDatabaseSchema)
    async def get_enhanced_schema(
        auth: AuthContext = Depends(get_auth_context),
    ) -> EnhancedDatabaseSchema:
        """Get the enhanced database schema with configuration applied.

        Returns schema with display names, descriptions, and hidden
        tables/columns filtered out.

        Uses the schema_name from AuthContext for multi-tenant schema isolation.
        """
        schema_name = auth.schema_name
        return await engine.get_enhanced_schema(schema_name=schema_name)

    @router.get("/tables", response_model=TableListResponse)
    async def get_tables(
        auth: AuthContext = Depends(get_auth_context),
    ) -> TableListResponse:
        """Get list of available table names.

        Returns a simple list of table names for quick reference. Uses
        the schema_name from AuthContext for multi-tenant schema
        isolation.
        """
        schema_name = auth.schema_name
        schema = await engine.get_schema(schema_name=schema_name)
        return TableListResponse(tables=schema.table_names())

    @router.get("/tables/{table_name}", response_model=TableSchema)
    async def get_table(
        table_name: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> TableSchema:
        """Get schema information for a single table (raw).

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            TableSchema with columns and metadata.

        Raises:
            404: If the table is not found.
        """
        schema_name = auth.schema_name
        try:
            return await engine.get_table(table_name, schema_name=schema_name)
        except TableNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e

    @router.get("/tables/{table_name}/enhanced", response_model=EnhancedTableSchema)
    async def get_enhanced_table(
        table_name: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> EnhancedTableSchema:
        """Get enhanced schema information for a single table.

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            EnhancedTableSchema with display names and format hints.

        Raises:
            404: If the table is not found or is hidden.
        """
        schema_name = auth.schema_name
        enhanced_schema = await engine.get_enhanced_schema(schema_name=schema_name)
        table = enhanced_schema.get_table(table_name)
        if table is None:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        return table

    @router.get("/tables/{table_name}/columns/{column_name}/sample")
    async def get_column_sample(
        table_name: str,
        column_name: str,
        limit: int = 5,
        auth: AuthContext = Depends(get_auth_context),
    ) -> dict[str, list[Any]]:
        """Get sample values from a column for data preview.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.
            limit: Maximum number of distinct values to return (default 5).

        Returns:
            Object with sample values array.

        Raises:
            404: If the table or column is not found.
        """
        schema_name = auth.schema_name
        try:
            values = await engine.sample_column_values(
                table_name, column_name, limit, schema_name=schema_name
            )
            return {"values": values}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Query Endpoints
    # ========================================================================

    @router.post("/query/validate", response_model=ValidationResponse)
    async def validate_query(
        query: QueryDefinition,
        auth: AuthContext = Depends(get_auth_context),
    ) -> ValidationResponse:
        """Validate a query without executing it.

        Checks that all tables and columns exist in the schema,
        and that join columns are compatible.

        Uses the schema_name from AuthContext for multi-tenant schema isolation.

        Args:
            query: Query definition to validate.

        Returns:
            ValidationResponse with valid flag and any errors.
        """
        schema_name = auth.schema_name
        errors = await engine.validate_query_async(query, schema_name=schema_name)
        return ValidationResponse(valid=len(errors) == 0, errors=errors)

    @router.post("/query/validate/detailed", response_model=DetailedValidationResponse)
    async def validate_query_detailed(
        query: QueryDefinition,
        auth: AuthContext = Depends(get_auth_context),
    ) -> DetailedValidationResponse:
        """Validate a query with detailed error information.

        Returns detailed errors with error codes, field paths, and suggestions.

        Uses the schema_name from AuthContext for multi-tenant schema isolation.

        Args:
            query: Query definition to validate.

        Returns:
            DetailedValidationResponse with complete validation result.
        """
        schema_name = auth.schema_name
        result = await engine.validate_query_detailed_async(query, schema_name=schema_name)
        return DetailedValidationResponse(result=result)

    @router.post("/query/sql")
    async def generate_sql(
        query: QueryDefinition,
        auth: AuthContext = Depends(get_auth_context),
    ) -> dict[str, str]:
        """Generate SQL from a query definition without executing.

        Useful for previewing the SQL that will be generated.

        Uses the schema_name from AuthContext for multi-tenant schema isolation.

        Args:
            query: Query definition to generate SQL for.

        Returns:
            Object with the generated SQL string.

        Raises:
            400: If the query fails validation.
        """
        schema_name = auth.schema_name
        try:
            sql = await engine.generate_sql_async(query, schema_name=schema_name)
            return {"sql": sql}
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e

    @router.post("/query/execute", response_model=QueryResultWithCache)
    async def execute_query(
        request: ExecuteQueryRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> QueryResultWithCache:
        """Execute a query and return results with cache metadata.

        Args:
            request: Query execution request with optional cache bypass.

        Returns:
            QueryResultWithCache with columns, rows, execution metadata, and cache info.

        Raises:
            400: If the query fails validation.
            500: If the query execution fails.
        """
        try:
            query = request.query
            bypass_cache = request.bypass_cache
            schema_name = auth.schema_name

            # Execute query (bypass cache if requested)
            use_cache = not bypass_cache
            result = await engine.execute_query(query, schema_name=schema_name, use_cache=use_cache)

            # Get cache metadata
            cached_at: float | None = None
            is_from_cache = False

            if engine._query_cache:  # pyright: ignore[reportPrivateUsage]
                if bypass_cache:
                    # We just executed fresh, cache it and get the timestamp
                    try:
                        cached_at = await engine._query_cache.cache_result(  # pyright: ignore[reportPrivateUsage]
                            query, result
                        )
                    except (TypeError, AttributeError, ImportError):
                        # Re-raise programming bugs - these need to be fixed
                        raise
                    except Exception as cache_err:
                        # Log infrastructure errors but don't fail - cache is optional
                        _logger.warning(
                            "Failed to cache query result",
                            error=str(cache_err),
                            error_type=type(cache_err).__name__,
                            tables=[t.name for t in query.tables],
                        )
                        cached_at = None  # Don't report misleading timestamp
                    is_from_cache = False
                else:
                    # Check if result was from cache
                    try:
                        metadata = await engine._query_cache.get_cache_metadata(  # pyright: ignore[reportPrivateUsage]
                            query
                        )
                        if metadata and "cached_at" in metadata:
                            cached_at = metadata["cached_at"]
                            is_from_cache = True
                    except (TypeError, AttributeError, ImportError):
                        # Re-raise programming bugs - these need to be fixed
                        raise
                    except Exception as cache_err:
                        # Log infrastructure errors but don't fail - metadata is optional
                        _logger.warning(
                            "Failed to get cache metadata",
                            error=str(cache_err),
                            error_type=type(cache_err).__name__,
                            tables=[t.name for t in query.tables],
                        )
                        # Continue without cache metadata

            return QueryResultWithCache(
                columns=result.columns,
                column_types=result.column_types,
                rows=result.rows,
                row_count=result.row_count,
                truncated=result.truncated,
                execution_time_ms=result.execution_time_ms,
                cached_at=cached_at,
                is_from_cache=is_from_cache,
            )
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.post("/query/preview", response_model=QueryResult)
    async def preview_query(
        request: PreviewRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> QueryResult:
        """Execute a query with a limited number of rows.

        Useful for quick previews in the query builder UI.

        Args:
            request: Preview request with query and limit.

        Returns:
            QueryResult with limited rows.

        Raises:
            400: If the query fails validation.
            500: If the query execution fails.
        """
        schema_name = auth.schema_name
        try:
            return await engine.preview_query(
                request.query, limit=request.limit, schema_name=schema_name
            )
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Custom SQL Endpoints
    # ========================================================================

    @router.post("/query/validate-sql", response_model=SQLValidationResponse)
    async def validate_sql(
        request: ExecuteSQLRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SQLValidationResponse:
        """Validate a raw SQL query without executing it.

        Checks that the SQL is a valid SELECT statement and only
        references tables visible in the schema.

        Args:
            request: SQL validation request.
            auth: Authentication context with tenant and schema info.

        Returns:
            SQLValidationResponse with validation status and details.
        """
        schema_name = auth.schema_name
        result = await engine.validate_sql(request.sql, schema_name=schema_name)
        return SQLValidationResponse(
            valid=result.valid,
            errors=result.errors,
            tables=result.tables,
        )

    @router.post("/query/execute-sql", response_model=QueryResult)
    async def execute_sql(
        request: ExecuteSQLRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> QueryResult:
        """Execute a raw SQL query.

        Only SELECT statements are allowed. Queries are restricted
        to tables visible in the schema.

        Args:
            request: SQL execution request with query and optional params.
            auth: Authentication context with tenant and schema info.

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            400: If the SQL fails validation.
            500: If the query execution fails.
        """
        schema_name = auth.schema_name
        try:
            return await engine.execute_raw_sql(
                sql=request.sql,
                params=request.params,
                schema_name=schema_name,
            )
        except SQLValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Time Series Endpoints
    # ========================================================================

    @router.post("/query/execute/timeseries", response_model=QueryResult)
    async def execute_timeseries_query(
        request: TimeSeriesQueryRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> QueryResult:
        """Execute a time series query with automatic bucketing.

        Automatically adds date_trunc to the query for time bucketing
        and optionally fills missing time buckets.

        Args:
            request: Time series query request with interval configuration.
            auth: Authentication context with tenant and schema info.

        Returns:
            QueryResult with time-bucketed data.

        Raises:
            400: If the query fails validation or date column is invalid.
            500: If the query execution fails.
        """
        schema_name = auth.schema_name
        try:
            return await engine.execute_timeseries_query(
                query=request.query,
                interval=request.interval,
                date_column=request.date_column,
                fill_missing=request.fill_missing,
                schema_name=schema_name,
            )
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Transform Endpoints
    # ========================================================================

    @router.post("/transform/pivot", response_model=QueryResult)
    async def pivot_result(request: PivotRequest) -> QueryResult:
        """Pivot query result data from long to wide format.

        Transforms data like:
          region | month | sales
          East   | Jan   | 100
          East   | Feb   | 150

        Into:
          region | Jan | Feb
          East   | 100 | 150

        Args:
            request: Pivot request with column configuration.

        Returns:
            Pivoted QueryResult.

        Raises:
            400: If column names are invalid.
        """
        try:
            return pivot_data(
                result=request.result,
                row_column=request.row_column,
                pivot_column=request.pivot_column,
                value_column=request.value_column,
                aggregation=request.aggregation,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.post("/transform/trend", response_model=QueryResult)
    async def add_trend(request: TrendColumnRequest) -> QueryResult:
        """Add trend columns to query result.

        Adds columns for previous value, absolute change, and percent change
        based on the order of rows.

        Args:
            request: Trend column request with column configuration.

        Returns:
            QueryResult with added trend columns.

        Raises:
            400: If column names are invalid.
        """
        try:
            return add_trend_column(
                result=request.result,
                value_column=request.value_column,
                order_column=request.order_column,
                group_column=request.group_column,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Metrics Endpoints
    # ========================================================================

    @router.post("/metrics/trend", response_model=TrendResult)
    async def calculate_metric_trend(request: MetricTrendRequest) -> TrendResult:
        """Calculate trend for a metric query.

        Executes the query for both current and comparison periods,
        then calculates the trend between them.

        Args:
            request: Metric trend request with period configuration.

        Returns:
            TrendResult with current value, previous value, and change metrics.

        Raises:
            400: If the query fails validation.
            500: If the query execution fails.
        """
        try:
            return await engine.calculate_metric_trend(
                query=request.query,
                comparison=request.comparison,
                current_start=request.current_start,
                current_end=request.current_end,
                value_column=request.value_column,
                date_column=request.date_column,
            )
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Dashboard Endpoints
    # ========================================================================

    @router.get("/dashboards", response_model=DashboardListResponse)
    async def list_dashboards(
        auth: AuthContext = Depends(get_auth_context),
    ) -> DashboardListResponse:
        """List all dashboards for the current tenant.

        Returns:
            List of dashboards the user can access.
        """
        dashboards = await store.list_dashboards(
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        return DashboardListResponse(dashboards=dashboards)

    @router.get("/dashboards/{dashboard_id}", response_model=Dashboard)
    async def get_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Get a dashboard by ID.

        Args:
            dashboard_id: Dashboard ID.

        Returns:
            Dashboard with all widgets and filters.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to view.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_view_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        return dashboard

    @router.post("/dashboards", response_model=Dashboard, status_code=201)
    async def create_dashboard(
        data: DashboardCreate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            data: Dashboard creation data.

        Returns:
            Created dashboard.
        """
        return await store.create_dashboard(
            data,
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
            schema_name=auth.schema_name,
        )

    @router.patch("/dashboards/{dashboard_id}", response_model=Dashboard)
    async def update_dashboard(
        dashboard_id: str,
        data: DashboardUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Update a dashboard.

        Args:
            dashboard_id: Dashboard ID.
            data: Fields to update.

        Returns:
            Updated dashboard.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to edit.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        updated = await store.update_dashboard(
            dashboard_id, data, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if updated is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")
        return updated

    @router.delete("/dashboards/{dashboard_id}", response_model=SuccessResponse)
    async def delete_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SuccessResponse:
        """Delete a dashboard.

        Args:
            dashboard_id: Dashboard ID.

        Returns:
            Success response.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to delete.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_delete_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        deleted = await store.delete_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")
        return SuccessResponse(message=f"Dashboard '{dashboard_id}' deleted")

    # ========================================================================
    # Widget Endpoints
    # ========================================================================

    @router.post(
        "/dashboards/{dashboard_id}/widgets",
        response_model=Widget,
        status_code=201,
    )
    async def add_widget(
        dashboard_id: str,
        data: WidgetCreate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Widget:
        """Add a widget to a dashboard.

        Args:
            dashboard_id: Dashboard ID.
            data: Widget creation data.

        Returns:
            Created widget.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to edit widgets.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        created = await store.add_widget(
            dashboard_id, data, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if created is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")
        return created

    @router.patch("/dashboards/{dashboard_id}/widgets/{widget_id}", response_model=Widget)
    async def update_widget(
        dashboard_id: str,
        widget_id: str,
        data: WidgetUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Widget:
        """Update a widget.

        Args:
            dashboard_id: Dashboard ID.
            widget_id: Widget ID.
            data: Fields to update.

        Returns:
            Updated widget.

        Raises:
            404: If dashboard or widget not found.
            403: If user lacks permission to edit widgets.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        updated = await store.update_widget(
            widget_id, data, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if updated is None:
            raise HTTPException(status_code=404, detail=f"Widget '{widget_id}' not found")
        return updated

    @router.delete("/dashboards/{dashboard_id}/widgets/{widget_id}", response_model=SuccessResponse)
    async def delete_widget(
        dashboard_id: str,
        widget_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SuccessResponse:
        """Delete a widget.

        Args:
            dashboard_id: Dashboard ID.
            widget_id: Widget ID.

        Returns:
            Success response.

        Raises:
            404: If dashboard or widget not found.
            403: If user lacks permission to edit widgets.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        deleted = await store.delete_widget(
            widget_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if not deleted:
            raise HTTPException(status_code=404, detail=f"Widget '{widget_id}' not found")
        return SuccessResponse(message=f"Widget '{widget_id}' deleted")

    @router.post(
        "/dashboards/{dashboard_id}/widgets/{widget_id}/duplicate",
        response_model=Widget,
        status_code=201,
    )
    async def duplicate_widget(
        dashboard_id: str,
        widget_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Widget:
        """Duplicate a widget.

        Args:
            dashboard_id: Dashboard ID.
            widget_id: Widget ID to duplicate.

        Returns:
            New duplicated widget.

        Raises:
            404: If dashboard or widget not found.
            403: If user lacks permission to edit widgets.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_widget(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        duplicated = await store.duplicate_widget(
            widget_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if duplicated is None:
            raise HTTPException(status_code=404, detail=f"Widget '{widget_id}' not found")
        return duplicated

    # ========================================================================
    # Layout Update Endpoints
    # ========================================================================

    @router.put("/dashboards/{dashboard_id}/layout", response_model=Dashboard)
    async def update_layout(
        dashboard_id: str,
        positions: list[dict[str, Any]],
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Batch update widget positions in a dashboard.

        Args:
            dashboard_id: Dashboard ID.
            positions: List of position updates, each with widget_id and position.

        Returns:
            Updated dashboard with new widget positions.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to edit.
            400: If update fails.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_edit_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        success = await store.update_widget_positions(
            dashboard_id=dashboard_id,
            positions=positions,
            tenant_id=auth.tenant_id,
            schema_name=auth.schema_name,
        )
        if not success:
            raise HTTPException(status_code=400, detail="Failed to update layout")

        # Return updated dashboard
        updated = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if updated is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")
        return updated

    @router.post(
        "/dashboards/{dashboard_id}/widgets/{widget_id}/execute",
        response_model=QueryResult,
    )
    async def execute_widget_query(
        dashboard_id: str,
        widget_id: str,
        auth: AuthContext = Depends(get_auth_context),
        filter_values: list[FilterValue] | None = None,
    ) -> QueryResult:
        """Execute a widget's query with dashboard filters applied.

        Args:
            dashboard_id: Dashboard ID.
            widget_id: Widget ID.
            filter_values: Current dashboard filter values.

        Returns:
            Query result.

        Raises:
            404: If dashboard or widget not found.
            403: If user lacks permission to view.
            400: If widget has no query or query fails validation.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_view_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        # Find the widget
        widget = None
        for w in dashboard.widgets:
            if w.id == widget_id:
                widget = w
                break

        if widget is None:
            raise HTTPException(status_code=404, detail=f"Widget '{widget_id}' not found")

        if widget.query is None:
            raise HTTPException(status_code=400, detail="Widget has no query")

        # Get schema_name from auth context
        schema_name = auth.schema_name

        # Merge dashboard filters with widget query
        schema = await engine.get_schema(schema_name=schema_name)
        query = merge_filters(
            widget.query,
            dashboard.filters,
            filter_values or [],
            schema,
        )

        try:
            return await engine.execute_query(query, schema_name=schema_name)
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Dashboard Import/Export Endpoints
    # ========================================================================

    @router.get("/dashboards/{dashboard_id}/export", response_model=DashboardExport)
    async def export_dashboard(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> DashboardExport:
        """Export a dashboard to a portable format.

        Args:
            dashboard_id: Dashboard ID.

        Returns:
            DashboardExport data.

        Raises:
            404: If dashboard not found.
            403: If user lacks permission to view.
        """
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        if not can_view_dashboard(dashboard, auth.user_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        # Convert widgets to dict format without IDs
        widget_dicts: list[dict[str, Any]] = []
        for widget in dashboard.widgets:
            widget_dict = widget.model_dump()
            # Remove ID and timestamps
            del widget_dict["id"]
            del widget_dict["created_at"]
            del widget_dict["updated_at"]
            widget_dicts.append(widget_dict)

        return DashboardExport(
            version="1.0",
            name=dashboard.name,
            description=dashboard.description,
            layout=dashboard.layout,
            widgets=widget_dicts,
            filters=dashboard.filters,
        )

    @router.post("/dashboards/import", response_model=Dashboard, status_code=201)
    async def import_dashboard(
        request: DashboardImportRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> Dashboard:
        """Import a dashboard from exported data.

        Args:
            request: Import request with export data.

        Returns:
            Imported dashboard.
        """
        export_data = request.export_data

        # Create the dashboard
        dashboard = await store.create_dashboard(
            DashboardCreate(
                name=request.name_override or export_data.name,
                description=export_data.description,
                layout=export_data.layout,
            ),
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
            schema_name=auth.schema_name,
        )

        # Update with filters
        if export_data.filters:
            await store.update_dashboard(
                dashboard.id,
                DashboardUpdate(filters=export_data.filters),
                tenant_id=auth.tenant_id,
                schema_name=auth.schema_name,
            )

        # Add widgets
        for widget_dict in export_data.widgets:
            await store.add_widget(
                dashboard.id,
                WidgetCreate(
                    type=widget_dict["type"],
                    title=widget_dict["title"],
                    query=widget_dict.get("query"),
                    position=widget_dict["position"],
                    config=widget_dict.get("config"),
                ),
                tenant_id=auth.tenant_id,
                schema_name=auth.schema_name,
            )

        # Return the complete dashboard
        result = await store.get_dashboard(
            dashboard.id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if result is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve imported dashboard")
        return result

    # ========================================================================
    # Saved Query Endpoints
    # ========================================================================

    @router.get("/saved-queries", response_model=SavedQueryListResponse)
    async def list_saved_queries(
        auth: AuthContext = Depends(get_auth_context),
    ) -> SavedQueryListResponse:
        """List saved queries for the current tenant.

        Returns queries owned by the user or shared with all users.

        Returns:
            List of saved queries.
        """
        saved_query_store = engine.saved_query_store
        queries = await saved_query_store.list(
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        return SavedQueryListResponse(queries=queries)

    @router.get("/saved-queries/{query_id}", response_model=SavedQuery)
    async def get_saved_query(
        query_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SavedQuery:
        """Get a saved query by ID.

        Args:
            query_id: Saved query ID.

        Returns:
            Saved query.

        Raises:
            404: If saved query not found.
        """
        saved_query_store = engine.saved_query_store
        query = await saved_query_store.get(
            query_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if query is None:
            raise HTTPException(status_code=404, detail=f"Saved query '{query_id}' not found")
        return query

    @router.post("/saved-queries", response_model=SavedQuery, status_code=201)
    async def create_saved_query(
        data: SavedQueryCreate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SavedQuery:
        """Create a new saved query.

        Args:
            data: Saved query creation data.

        Returns:
            Created saved query.
        """
        saved_query_store = engine.saved_query_store
        return await saved_query_store.create(
            data,
            tenant_id=auth.tenant_id,
            owner_id=auth.user_id,
            schema_name=auth.schema_name,
        )

    @router.patch("/saved-queries/{query_id}", response_model=SavedQuery)
    async def update_saved_query(
        query_id: str,
        data: SavedQueryUpdate,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SavedQuery:
        """Update a saved query.

        Only the owner can update a query.

        Args:
            query_id: Saved query ID.
            data: Fields to update.

        Returns:
            Updated saved query.

        Raises:
            404: If saved query not found or user is not owner.
        """
        saved_query_store = engine.saved_query_store
        updated = await saved_query_store.update(
            query_id,
            data,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        if updated is None:
            raise HTTPException(
                status_code=404,
                detail=f"Saved query '{query_id}' not found or permission denied",
            )
        return updated

    @router.delete("/saved-queries/{query_id}", response_model=SuccessResponse)
    async def delete_saved_query(
        query_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SuccessResponse:
        """Delete a saved query.

        Only the owner can delete a query.

        Args:
            query_id: Saved query ID.

        Returns:
            Success response.

        Raises:
            404: If saved query not found or user is not owner.
        """
        saved_query_store = engine.saved_query_store
        deleted = await saved_query_store.delete(
            query_id,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        if not deleted:
            raise HTTPException(
                status_code=404,
                detail=f"Saved query '{query_id}' not found or permission denied",
            )
        return SuccessResponse(message=f"Saved query '{query_id}' deleted")

    # ========================================================================
    # Pin Endpoints
    # ========================================================================

    @router.post("/pins", response_model=PinnedDashboard, status_code=201)
    async def pin_dashboard(
        request: PinRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> PinnedDashboard:
        """Pin a dashboard to a context.

        Args:
            request: Pin request with dashboard_id, context, and optional position.

        Returns:
            Created pin entry.

        Raises:
            400: If dashboard already pinned to context.
            401: If user_id is not provided.
            404: If dashboard not found.
        """
        if auth.user_id is None:
            raise HTTPException(status_code=401, detail="User ID required for pin operations")
        try:
            return await store.pin_dashboard(
                dashboard_id=request.dashboard_id,
                context=request.context,
                tenant_id=auth.tenant_id,
                user_id=auth.user_id,
                position=request.position,
                schema_name=auth.schema_name,
            )
        except ValueError as e:
            if "not found" in str(e):
                raise HTTPException(status_code=404, detail=str(e)) from e
            raise HTTPException(status_code=400, detail=str(e)) from e

    @router.delete("/pins", response_model=SuccessResponse)
    async def unpin_dashboard(
        request: UnpinRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SuccessResponse:
        """Unpin a dashboard from a context.

        Args:
            request: Unpin request with dashboard_id and context.

        Returns:
            Success response.

        Raises:
            401: If user_id is not provided.
            404: If pin not found.
        """
        if auth.user_id is None:
            raise HTTPException(status_code=401, detail="User ID required for pin operations")
        unpinned = await store.unpin_dashboard(
            dashboard_id=request.dashboard_id,
            context=request.context,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        if not unpinned:
            raise HTTPException(
                status_code=404,
                detail=f"Pin not found for dashboard '{request.dashboard_id}' in context '{request.context}'",
            )
        return SuccessResponse(message="Dashboard unpinned successfully")

    @router.get("/pins", response_model=PinnedDashboardsResponse)
    async def get_pinned_dashboards(
        context: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> PinnedDashboardsResponse:
        """Get all dashboards pinned to a context.

        Args:
            context: Context to get pins for (e.g., "accounts", "dashboard").

        Returns:
            List of dashboards and their pin metadata.

        Raises:
            401: If user_id is not provided.
        """
        if auth.user_id is None:
            raise HTTPException(status_code=401, detail="User ID required for pin operations")
        dashboards = await store.get_pinned_dashboards(
            context=context,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        pins = await store.get_pins_for_context(
            context=context,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        return PinnedDashboardsResponse(dashboards=dashboards, pins=pins)

    @router.get("/dashboards/{dashboard_id}/pins", response_model=DashboardPinContextsResponse)
    async def get_dashboard_pin_contexts(
        dashboard_id: str,
        auth: AuthContext = Depends(get_auth_context),
    ) -> DashboardPinContextsResponse:
        """Get all contexts where a dashboard is pinned.

        Args:
            dashboard_id: Dashboard ID.

        Returns:
            List of context names.

        Raises:
            401: If user_id is not provided.
            404: If dashboard not found.
        """
        if auth.user_id is None:
            raise HTTPException(status_code=401, detail="User ID required for pin operations")
        # Verify dashboard exists
        dashboard = await store.get_dashboard(
            dashboard_id, tenant_id=auth.tenant_id, schema_name=auth.schema_name
        )
        if dashboard is None:
            raise HTTPException(status_code=404, detail=f"Dashboard '{dashboard_id}' not found")

        contexts = await store.get_pin_contexts_for_dashboard(
            dashboard_id=dashboard_id,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        return DashboardPinContextsResponse(contexts=contexts)

    @router.put("/pins/order", response_model=SuccessResponse)
    async def reorder_pins(
        request: ReorderPinsRequest,
        auth: AuthContext = Depends(get_auth_context),
    ) -> SuccessResponse:
        """Reorder pinned dashboards within a context.

        Args:
            request: Reorder request with context and ordered dashboard IDs.

        Returns:
            Success response.

        Raises:
            401: If user_id is not provided.
        """
        if auth.user_id is None:
            raise HTTPException(status_code=401, detail="User ID required for pin operations")
        await store.reorder_pins(
            context=request.context,
            dashboard_ids=request.dashboard_ids,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
            schema_name=auth.schema_name,
        )
        return SuccessResponse(message="Pins reordered successfully")

    return router
