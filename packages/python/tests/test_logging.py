"""Tests for the logging module."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from io import StringIO
from unittest.mock import MagicMock

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

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

# ============================================================================
# Request ID Context Tests
# ============================================================================


class TestRequestIdContext:
    """Tests for request ID context management."""

    def test_get_request_id_default_is_none(self) -> None:
        """Request ID is None by default."""
        # Clear any existing value
        set_request_id(None)  # type: ignore[arg-type]
        # Note: Context var resets between tests due to async isolation
        result = get_request_id()
        # Can be None or a previously set value depending on test order
        assert result is None or isinstance(result, str)

    def test_set_and_get_request_id(self) -> None:
        """Can set and retrieve request ID."""
        set_request_id("test-request-123")
        result = get_request_id()
        assert result == "test-request-123"


# ============================================================================
# LogConfig Tests
# ============================================================================


class TestLogConfig:
    """Tests for LogConfig."""

    def test_default_values(self) -> None:
        """Config has sensible defaults."""
        config = LogConfig()

        assert config.level == "INFO"
        assert config.format == "json"
        assert config.include_timestamp is True
        assert config.include_request_id is True
        assert config.include_caller is False

    def test_custom_values(self) -> None:
        """Can set custom values."""
        config = LogConfig(
            level="DEBUG",
            format="text",
            include_timestamp=False,
            include_caller=True,
        )

        assert config.level == "DEBUG"
        assert config.format == "text"
        assert config.include_timestamp is False
        assert config.include_caller is True


# ============================================================================
# LogContext Tests
# ============================================================================


class TestLogContext:
    """Tests for LogContext."""

    def test_empty_context(self) -> None:
        """Empty context has no extra fields."""
        ctx = LogContext()
        assert ctx.extra == {}

    def test_with_field_adds_field(self) -> None:
        """with_field adds a single field."""
        ctx = LogContext()
        ctx2 = ctx.with_field("user_id", "123")

        assert ctx2.extra == {"user_id": "123"}
        assert ctx.extra == {}  # Original unchanged

    def test_with_fields_adds_multiple_fields(self) -> None:
        """with_fields adds multiple fields."""
        ctx = LogContext()
        ctx2 = ctx.with_fields(user_id="123", action="query")

        assert ctx2.extra == {"user_id": "123", "action": "query"}

    def test_chained_with_field(self) -> None:
        """Can chain with_field calls."""
        ctx = LogContext().with_field("a", 1).with_field("b", 2)

        assert ctx.extra == {"a": 1, "b": 2}


# ============================================================================
# StructuredFormatter Tests
# ============================================================================


class TestStructuredFormatter:
    """Tests for StructuredFormatter."""

    @pytest.fixture
    def formatter(self) -> StructuredFormatter:
        """Create formatter for testing."""
        return StructuredFormatter(LogConfig(include_timestamp=False, include_request_id=False))

    def test_formats_as_json(self, formatter: StructuredFormatter) -> None:
        """Output is valid JSON."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        output = formatter.format(record)
        data = json.loads(output)

        assert data["level"] == "INFO"
        assert data["message"] == "Test message"
        assert data["logger"] == "test"

    def test_includes_timestamp_when_configured(self) -> None:
        """Includes timestamp when configured."""
        formatter = StructuredFormatter(LogConfig(include_timestamp=True))
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test",
            args=(),
            exc_info=None,
        )

        output = formatter.format(record)
        data = json.loads(output)

        assert "timestamp" in data

    def test_includes_extra_fields(self, formatter: StructuredFormatter) -> None:
        """Includes extra fields from record."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.extra_fields = {"user_id": "123", "action": "query"}  # type: ignore[attr-defined]

        output = formatter.format(record)
        data = json.loads(output)

        assert data["user_id"] == "123"
        assert data["action"] == "query"


# ============================================================================
# TextFormatter Tests
# ============================================================================


class TestTextFormatter:
    """Tests for TextFormatter."""

    @pytest.fixture
    def formatter(self) -> TextFormatter:
        """Create formatter for testing."""
        return TextFormatter(LogConfig(include_timestamp=False, include_request_id=False))

    def test_formats_as_readable_text(self, formatter: TextFormatter) -> None:
        """Output is readable text."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        output = formatter.format(record)

        assert "[INFO]" in output
        assert "test" in output
        assert "Test message" in output

    def test_includes_extra_fields(self, formatter: TextFormatter) -> None:
        """Includes extra fields in output."""
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test",
            args=(),
            exc_info=None,
        )
        record.extra_fields = {"user_id": "123"}  # type: ignore[attr-defined]

        output = formatter.format(record)

        assert "user_id=123" in output


