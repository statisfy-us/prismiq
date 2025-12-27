"""
FastAPI routes for the Prismiq analytics engine.

This module provides a factory function to create an API router
that exposes schema, validation, and query execution endpoints.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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

    @router.get("/schema", response_model=DatabaseSchema)
    async def get_schema() -> DatabaseSchema:
        """
        Get the complete database schema.

        Returns all exposed tables, their columns, and relationships.
        """
        return await engine.get_schema()

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
        Get schema information for a single table.

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

    return router
