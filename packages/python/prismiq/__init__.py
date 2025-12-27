"""
Prismiq - Open-source embedded analytics platform.

A Python backend for building embeddable analytics dashboards
with direct PostgreSQL table access and visual query building.

Example:
    >>> from prismiq import PrismiqEngine, create_router
    >>> from fastapi import FastAPI
    >>>
    >>> app = FastAPI()
    >>> engine = PrismiqEngine(
    ...     database_url="postgresql://user:pass@localhost/db",
    ...     exposed_tables=["users", "orders"],
    ... )
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

from __future__ import annotations

__version__ = "0.1.0"

# Main engine
# API router factory
from prismiq.api import create_router

# Date utilities
from prismiq.dates import (
    DatePreset,
    date_add,
    date_trunc,
    get_date_range_sql,
    resolve_date_preset,
)
from prismiq.engine import PrismiqEngine

# Low-level components (for advanced use)
from prismiq.executor import QueryExecutor

# Number formatting utilities
from prismiq.formatting import (
    NumberFormat,
    format_compact,
    format_currency,
    format_number,
    format_percent,
    parse_number,
)
from prismiq.query import QueryBuilder, ValidationError, ValidationResult
from prismiq.schema import SchemaIntrospector

# Schema configuration
from prismiq.schema_config import (
    ColumnConfig,
    EnhancedColumnSchema,
    EnhancedDatabaseSchema,
    EnhancedTableSchema,
    SchemaConfig,
    SchemaConfigManager,
    TableConfig,
)

# Schema types
# Query types
# Result types
# Exception types
from prismiq.types import (
    AggregationType,
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    GroupByDefinition,
    JoinDefinition,
    JoinType,
    PrismiqError,
    QueryDefinition,
    QueryExecutionError,
    QueryResult,
    QueryTable,
    QueryTimeoutError,
    QueryValidationError,
    Relationship,
    SortDefinition,
    SortDirection,
    TableNotFoundError,
    TableSchema,
)

__all__ = [
    # Query types
    "AggregationType",
    # Schema configuration
    "ColumnConfig",
    # Schema types
    "ColumnSchema",
    "ColumnSelection",
    "DatabaseSchema",
    # Date utilities
    "DatePreset",
    "EnhancedColumnSchema",
    "EnhancedDatabaseSchema",
    "EnhancedTableSchema",
    "FilterDefinition",
    "FilterOperator",
    "GroupByDefinition",
    "JoinDefinition",
    "JoinType",
    # Number formatting
    "NumberFormat",
    # Main engine
    "PrismiqEngine",
    # Exception types
    "PrismiqError",
    # Low-level components
    "QueryBuilder",
    "QueryDefinition",
    "QueryExecutionError",
    "QueryExecutor",
    # Result types
    "QueryResult",
    "QueryTable",
    "QueryTimeoutError",
    "QueryValidationError",
    "Relationship",
    "SchemaConfig",
    "SchemaConfigManager",
    "SchemaIntrospector",
    "SortDefinition",
    "SortDirection",
    "TableConfig",
    "TableNotFoundError",
    "TableSchema",
    # Validation
    "ValidationError",
    "ValidationResult",
    # Version
    "__version__",
    # API router factory
    "create_router",
    "date_add",
    "date_trunc",
    "format_compact",
    "format_currency",
    "format_number",
    "format_percent",
    "get_date_range_sql",
    "parse_number",
    "resolve_date_preset",
]
