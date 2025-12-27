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
from prismiq.engine import PrismiqEngine
from prismiq.executor import QueryExecutor
from prismiq.query import QueryBuilder

# Low-level components (for advanced use)
from prismiq.schema import SchemaIntrospector

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
    # Schema types
    "ColumnSchema",
    "ColumnSelection",
    "DatabaseSchema",
    "FilterDefinition",
    "FilterOperator",
    "GroupByDefinition",
    "JoinDefinition",
    "JoinType",
    # Main engine
    "PrismiqEngine",
    # Exception types
    "PrismiqError",
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
    # Low-level components
    "SchemaIntrospector",
    "SortDefinition",
    "SortDirection",
    "TableNotFoundError",
    "TableSchema",
    # Version
    "__version__",
    "create_router",
]
