"""
Structured logging for Prismiq.

This module provides structured logging with JSON output,
request correlation, and performance tracking.
"""

from __future__ import annotations

import contextvars
import logging
import sys
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict
from starlette.middleware.base import BaseHTTPMiddleware

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response

# Context variable for request ID (available across async calls)
_request_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """
    Get the current request ID from context.

    Returns:
        Request ID if in request context, None otherwise.
    """
    return _request_id.get()


def set_request_id(request_id: str) -> None:
    """
    Set the request ID in context.

    Args:
        request_id: Request ID to set.
    """
    _request_id.set(request_id)


class LogConfig(BaseModel):
    """Configuration for logging."""

    model_config = ConfigDict(strict=True)

    level: str = "INFO"
    """Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)."""

    format: str = "json"
    """Output format: 'json' or 'text'."""

    include_timestamp: bool = True
    """Include ISO timestamp in logs."""

    include_request_id: bool = True
    """Include request ID in logs."""

    include_caller: bool = False
    """Include caller file and line number."""


@dataclass
class LogContext:
    """Context for structured logging."""

    extra: dict[str, Any] = field(default_factory=dict)
    """Extra fields to include in all logs."""

    def with_field(self, key: str, value: Any) -> LogContext:
        """
        Create a new context with an additional field.

        Args:
            key: Field name.
            value: Field value.

        Returns:
            New LogContext with the additional field.
        """
        new_extra = {**self.extra, key: value}
        return LogContext(extra=new_extra)

    def with_fields(self, **fields: Any) -> LogContext:
        """
        Create a new context with additional fields.

        Args:
            **fields: Fields to add.

        Returns:
            New LogContext with the additional fields.
        """
        new_extra = {**self.extra, **fields}
        return LogContext(extra=new_extra)


class StructuredFormatter(logging.Formatter):
    """
    JSON-formatted log output.

    Outputs log records as JSON with structured fields.
    """

    def __init__(self, config: LogConfig | None = None) -> None:
        """
        Initialize formatter.

        Args:
            config: Logging configuration.
        """
        super().__init__()
        self._config = config or LogConfig()

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        import json

        log_data: dict[str, Any] = {
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }

        if self._config.include_timestamp:
            log_data["timestamp"] = datetime.now(timezone.utc).isoformat()

        if self._config.include_request_id:
            request_id = get_request_id()
            if request_id:
                log_data["request_id"] = request_id

        if self._config.include_caller:
            log_data["caller"] = {
                "file": record.filename,
                "line": record.lineno,
                "function": record.funcName,
            }

        # Include exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Include extra fields from record
        if hasattr(record, "extra_fields"):
            log_data.update(record.extra_fields)  # type: ignore[attr-defined]

        return json.dumps(log_data, default=str)


