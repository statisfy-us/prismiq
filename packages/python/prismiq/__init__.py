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

from typing import TYPE_CHECKING

__version__ = "0.1.0"

# =============================================================================
# Lightweight imports (no heavy dependencies like asyncpg)
# These are always loaded when the package is imported
# =============================================================================

# Authentication (no external dependencies)
from prismiq.auth import (AuthContext, SimpleAuthContext,
                          create_header_auth_dependency)
# Calculated field processor (no external dependencies)
from prismiq.calculated_field_processor import preprocess_calculated_fields
# Calculated fields (no external dependencies)
from prismiq.calculated_fields import (ExpressionParser, has_aggregation,
                                       resolve_calculated_fields)
# Dashboard store interface (no external dependencies)
from prismiq.dashboard_store import DashboardStore, InMemoryDashboardStore
# Dashboard models (pydantic only)
from prismiq.dashboards import (Dashboard, DashboardCreate, DashboardExport,
                                DashboardFilter, DashboardFilterType,
                                DashboardLayout, DashboardUpdate, Widget,
                                WidgetConfig, WidgetCreate, WidgetPosition,
                                WidgetType, WidgetUpdate)
# Date utilities (no external dependencies)
from prismiq.dates import (DatePreset, date_add, date_trunc,
                           get_date_range_sql, resolve_date_preset)
# Filter merge utilities (no external dependencies)
from prismiq.filter_merge import (FilterValue, filter_to_query_filter,
                                  filter_to_query_filters,
                                  get_applicable_filters, merge_filters,
                                  resolve_date_filter)
# Formatting utilities (no external dependencies)
from prismiq.formatting import (NumberFormat, format_compact, format_currency,
                                format_number, format_percent, parse_number)
# Permissions (no external dependencies)
from prismiq.permissions import (can_delete_dashboard, can_edit_dashboard,
                                 can_edit_widget, can_view_dashboard)
# Schema configuration (no external dependencies)
from prismiq.schema_config import (ColumnConfig, EnhancedColumnSchema,
                                   EnhancedDatabaseSchema, EnhancedTableSchema,
                                   SchemaConfig, SchemaConfigManager,
                                   TableConfig)
# SQL utilities (no external dependencies)
from prismiq.sql_utils import (ALLOWED_AGGREGATIONS, ALLOWED_DATE_TRUNCS,
                               ALLOWED_JOIN_TYPES, ALLOWED_OPERATORS,
                               ALLOWED_ORDER_DIRECTIONS,
                               convert_revealbi_date_format_to_postgres,
                               quote_identifier, validate_identifier)
# SQLAlchemy builder (only depends on sql_utils)
from prismiq.sqlalchemy_builder import build_sql_from_dict
# Time series utilities (no external dependencies)
from prismiq.timeseries import (TimeBucket, TimeInterval, fill_missing_buckets,
                                generate_time_buckets, get_date_trunc_sql,
                                get_interval_format)
# Transform utilities (no external dependencies)
from prismiq.transforms import (calculate_percent_of_total,
                                calculate_running_total, fill_nulls,
                                limit_result, pivot_data, sort_result,
                                transpose_data)
# Trend utilities (no external dependencies)
from prismiq.trends import (ComparisonPeriod, TrendDirection, TrendResult,
                            add_trend_column, calculate_moving_average,
                            calculate_period_comparison, calculate_trend,
                            calculate_year_over_year)
# Types (pydantic only)
from prismiq.types import (AggregationType, ColumnSchema, ColumnSelection,
                           DatabaseSchema, FilterDefinition, FilterOperator,
                           GroupByDefinition, JoinDefinition, JoinType,
                           PrismiqError, QueryDefinition, QueryExecutionError,
                           QueryResult, QueryTable, QueryTimeoutError,
                           QueryValidationError, Relationship, SortDefinition,
                           SortDirection, TableNotFoundError, TableSchema,
                           TimeSeriesConfig)

