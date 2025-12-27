"""
FastAPI routes for the Prismiq analytics engine.

This module provides a factory function to create an API router
that exposes schema, validation, and query execution endpoints.
"""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from prismiq.query import ValidationResult
from prismiq.schema_config import (
    ColumnConfig,
    EnhancedDatabaseSchema,
    EnhancedTableSchema,
    SchemaConfig,
    TableConfig,
)
from prismiq.timeseries import TimeInterval
from prismiq.transforms import pivot_data
from prismiq.trends import ComparisonPeriod, TrendResult, add_trend_column
from prismiq.types import (
    DatabaseSchema,
    QueryDefinition,
    QueryResult,
    QueryValidationError,
    TableNotFoundError,
    TableSchema,
)

if TYPE_CHECKING:
    from prismiq.engine import PrismiqEngine


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


class PreviewRequest(BaseModel):
    """Request model for query preview endpoint."""

    query: QueryDefinition
    """Query definition to preview."""

    limit: int = 100
    """Maximum number of rows to return."""


class TableConfigUpdate(BaseModel):
    """Request model for updating table configuration."""

    display_name: str | None = None
    """Friendly display name for the table."""

    description: str | None = None
    """Description for the table."""

    hidden: bool | None = None
    """Whether to hide the table from the schema explorer."""


class ColumnConfigUpdate(BaseModel):
    """Request model for updating column configuration."""

    display_name: str | None = None
    """Friendly display name for the column."""

    description: str | None = None
    """Description for the column."""

    hidden: bool | None = None
    """Whether to hide the column from the schema explorer."""

    format: str | None = None
    """Number format: plain, currency, percent, compact."""

    date_format: str | None = None
    """Date format string for date/timestamp columns."""


class SuccessResponse(BaseModel):
    """Generic success response."""

    success: bool = True
    """Whether the operation succeeded."""

    message: str = "OK"
    """Success message."""


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
# Router Factory
# ============================================================================


