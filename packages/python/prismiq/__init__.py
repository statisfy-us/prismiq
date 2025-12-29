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
from prismiq.api import (
    HealthCheck,
    HealthStatus,
    LivenessResponse,
    ReadinessResponse,
    create_router,
)

# Cache backends
from prismiq.cache import (
    CacheBackend,
    CacheConfig,
    InMemoryCache,
    QueryCache,
    RedisCache,
    SchemaCache,
)

# Dashboard models and storage
from prismiq.dashboard_store import DashboardStore, InMemoryDashboardStore
from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardExport,
    DashboardFilter,
    DashboardFilterType,
    DashboardLayout,
    DashboardUpdate,
    Widget,
    WidgetConfig,
    WidgetCreate,
    WidgetPosition,
    WidgetType,
    WidgetUpdate,
)

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

# Filter merging utilities
from prismiq.filter_merge import (
    FilterValue,
    filter_to_query_filter,
    filter_to_query_filters,
    get_applicable_filters,
    merge_filters,
    resolve_date_filter,
)

# Number formatting utilities
from prismiq.formatting import (
    NumberFormat,
    format_compact,
    format_currency,
    format_number,
    format_percent,
    parse_number,
)

# Logging utilities
from prismiq.logging import (
    LogConfig,
    LogContext,
    Logger,
    QueryLog,
    QueryLogger,
    RequestLoggingMiddleware,
    StructuredFormatter,
    TextFormatter,
    configure_logging,
    get_logger,
    get_request_id,
    set_request_id,
)

# Metrics
from prismiq.metrics import (
    DEFAULT_BUCKETS,
    HistogramValue,
    Metrics,
    MetricValue,
    Timer,
    create_metrics_router,
    metrics,
    record_cache_hit,
    record_query_execution,
    record_request,
    set_active_connections,
)

# Middleware
from prismiq.middleware import (
    RateLimitConfig,
    RateLimiter,
    RateLimitMiddleware,
    SlidingWindowCounter,
    TokenBucket,
    create_rate_limiter,
)

# Database persistence
from prismiq.persistence import PostgresDashboardStore, drop_tables, ensure_tables
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

# Time series utilities
from prismiq.timeseries import (
    TimeBucket,
    TimeInterval,
    fill_missing_buckets,
    generate_time_buckets,
    get_date_trunc_sql,
    get_interval_format,
)

# Data transformation utilities
from prismiq.transforms import (
    calculate_percent_of_total,
    calculate_running_total,
    fill_nulls,
    limit_result,
    pivot_data,
    sort_result,
    transpose_data,
)

# Trend calculation utilities
from prismiq.trends import (
    ComparisonPeriod,
    TrendDirection,
    TrendResult,
    add_trend_column,
    calculate_moving_average,
    calculate_period_comparison,
    calculate_trend,
    calculate_year_over_year,
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
    TimeSeriesConfig,
)

__all__ = [
    # Histogram buckets constant
    "DEFAULT_BUCKETS",
    # Query types
    "AggregationType",
    # Cache backends
    "CacheBackend",
    "CacheConfig",
    # Schema configuration
    "ColumnConfig",
    # Schema types
    "ColumnSchema",
    "ColumnSelection",
    # Trend utilities
    "ComparisonPeriod",
    # Dashboard models
    "Dashboard",
    "DashboardCreate",
    "DashboardExport",
    "DashboardFilter",
    "DashboardFilterType",
    "DashboardLayout",
    # Dashboard storage
    "DashboardStore",
    "DashboardUpdate",
    "DatabaseSchema",
    # Date utilities
    "DatePreset",
    "EnhancedColumnSchema",
    "EnhancedDatabaseSchema",
    "EnhancedTableSchema",
    "FilterDefinition",
    "FilterOperator",
    # Filter merge utilities
    "FilterValue",
    "GroupByDefinition",
    # Health check models
    "HealthCheck",
    "HealthStatus",
    # Histogram metric value
    "HistogramValue",
    # Cache implementations
    "InMemoryCache",
    # Dashboard storage implementations
    "InMemoryDashboardStore",
    "JoinDefinition",
    "JoinType",
    # Liveness probe response
    "LivenessResponse",
    # Logging config
    "LogConfig",
    "LogContext",
    "Logger",
    # Metric value dataclass
    "MetricValue",
    # Metrics class
    "Metrics",
    # Number formatting
    "NumberFormat",
    # Database persistence
    "PostgresDashboardStore",
    # Main engine
    "PrismiqEngine",
    # Exception types
    "PrismiqError",
    # Low-level components
    "QueryBuilder",
    # Query cache
    "QueryCache",
    "QueryDefinition",
    "QueryExecutionError",
    "QueryExecutor",
    # Query logging
    "QueryLog",
    "QueryLogger",
    # Result types
    "QueryResult",
    "QueryTable",
    "QueryTimeoutError",
    "QueryValidationError",
    # Rate limiting
    "RateLimitConfig",
    "RateLimitMiddleware",
    "RateLimiter",
    # Readiness probe response
    "ReadinessResponse",
    "RedisCache",
    "Relationship",
    # Request logging middleware
    "RequestLoggingMiddleware",
    # Schema cache
    "SchemaCache",
    "SchemaConfig",
    "SchemaConfigManager",
    "SchemaIntrospector",
    # Sliding window counter
    "SlidingWindowCounter",
    "SortDefinition",
    "SortDirection",
    # Formatters
    "StructuredFormatter",
    "TableConfig",
    "TableNotFoundError",
    "TableSchema",
    # Text formatter
    "TextFormatter",
    # Time series types
    "TimeBucket",
    "TimeInterval",
    "TimeSeriesConfig",
    # Timer context manager
    "Timer",
    # Token bucket
    "TokenBucket",
    "TrendDirection",
    "TrendResult",
    # Validation
    "ValidationError",
    "ValidationResult",
    # Widget models
    "Widget",
    "WidgetConfig",
    "WidgetCreate",
    "WidgetPosition",
    "WidgetType",
    "WidgetUpdate",
    # Version
    "__version__",
    # Trend functions
    "add_trend_column",
    "calculate_moving_average",
    # Transform functions
    "calculate_percent_of_total",
    "calculate_period_comparison",
    "calculate_running_total",
    # Trend functions
    "calculate_trend",
    "calculate_year_over_year",
    # Logging configuration function
    "configure_logging",
    # Metrics router factory
    "create_metrics_router",
    # Rate limiter factory
    "create_rate_limiter",
    # API router factory
    "create_router",
    "date_add",
    "date_trunc",
    "drop_tables",
    "ensure_tables",
    # Transform functions
    "fill_missing_buckets",
    "fill_nulls",
    # Filter merge functions
    "filter_to_query_filter",
    "filter_to_query_filters",
    "format_compact",
    "format_currency",
    "format_number",
    "format_percent",
    # Time series functions
    "generate_time_buckets",
    "get_applicable_filters",
    "get_date_range_sql",
    "get_date_trunc_sql",
    "get_interval_format",
    # Logger factory
    "get_logger",
    # Request ID context functions
    "get_request_id",
    "limit_result",
    "merge_filters",
    # Global metrics instance
    "metrics",
    "parse_number",
    "pivot_data",
    # Metric recording functions
    "record_cache_hit",
    "record_query_execution",
    "record_request",
    "resolve_date_filter",
    "resolve_date_preset",
    # Active connections gauge
    "set_active_connections",
    "set_request_id",
    "sort_result",
    "transpose_data",
]