# =============================================================================
# Lazy imports for heavy modules (require asyncpg, redis, etc.)
# These are only loaded when explicitly accessed
# =============================================================================

# Map of lazy attribute names to their module and attribute
_LAZY_IMPORTS: dict[str, tuple[str, str]] = {
    # Engine (requires asyncpg)
    "PrismiqEngine": ("prismiq.engine", "PrismiqEngine"),
    # Executor (requires asyncpg)
    "QueryExecutor": ("prismiq.executor", "QueryExecutor"),
    # Schema introspector (requires asyncpg)
    "SchemaIntrospector": ("prismiq.schema", "SchemaIntrospector"),
    # Query builder (requires asyncpg for schema validation)
    "QueryBuilder": ("prismiq.query", "QueryBuilder"),
    "ValidationError": ("prismiq.query", "ValidationError"),
    "ValidationResult": ("prismiq.query", "ValidationResult"),
    # API router (requires fastapi)
    "create_router": ("prismiq.api", "create_router"),
    "HealthCheck": ("prismiq.api", "HealthCheck"),
    "HealthStatus": ("prismiq.api", "HealthStatus"),
    "LivenessResponse": ("prismiq.api", "LivenessResponse"),
    "ReadinessResponse": ("prismiq.api", "ReadinessResponse"),
    # Cache backends (redis is optional)
    "CacheBackend": ("prismiq.cache", "CacheBackend"),
    "CacheConfig": ("prismiq.cache", "CacheConfig"),
    "InMemoryCache": ("prismiq.cache", "InMemoryCache"),
    "QueryCache": ("prismiq.cache", "QueryCache"),
    "RedisCache": ("prismiq.cache", "RedisCache"),
    "SchemaCache": ("prismiq.cache", "SchemaCache"),
    # Persistence (requires asyncpg)
    "PostgresDashboardStore": ("prismiq.persistence", "PostgresDashboardStore"),
    "drop_tables": ("prismiq.persistence", "drop_tables"),
    "ensure_tables": ("prismiq.persistence", "ensure_tables"),
    # SQL validator (requires sqlglot)
    "SQLValidationError": ("prismiq.sql_validator", "SQLValidationError"),
    "SQLValidationResult": ("prismiq.sql_validator", "SQLValidationResult"),
    "SQLValidator": ("prismiq.sql_validator", "SQLValidator"),
    # Logging utilities
    "LogConfig": ("prismiq.logging", "LogConfig"),
    "LogContext": ("prismiq.logging", "LogContext"),
    "Logger": ("prismiq.logging", "Logger"),
    "QueryLog": ("prismiq.logging", "QueryLog"),
    "QueryLogger": ("prismiq.logging", "QueryLogger"),
    "RequestLoggingMiddleware": ("prismiq.logging", "RequestLoggingMiddleware"),
    "StructuredFormatter": ("prismiq.logging", "StructuredFormatter"),
    "TextFormatter": ("prismiq.logging", "TextFormatter"),
    "configure_logging": ("prismiq.logging", "configure_logging"),
    "get_logger": ("prismiq.logging", "get_logger"),
    "get_request_id": ("prismiq.logging", "get_request_id"),
    "set_request_id": ("prismiq.logging", "set_request_id"),
    # Metrics
    "DEFAULT_BUCKETS": ("prismiq.metrics", "DEFAULT_BUCKETS"),
    "HistogramValue": ("prismiq.metrics", "HistogramValue"),
    "Metrics": ("prismiq.metrics", "Metrics"),
    "MetricValue": ("prismiq.metrics", "MetricValue"),
    "Timer": ("prismiq.metrics", "Timer"),
    "create_metrics_router": ("prismiq.metrics", "create_metrics_router"),
    "metrics": ("prismiq.metrics", "metrics"),
    "record_cache_hit": ("prismiq.metrics", "record_cache_hit"),
    "record_query_execution": ("prismiq.metrics", "record_query_execution"),
    "record_request": ("prismiq.metrics", "record_request"),
    "set_active_connections": ("prismiq.metrics", "set_active_connections"),
    # Middleware
    "RateLimitConfig": ("prismiq.middleware", "RateLimitConfig"),
    "RateLimiter": ("prismiq.middleware", "RateLimiter"),
    "RateLimitMiddleware": ("prismiq.middleware", "RateLimitMiddleware"),
    "SlidingWindowCounter": ("prismiq.middleware", "SlidingWindowCounter"),
    "TokenBucket": ("prismiq.middleware", "TokenBucket"),
    "create_rate_limiter": ("prismiq.middleware", "create_rate_limiter"),
}