def create_router(engine: PrismiqEngine) -> APIRouter:
    """
    Create a FastAPI router for the Prismiq analytics engine.

    Args:
        engine: Initialized PrismiqEngine instance.

    Returns:
        APIRouter with analytics endpoints.

    Example:
        >>> engine = PrismiqEngine(database_url)
        >>> await engine.startup()
        >>> router = create_router(engine)
        >>> app.include_router(router, prefix="/api/analytics")
    """
    router = APIRouter(tags=["analytics"])

    # ========================================================================
    # Schema Endpoints
    # ========================================================================

    @router.get("/schema", response_model=DatabaseSchema)
    async def get_schema() -> DatabaseSchema:
        """
        Get the complete database schema (raw).

        Returns all exposed tables, their columns, and relationships
        without any configuration applied.
        """
        return await engine.get_schema()

    @router.get("/schema/enhanced", response_model=EnhancedDatabaseSchema)
    async def get_enhanced_schema() -> EnhancedDatabaseSchema:
        """
        Get the enhanced database schema with configuration applied.

        Returns schema with display names, descriptions, and hidden
        tables/columns filtered out.
        """
        return await engine.get_enhanced_schema()

    @router.get("/tables", response_model=TableListResponse)
    async def get_tables() -> TableListResponse:
        """
        Get list of available table names.

        Returns a simple list of table names for quick reference.
        """
        schema = await engine.get_schema()
        return TableListResponse(tables=schema.table_names())

    @router.get("/tables/{table_name}", response_model=TableSchema)
    async def get_table(table_name: str) -> TableSchema:
        """
        Get schema information for a single table (raw).

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            TableSchema with columns and metadata.

        Raises:
            404: If the table is not found.
        """
        try:
            return await engine.get_table(table_name)
        except TableNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e

    @router.get("/tables/{table_name}/enhanced", response_model=EnhancedTableSchema)
    async def get_enhanced_table(table_name: str) -> EnhancedTableSchema:
        """
        Get enhanced schema information for a single table.

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            EnhancedTableSchema with display names and format hints.

        Raises:
            404: If the table is not found or is hidden.
        """
        enhanced_schema = await engine.get_enhanced_schema()
        table = enhanced_schema.get_table(table_name)
        if table is None:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found")
        return table

    # ========================================================================
    # Query Endpoints
    # ========================================================================

    @router.post("/query/validate", response_model=ValidationResponse)
    async def validate_query(query: QueryDefinition) -> ValidationResponse:
        """
        Validate a query without executing it.

        Checks that all tables and columns exist in the schema,
        and that join columns are compatible.

        Args:
            query: Query definition to validate.

        Returns:
            ValidationResponse with valid flag and any errors.
        """
        errors = engine.validate_query(query)
        return ValidationResponse(valid=len(errors) == 0, errors=errors)

    @router.post("/query/validate/detailed", response_model=DetailedValidationResponse)
    async def validate_query_detailed(query: QueryDefinition) -> DetailedValidationResponse:
        """
        Validate a query with detailed error information.

        Returns detailed errors with error codes, field paths, and suggestions.

        Args:
            query: Query definition to validate.

        Returns:
            DetailedValidationResponse with complete validation result.
        """
        result = engine.validate_query_detailed(query)
        return DetailedValidationResponse(result=result)

    @router.post("/query/execute", response_model=QueryResult)
    async def execute_query(query: QueryDefinition) -> QueryResult:
        """
        Execute a query and return results.

        Args:
            query: Query definition to execute.

        Returns:
            QueryResult with columns, rows, and execution metadata.

        Raises:
            400: If the query fails validation.
            500: If the query execution fails.
        """
        try:
            return await engine.execute_query(query)
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.post("/query/preview", response_model=QueryResult)
    async def preview_query(request: PreviewRequest) -> QueryResult:
        """
        Execute a query with a limited number of rows.

        Useful for quick previews in the query builder UI.

        Args:
            request: Preview request with query and limit.

        Returns:
            QueryResult with limited rows.

        Raises:
            400: If the query fails validation.
            500: If the query execution fails.
        """
        try:
            return await engine.preview_query(request.query, limit=request.limit)
        except QueryValidationError as e:
            raise HTTPException(
                status_code=400, detail={"message": e.message, "errors": e.errors}
            ) from e
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

    # ========================================================================
    # Time Series Endpoints
    # ========================================================================

    @router.post("/query/execute/timeseries", response_model=QueryResult)
    async def execute_timeseries_query(request: TimeSeriesQueryRequest) -> QueryResult:
        """
        Execute a time series query with automatic bucketing.

        Automatically adds date_trunc to the query for time bucketing
        and optionally fills missing time buckets.

        Args:
            request: Time series query request with interval configuration.

        Returns:
            QueryResult with time-bucketed data.

        Raises:
            400: If the query fails validation or date column is invalid.
            500: If the query execution fails.
        """
        try:
            return await engine.execute_timeseries_query(
                query=request.query,
                interval=request.interval,
                date_column=request.date_column,
                fill_missing=request.fill_missing,
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
        """
        Pivot query result data from long to wide format.

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
        """
        Add trend columns to query result.

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
        """
        Calculate trend for a metric query.

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
    # Schema Config Endpoints
    # ========================================================================

    @router.get("/config", response_model=SchemaConfig)
    async def get_schema_config() -> SchemaConfig:
        """
        Get the current schema configuration.

        Returns:
            Current SchemaConfig with all table and column settings.
        """
        return engine.get_schema_config()

    @router.put("/config", response_model=SuccessResponse)
    async def set_schema_config(config: SchemaConfig) -> SuccessResponse:
        """
        Replace the entire schema configuration.

        Args:
            config: New schema configuration.

        Returns:
            Success response.
        """
        engine.set_schema_config(config)
        return SuccessResponse(message="Schema configuration updated")

    @router.get("/config/tables/{table_name}", response_model=TableConfig)
    async def get_table_config(table_name: str) -> TableConfig:
        """
        Get configuration for a specific table.

        Args:
            table_name: Name of the table.

        Returns:
            TableConfig for the table (may be default if not configured).
        """
        config = engine.get_schema_config()
        return config.get_table_config(table_name)

    @router.put("/config/tables/{table_name}", response_model=SuccessResponse)
    async def update_table_config(table_name: str, update: TableConfigUpdate) -> SuccessResponse:
        """
        Update configuration for a specific table.

        Only the provided fields are updated; others are preserved.

        Args:
            table_name: Name of the table.
            update: Fields to update.

        Returns:
            Success response.
        """
        current = engine.get_schema_config().get_table_config(table_name)

        new_config = TableConfig(
            display_name=update.display_name
            if update.display_name is not None
            else current.display_name,
            description=update.description
            if update.description is not None
            else current.description,
            hidden=update.hidden if update.hidden is not None else current.hidden,
            columns=current.columns,
        )

        engine.update_table_config(table_name, new_config)
        return SuccessResponse(message=f"Table '{table_name}' configuration updated")

    @router.get("/config/tables/{table_name}/columns/{column_name}", response_model=ColumnConfig)
    async def get_column_config(table_name: str, column_name: str) -> ColumnConfig:
        """
        Get configuration for a specific column.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.

        Returns:
            ColumnConfig for the column (may be default if not configured).
        """
        config = engine.get_schema_config()
        return config.get_column_config(table_name, column_name)

    @router.put("/config/tables/{table_name}/columns/{column_name}", response_model=SuccessResponse)
    async def update_column_config(
        table_name: str, column_name: str, update: ColumnConfigUpdate
    ) -> SuccessResponse:
        """
        Update configuration for a specific column.

        Only the provided fields are updated; others are preserved.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.
            update: Fields to update.

        Returns:
            Success response.
        """
        current = engine.get_schema_config().get_column_config(table_name, column_name)

        new_config = ColumnConfig(
            display_name=update.display_name
            if update.display_name is not None
            else current.display_name,
            description=update.description
            if update.description is not None
            else current.description,
            hidden=update.hidden if update.hidden is not None else current.hidden,
            format=update.format if update.format is not None else current.format,
            date_format=update.date_format
            if update.date_format is not None
            else current.date_format,
        )

        engine.update_column_config(table_name, column_name, new_config)
        return SuccessResponse(message=f"Column '{table_name}.{column_name}' configuration updated")

    @router.delete("/config/tables/{table_name}", response_model=SuccessResponse)
    async def reset_table_config(table_name: str) -> SuccessResponse:
        """
        Reset configuration for a specific table to defaults.

        Args:
            table_name: Name of the table.

        Returns:
            Success response.
        """
        engine.update_table_config(table_name, TableConfig())
        return SuccessResponse(message=f"Table '{table_name}' configuration reset")

    @router.delete(
        "/config/tables/{table_name}/columns/{column_name}", response_model=SuccessResponse
    )
    async def reset_column_config(table_name: str, column_name: str) -> SuccessResponse:
        """
        Reset configuration for a specific column to defaults.

        Args:
            table_name: Name of the table.
            column_name: Name of the column.

        Returns:
            Success response.
        """
        engine.update_column_config(table_name, column_name, ColumnConfig())
        return SuccessResponse(message=f"Column '{table_name}.{column_name}' configuration reset")

    return router