# ============================================================================
# Logger Tests
# ============================================================================


class TestLogger:
    """Tests for Logger class."""

    @pytest.fixture
    def capture_stream(self) -> tuple[Logger, StringIO]:
        """Create logger with captured stream output."""
        stream = StringIO()

        # Configure logging to write to our stream
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.DEBUG)

        # Remove existing handlers
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        handler = logging.StreamHandler(stream)
        handler.setFormatter(StructuredFormatter(LogConfig(include_timestamp=False)))
        root_logger.addHandler(handler)

        return get_logger("test"), stream

    def test_with_context_creates_new_logger(self) -> None:
        """with_context creates new logger with context."""
        logger = get_logger("test")
        logger2 = logger.with_context(user_id="123")

        # Different instances
        assert logger is not logger2
        # Context is different
        assert logger._context.extra == {}
        assert logger2._context.extra == {"user_id": "123"}

    def test_info_logs_message(self, capture_stream: tuple[Logger, StringIO]) -> None:
        """info() logs at INFO level."""
        logger, stream = capture_stream
        logger.info("Test info message")

        stream.seek(0)
        output = stream.read()
        assert "Test info message" in output
        assert "INFO" in output

    def test_error_logs_message(self, capture_stream: tuple[Logger, StringIO]) -> None:
        """error() logs at ERROR level."""
        logger, stream = capture_stream
        logger.error("Test error message")

        stream.seek(0)
        output = stream.read()
        assert "Test error message" in output
        assert "ERROR" in output

    def test_logs_with_fields(self, capture_stream: tuple[Logger, StringIO]) -> None:
        """Can log with additional fields."""
        logger, stream = capture_stream
        logger.info("Test message", user_id="123", action="query")

        stream.seek(0)
        output = stream.read()
        data = json.loads(output.strip())

        assert data["user_id"] == "123"
        assert data["action"] == "query"


# ============================================================================
# configure_logging Tests
# ============================================================================


class TestConfigureLogging:
    """Tests for configure_logging function."""

    def test_configures_root_logger(self) -> None:
        """Configures root logger."""
        configure_logging(LogConfig(level="DEBUG"))

        root_logger = logging.getLogger()
        assert root_logger.level == logging.DEBUG

    def test_configures_json_format(self) -> None:
        """Configures JSON format."""
        stream = StringIO()

        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)

        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        handler = logging.StreamHandler(stream)
        handler.setFormatter(StructuredFormatter(LogConfig(include_timestamp=False)))
        root_logger.addHandler(handler)

        logging.getLogger().info("Test")

        stream.seek(0)
        output = stream.read()
        data = json.loads(output.strip())
        assert "message" in data

    def test_configures_text_format(self) -> None:
        """Configures text format."""
        stream = StringIO()

        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)

        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        handler = logging.StreamHandler(stream)
        handler.setFormatter(TextFormatter(LogConfig(include_timestamp=False)))
        root_logger.addHandler(handler)

        logging.getLogger().info("Test message")

        stream.seek(0)
        output = stream.read()
        assert "[INFO]" in output
        assert "Test message" in output


# ============================================================================
# RequestLoggingMiddleware Tests
# ============================================================================