def __getattr__(name: str):
    """Lazy import for heavy modules."""
    if name in _LAZY_IMPORTS:
        module_path, attr_name = _LAZY_IMPORTS[name]
        import importlib

        module = importlib.import_module(module_path)
        return getattr(module, attr_name)
    raise AttributeError(f"module 'prismiq' has no attribute '{name}'")


# Type hints for lazy imports (only used by type checkers, not at runtime)
if TYPE_CHECKING:
    from prismiq.api import (HealthCheck, HealthStatus, LivenessResponse,
                             ReadinessResponse, create_router)
    from prismiq.cache import (CacheBackend, CacheConfig, InMemoryCache,
                               QueryCache, RedisCache, SchemaCache)
    from prismiq.engine import PrismiqEngine
    from prismiq.executor import QueryExecutor
    from prismiq.logging import (LogConfig, LogContext, Logger, QueryLog,
                                 QueryLogger, RequestLoggingMiddleware,
                                 StructuredFormatter, TextFormatter,
                                 configure_logging, get_logger, get_request_id,
                                 set_request_id)
    from prismiq.metrics import (DEFAULT_BUCKETS, HistogramValue, Metrics,
                                 MetricValue, Timer, create_metrics_router,
                                 metrics, record_cache_hit,
                                 record_query_execution, record_request,
                                 set_active_connections)
    from prismiq.middleware import (RateLimitConfig, RateLimiter,
                                    RateLimitMiddleware, SlidingWindowCounter,
                                    TokenBucket, create_rate_limiter)
    from prismiq.persistence import (PostgresDashboardStore, drop_tables,
                                     ensure_tables)
    from prismiq.query import QueryBuilder, ValidationError, ValidationResult
    from prismiq.schema import SchemaIntrospector
    from prismiq.sql_validator import (SQLValidationError, SQLValidationResult,
                                       SQLValidator)