class TextFormatter(logging.Formatter):
    """
    Human-readable text log output.

    Outputs log records in a readable text format.
    """

    def __init__(self, config: LogConfig | None = None) -> None:
        """
        Initialize formatter.

        Args:
            config: Logging configuration.
        """
        super().__init__()
        self._config = config or LogConfig()

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as text."""
        parts = []

        if self._config.include_timestamp:
            parts.append(datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"))

        parts.append(f"[{record.levelname}]")

        if self._config.include_request_id:
            request_id = get_request_id()
            if request_id:
                parts.append(f"[{request_id[:8]}]")

        parts.append(record.name)
        parts.append("-")
        parts.append(record.getMessage())

        # Include extra fields
        if hasattr(record, "extra_fields") and record.extra_fields:  # type: ignore[attr-defined]
            extra_str = " ".join(
                f"{k}={v}"
                for k, v in record.extra_fields.items()  # type: ignore[attr-defined]
            )
            parts.append(f"| {extra_str}")

        result = " ".join(parts)

        # Include exception info
        if record.exc_info:
            result += "\n" + self.formatException(record.exc_info)

        return result


class Logger:
    """
    Structured logger with context support.

    Wraps Python's standard logger with structured logging capabilities.
    """

    def __init__(
        self,
        name: str,
        context: LogContext | None = None,
    ) -> None:
        """
        Initialize logger.

        Args:
            name: Logger name.
            context: Initial context.
        """
        self._logger = logging.getLogger(name)
        self._context = context or LogContext()

    def with_context(self, **fields: Any) -> Logger:
        """
        Create a new logger with additional context fields.

        Args:
            **fields: Fields to add to context.

        Returns:
            New Logger with additional context.
        """
        new_context = self._context.with_fields(**fields)
        return Logger(self._logger.name, new_context)

    def _log(self, level: int, msg: str, **fields: Any) -> None:
        """Log a message with context."""
        # Merge context and field-specific extras
        extra_fields = {**self._context.extra, **fields}

        # Add request ID if available
        request_id = get_request_id()
        if request_id:
            extra_fields["request_id"] = request_id

        # Create record with extra fields
        record = self._logger.makeRecord(
            self._logger.name,
            level,
            "(unknown file)",
            0,
            msg,
            (),
            None,
        )
        record.extra_fields = extra_fields  # type: ignore[attr-defined]

        self._logger.handle(record)

    def debug(self, msg: str, **fields: Any) -> None:
        """Log at DEBUG level."""
        self._log(logging.DEBUG, msg, **fields)

    def info(self, msg: str, **fields: Any) -> None:
        """Log at INFO level."""
        self._log(logging.INFO, msg, **fields)

    def warning(self, msg: str, **fields: Any) -> None:
        """Log at WARNING level."""
        self._log(logging.WARNING, msg, **fields)

    def error(self, msg: str, **fields: Any) -> None:
        """Log at ERROR level."""
        self._log(logging.ERROR, msg, **fields)

    def critical(self, msg: str, **fields: Any) -> None:
        """Log at CRITICAL level."""
        self._log(logging.CRITICAL, msg, **fields)

    def exception(self, msg: str, **fields: Any) -> None:
        """Log an exception at ERROR level."""
        import traceback

        fields["exception"] = traceback.format_exc()
        self._log(logging.ERROR, msg, **fields)


def configure_logging(config: LogConfig | None = None) -> None:
    """
    Configure the root logger with structured output.

    Args:
        config: Logging configuration.
    """
    config = config or LogConfig()

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.level))

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create handler
    handler = logging.StreamHandler(sys.stdout)

    # Set formatter based on config
    formatter: logging.Formatter = (
        StructuredFormatter(config) if config.format == "json" else TextFormatter(config)
    )

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)


def get_logger(name: str) -> Logger:
    """
    Get a structured logger.

    Args:
        name: Logger name (usually __name__).

    Returns:
        Logger instance.
    """
    return Logger(name)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging HTTP requests.

    Logs request start, completion, and performance metrics.
    """

    def __init__(
        self,
        app: Any,
        logger: Logger | None = None,
        log_request_body: bool = False,
        log_response_body: bool = False,
        exclude_paths: list[str] | None = None,
    ) -> None:
        """
        Initialize request logging middleware.

        Args:
            app: ASGI application.
            logger: Logger to use. Creates default if not provided.
            log_request_body: Whether to log request bodies.
            log_response_body: Whether to log response bodies.
            exclude_paths: Paths to exclude from logging.
        """
        super().__init__(app)
        self._logger = logger or get_logger("prismiq.http")
        self._log_request_body = log_request_body
        self._log_response_body = log_response_body
        self._exclude_paths = set(exclude_paths or [])

    async def dispatch(self, request: Request, call_next: Callable[..., Any]) -> Response:
        """Process request through logging middleware."""
        # Skip excluded paths
        if request.url.path in self._exclude_paths:
            return await call_next(request)

        # Generate request ID
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        set_request_id(request_id)

        # Start timing
        start_time = time.perf_counter()

        # Log request
        self._logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query=str(request.query_params),
            client_ip=request.client.host if request.client else "unknown",
        )

        # Process request
        try:
            response = await call_next(request)

            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log response
            self._logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
            )

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception:
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Log error
            self._logger.exception(
                "Request failed",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
            )
            raise


@dataclass
class QueryLog:
    """Log entry for a database query."""

    query: str
    """SQL query executed."""

    duration_ms: float
    """Query execution time in milliseconds."""

    row_count: int
    """Number of rows returned/affected."""

    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    """When the query was executed."""

    parameters: dict[str, Any] | None = None
    """Query parameters (if any)."""


class QueryLogger:
    """
    Logger for database queries.

    Tracks and logs query performance for monitoring.
    """

    def __init__(self, logger: Logger | None = None) -> None:
        """
        Initialize query logger.

        Args:
            logger: Logger to use.
        """
        self._logger = logger or get_logger("prismiq.query")
        self._slow_query_threshold_ms = 1000.0

    def log_query(
        self,
        query: str,
        duration_ms: float,
        row_count: int,
        parameters: dict[str, Any] | None = None,
    ) -> QueryLog:
        """
        Log a query execution.

        Args:
            query: SQL query.
            duration_ms: Execution time in milliseconds.
            row_count: Number of rows.
            parameters: Query parameters.

        Returns:
            QueryLog entry.
        """
        log_entry = QueryLog(
            query=query,
            duration_ms=duration_ms,
            row_count=row_count,
            parameters=parameters,
        )

        # Determine log level based on duration
        if duration_ms >= self._slow_query_threshold_ms:
            self._logger.warning(
                "Slow query executed",
                query=query[:200],  # Truncate long queries
                duration_ms=round(duration_ms, 2),
                row_count=row_count,
            )
        else:
            self._logger.debug(
                "Query executed",
                query=query[:200],
                duration_ms=round(duration_ms, 2),
                row_count=row_count,
            )

        return log_entry