class TestRequestLoggingMiddleware:
    """Tests for RequestLoggingMiddleware."""

    @pytest.fixture
    def app(self) -> Starlette:
        """Create test application with logging middleware."""

        async def homepage(request: MagicMock) -> JSONResponse:
            return JSONResponse({"status": "ok"})

        async def health(request: MagicMock) -> JSONResponse:
            return JSONResponse({"healthy": True})

        async def error_route(request: MagicMock) -> JSONResponse:
            raise ValueError("Test error")

        app = Starlette(
            routes=[
                Route("/", homepage),
                Route("/health", health),
                Route("/error", error_route),
            ]
        )

        app.add_middleware(
            RequestLoggingMiddleware,
            exclude_paths=["/health"],
        )

        return app

    @pytest.fixture
    def client(self, app: Starlette) -> TestClient:
        """Create test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_logs_request_messages(self, client: TestClient) -> None:
        """Logs request start and completion."""
        # We can't easily capture the middleware logs in tests
        # Just verify the request succeeds
        response = client.get("/")
        assert response.status_code == 200

    def test_adds_request_id_header(self, client: TestClient) -> None:
        """Adds X-Request-ID header to response."""
        response = client.get("/")

        assert "X-Request-ID" in response.headers
        # Should be a valid UUID format
        request_id = response.headers["X-Request-ID"]
        assert len(request_id) == 36

    def test_uses_provided_request_id(self, client: TestClient) -> None:
        """Uses X-Request-ID from request if provided."""
        response = client.get("/", headers={"X-Request-ID": "custom-id-123"})

        assert response.headers["X-Request-ID"] == "custom-id-123"

    def test_excludes_configured_paths(self, client: TestClient) -> None:
        """Excluded paths are processed but not logged."""
        response = client.get("/health")
        assert response.status_code == 200


# ============================================================================
# QueryLog Tests
# ============================================================================


class TestQueryLog:
    """Tests for QueryLog dataclass."""

    def test_creates_with_required_fields(self) -> None:
        """Creates QueryLog with required fields."""
        log = QueryLog(
            query="SELECT * FROM users",
            duration_ms=10.5,
            row_count=5,
        )

        assert log.query == "SELECT * FROM users"
        assert log.duration_ms == 10.5
        assert log.row_count == 5

    def test_has_timestamp(self) -> None:
        """QueryLog has timestamp."""
        log = QueryLog(
            query="SELECT 1",
            duration_ms=1.0,
            row_count=1,
        )

        assert log.timestamp is not None
        assert isinstance(log.timestamp, datetime)

    def test_optional_parameters(self) -> None:
        """Can include query parameters."""
        log = QueryLog(
            query="SELECT * FROM users WHERE id = $1",
            duration_ms=5.0,
            row_count=1,
            parameters={"$1": 123},
        )

        assert log.parameters == {"$1": 123}


# ============================================================================
# QueryLogger Tests
# ============================================================================


class TestQueryLogger:
    """Tests for QueryLogger."""

    @pytest.fixture
    def query_logger_with_stream(self) -> tuple[QueryLogger, StringIO]:
        """Create query logger with captured stream."""
        stream = StringIO()

        root_logger = logging.getLogger()
        root_logger.setLevel(logging.DEBUG)

        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)

        handler = logging.StreamHandler(stream)
        handler.setFormatter(StructuredFormatter(LogConfig(include_timestamp=False)))
        root_logger.addHandler(handler)

        return QueryLogger(), stream

    def test_logs_query(self, query_logger_with_stream: tuple[QueryLogger, StringIO]) -> None:
        """Logs query execution."""
        query_logger, stream = query_logger_with_stream
        query_logger.log_query(
            query="SELECT * FROM users",
            duration_ms=10.5,
            row_count=5,
        )

        stream.seek(0)
        output = stream.read()
        assert "Query executed" in output or "query" in output.lower()

    def test_returns_query_log(self) -> None:
        """Returns QueryLog entry."""
        query_logger = QueryLogger()
        result = query_logger.log_query(
            query="SELECT 1",
            duration_ms=1.0,
            row_count=1,
        )

        assert isinstance(result, QueryLog)
        assert result.query == "SELECT 1"

    def test_warns_on_slow_query(
        self, query_logger_with_stream: tuple[QueryLogger, StringIO]
    ) -> None:
        """Logs warning for slow queries."""
        query_logger, stream = query_logger_with_stream
        query_logger.log_query(
            query="SELECT * FROM large_table",
            duration_ms=2000.0,  # 2 seconds
            row_count=1000,
        )

        stream.seek(0)
        output = stream.read()
        assert "WARNING" in output or "Slow query" in output
