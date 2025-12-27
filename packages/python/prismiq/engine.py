"""
Main PrismiqEngine class that ties all components together.

This module provides the central engine class for the Prismiq
embedded analytics platform.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import asyncpg

from prismiq.executor import QueryExecutor
from prismiq.query import QueryBuilder, ValidationResult
from prismiq.schema import SchemaIntrospector
from prismiq.schema_config import (
    ColumnConfig,
    EnhancedDatabaseSchema,
    SchemaConfig,
    SchemaConfigManager,
    TableConfig,
)
from prismiq.types import (
    DatabaseSchema,
    QueryDefinition,
    QueryResult,
    TableSchema,
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
    """

    def __init__(
        self,
        database_url: str,
        exposed_tables: list[str] | None = None,
        query_timeout: float = 30.0,
        max_rows: int = 10000,
        schema_name: str = "public",
        schema_config: SchemaConfig | None = None,
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
        """
        self._database_url = database_url
        self._exposed_tables = exposed_tables
        self._query_timeout = query_timeout
        self._max_rows = max_rows
        self._schema_name = schema_name

        # Schema config manager
        self._schema_config_manager = SchemaConfigManager(schema_config)

        # These will be initialized in startup()
        self._pool: Pool | None = None
        self._introspector: SchemaIntrospector | None = None
        self._executor: QueryExecutor | None = None
        self._builder: QueryBuilder | None = None
        self._schema: DatabaseSchema | None = None

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

        # Create schema introspector
        self._introspector = SchemaIntrospector(
            self._pool,
            exposed_tables=self._exposed_tables,
            schema_name=self._schema_name,
        )

        # Introspect schema
        self._schema = await self._introspector.get_schema()

        # Create query builder and executor
        self._builder = QueryBuilder(self._schema)
        self._executor = QueryExecutor(
            self._pool,
            self._schema,
            query_timeout=self._query_timeout,
            max_rows=self._max_rows,
        )

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
        self._schema = None

    # ========================================================================
    # Schema Methods
    # ========================================================================

    async def get_schema(self) -> DatabaseSchema:
        """
        Get the complete database schema (raw, without config applied).

        Returns:
            DatabaseSchema containing all exposed tables and relationships.

        Raises:
            RuntimeError: If the engine has not been started.
        """
        self._ensure_started()
        assert self._introspector is not None
        return await self._introspector.get_schema()

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

    async def execute_query(self, query: QueryDefinition) -> QueryResult:
        """
        Execute a query and return results.

        Args:
            query: Query definition to execute.

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
        return await self._executor.execute(query)

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