__all__ = [
    # Version
    "__version__",
    # SQL utilities (lightweight)
    "ALLOWED_AGGREGATIONS",
    "ALLOWED_DATE_TRUNCS",
    "ALLOWED_JOIN_TYPES",
    "ALLOWED_OPERATORS",
    "ALLOWED_ORDER_DIRECTIONS",
    "build_sql_from_dict",
    "convert_revealbi_date_format_to_postgres",
    "quote_identifier",
    "validate_identifier",
    # Calculated fields (lightweight)
    "ExpressionParser",
    "has_aggregation",
    "preprocess_calculated_fields",
    "resolve_calculated_fields",
    # Types (lightweight)
    "AggregationType",
    "ColumnSchema",
    "ColumnSelection",
    "DatabaseSchema",
    "FilterDefinition",
    "FilterOperator",
    "GroupByDefinition",
    "JoinDefinition",
    "JoinType",
    "PrismiqError",
    "QueryDefinition",
    "QueryExecutionError",
    "QueryResult",
    "QueryTable",
    "QueryTimeoutError",
    "QueryValidationError",
    "Relationship",
    "SortDefinition",
    "SortDirection",
    "TableNotFoundError",
    "TableSchema",
    "TimeSeriesConfig",
    # Dashboard models (lightweight)
    "Dashboard",
    "DashboardCreate",
    "DashboardExport",
    "DashboardFilter",
    "DashboardFilterType",
    "DashboardLayout",
    "DashboardUpdate",
    "Widget",
    "WidgetConfig",
    "WidgetCreate",
    "WidgetPosition",
    "WidgetType",
    "WidgetUpdate",
    # Date utilities (lightweight)
    "DatePreset",
    "date_add",
    "date_trunc",
    "get_date_range_sql",
    "resolve_date_preset",
    # Formatting utilities (lightweight)
    "NumberFormat",
    "format_compact",
    "format_currency",
    "format_number",
    "format_percent",
    "parse_number",
    # Time series utilities (lightweight)
    "TimeBucket",
    "TimeInterval",
    "fill_missing_buckets",
    "generate_time_buckets",
    "get_date_trunc_sql",
    "get_interval_format",
    # Transform utilities (lightweight)
    "calculate_percent_of_total",
    "calculate_running_total",
    "fill_nulls",
    "limit_result",
    "pivot_data",
    "sort_result",
    "transpose_data",
    # Trend utilities (lightweight)
    "ComparisonPeriod",
    "TrendDirection",
    "TrendResult",
    "add_trend_column",
    "calculate_moving_average",
    "calculate_period_comparison",
    "calculate_trend",
    "calculate_year_over_year",
    # Authentication (lightweight)
    "AuthContext",
    "SimpleAuthContext",
    "create_header_auth_dependency",
    # Permissions (lightweight)
    "can_delete_dashboard",
    "can_edit_dashboard",
    "can_edit_widget",
    "can_view_dashboard",
    # Filter merge utilities (lightweight)
    "FilterValue",
    "filter_to_query_filter",
    "filter_to_query_filters",
    "get_applicable_filters",
    "merge_filters",
    "resolve_date_filter",
    # Dashboard store (lightweight)
    "DashboardStore",
    "InMemoryDashboardStore",
    # Schema configuration (lightweight)
    "ColumnConfig",
    "EnhancedColumnSchema",
    "EnhancedDatabaseSchema",
    "EnhancedTableSchema",
    "SchemaConfig",
    "SchemaConfigManager",
    "TableConfig",
    # === Lazy imports (heavy dependencies) ===
    # Engine (asyncpg)
    "PrismiqEngine",
    # Executor (asyncpg)
    "QueryExecutor",
    # Schema introspector (asyncpg)
    "SchemaIntrospector",
    # Query builder (asyncpg)
    "QueryBuilder",
    "ValidationError",
    "ValidationResult",
    # API router (fastapi)
    "create_router",
    "HealthCheck",
    "HealthStatus",
    "LivenessResponse",
    "ReadinessResponse",
    # Cache backends (redis optional)
    "CacheBackend",
    "CacheConfig",
    "InMemoryCache",
    "QueryCache",
    "RedisCache",
    "SchemaCache",
    # Persistence (asyncpg)
    "PostgresDashboardStore",
    "drop_tables",
    "ensure_tables",
    # SQL validator (sqlglot)
    "SQLValidationError",
    "SQLValidationResult",
    "SQLValidator",
    # Logging utilities
    "LogConfig",
    "LogContext",
    "Logger",
    "QueryLog",
    "QueryLogger",
    "RequestLoggingMiddleware",
    "StructuredFormatter",
    "TextFormatter",
    "configure_logging",
    "get_logger",
    "get_request_id",
    "set_request_id",
    # Metrics
    "DEFAULT_BUCKETS",
    "HistogramValue",
    "Metrics",
    "MetricValue",
    "Timer",
    "create_metrics_router",
    "metrics",
    "record_cache_hit",
    "record_query_execution",
    "record_request",
    "set_active_connections",
    # Middleware
    "RateLimitConfig",
    "RateLimiter",
    "RateLimitMiddleware",
    "SlidingWindowCounter",
    "TokenBucket",
    "create_rate_limiter",
]
