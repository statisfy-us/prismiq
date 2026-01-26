"""Tests for FastAPI routes."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from prismiq import __version__
from prismiq.api import (
    HealthCheck,
    HealthStatus,
    LivenessResponse,
    ReadinessResponse,
    create_router,
)
from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
    QueryDefinition,
    QueryResult,
    QueryValidationError,
    TableNotFoundError,
    TableSchema,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="email", data_type="text", is_nullable=False),
                ],
            ),
            TableSchema(
                name="orders",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="total", data_type="numeric", is_nullable=False),
                ],
            ),
        ],
        relationships=[],
    )


@pytest.fixture
def mock_engine(sample_schema: DatabaseSchema) -> MagicMock:
    """Create a mock PrismiqEngine."""
    engine = MagicMock()

    # Explicitly set cache to None to avoid MagicMock auto-attribute creation
    # This prevents the health check from trying to check a mock cache
    engine.cache = None

    # Explicitly set _query_cache to None to avoid MagicMock auto-attribute creation
    # This prevents the execute_query endpoint from trying to access cache metadata
    engine._query_cache = None

    # Mock async methods (with schema_name support for multi-tenant)
    async def get_schema(schema_name: str | None = None) -> DatabaseSchema:
        return sample_schema

    async def get_table(table_name: str, schema_name: str | None = None) -> TableSchema:
        table = sample_schema.get_table(table_name)
        if table is None:
            raise TableNotFoundError(table_name)
        return table

    async def execute_query(
        query: QueryDefinition,
        schema_name: str | None = None,
        use_cache: bool = True,
    ) -> QueryResult:
        return QueryResult(
            columns=["id", "email"],
            column_types=["integer", "text"],
            rows=[[1, "test@example.com"]],
            row_count=1,
            execution_time_ms=5.0,
        )

    async def preview_query(
        query: QueryDefinition,
        limit: int = 100,
        schema_name: str | None = None,
    ) -> QueryResult:
        return QueryResult(
            columns=["id", "email"],
            column_types=["integer", "text"],
            rows=[[1, "test@example.com"]],
            row_count=1,
            execution_time_ms=2.0,
        )

    async def check_connection() -> bool:
        return True

    async def get_enhanced_schema(schema_name: str | None = None) -> Any:
        # Return a mock enhanced schema
        return MagicMock(get_table=lambda name: sample_schema.get_table(name))

    async def validate_query_async(
        query: QueryDefinition, schema_name: str | None = None
    ) -> list[str]:
        return []

    async def validate_query_detailed_async(
        query: QueryDefinition, schema_name: str | None = None
    ) -> Any:
        from prismiq.query import ValidationResult

        return ValidationResult(valid=True, errors=[])

    async def generate_sql_async(query: QueryDefinition, schema_name: str | None = None) -> str:
        return 'SELECT "id", "email" FROM "users"'

    engine.get_schema = get_schema
    engine.get_table = get_table
    engine.get_enhanced_schema = get_enhanced_schema
    engine.execute_query = execute_query
    engine.preview_query = preview_query
    engine.check_connection = check_connection
    engine.validate_query = MagicMock(return_value=[])
    engine.validate_query_async = validate_query_async
    engine.validate_query_detailed = MagicMock(return_value=MagicMock(valid=True, errors=[]))
    engine.validate_query_detailed_async = validate_query_detailed_async
    engine.generate_sql = MagicMock(return_value='SELECT "id", "email" FROM "users"')
    engine.generate_sql_async = generate_sql_async

    return engine


@pytest.fixture
def client(mock_engine: MagicMock) -> TestClient:
    """Create a FastAPI test client with the analytics router."""
    app = FastAPI()
    router = create_router(mock_engine)
    app.include_router(router, prefix="/api/analytics")
    # Include default headers for multi-tenant auth
    return TestClient(app, headers={"X-Tenant-ID": "test-tenant"})


# ============================================================================
# Health Check Model Tests
# ============================================================================


class TestHealthCheckModels:
    """Tests for health check model classes."""

    def test_health_check_model(self) -> None:
        """HealthCheck model has expected fields."""
        check = HealthCheck(status="healthy", message=None, latency_ms=5.0)

        assert check.status == "healthy"
        assert check.message is None
        assert check.latency_ms == 5.0

    def test_health_check_with_error(self) -> None:
        """HealthCheck can include error message."""
        check = HealthCheck(status="unhealthy", message="Connection failed")

        assert check.status == "unhealthy"
        assert check.message == "Connection failed"
        assert check.latency_ms is None

    def test_health_status_model(self) -> None:
        """HealthStatus model has expected fields."""
        status = HealthStatus(
            status="healthy",
            version="1.0.0",
            uptime_seconds=100.5,
            checks={
                "database": HealthCheck(status="healthy", latency_ms=5.0),
            },
        )

        assert status.status == "healthy"
        assert status.version == "1.0.0"
        assert status.uptime_seconds == 100.5
        assert "database" in status.checks

    def test_liveness_response(self) -> None:
        """LivenessResponse has status ok by default."""
        response = LivenessResponse()
        assert response.status == "ok"

    def test_readiness_response(self) -> None:
        """ReadinessResponse has status ok by default."""
        response = ReadinessResponse()
        assert response.status == "ok"


# ============================================================================
# GET /health Tests
# ============================================================================


class TestHealthEndpoint:
    """Tests for GET /health endpoint."""

    def test_health_returns_healthy_status(self, client: TestClient) -> None:
        """Health check returns healthy when database is available."""
        response = client.get("/api/analytics/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == __version__
        assert "uptime_seconds" in data
        assert "checks" in data
        assert data["checks"]["database"]["status"] == "healthy"

    def test_health_returns_version(self, client: TestClient) -> None:
        """Health check returns correct version."""
        response = client.get("/api/analytics/health")

        data = response.json()
        assert data["version"] == __version__

    def test_health_returns_uptime(self, client: TestClient) -> None:
        """Health check returns uptime."""
        response = client.get("/api/analytics/health")

        data = response.json()
        assert data["uptime_seconds"] >= 0

    def test_health_includes_database_check(self, client: TestClient) -> None:
        """Health check includes database status."""
        response = client.get("/api/analytics/health")

        data = response.json()
        assert "database" in data["checks"]
        db_check = data["checks"]["database"]
        assert db_check["status"] == "healthy"
        assert "latency_ms" in db_check

    def test_health_unhealthy_when_db_fails(
        self, sample_schema: DatabaseSchema, mock_engine: MagicMock
    ) -> None:
        """Health check returns unhealthy when database fails."""

        async def failing_check_connection() -> bool:
            raise ConnectionError("Database unavailable")

        mock_engine.check_connection = failing_check_connection

        app = FastAPI()
        router = create_router(mock_engine)
        app.include_router(router, prefix="/api/analytics")
        client = TestClient(app)

        response = client.get("/api/analytics/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unhealthy"
        assert data["checks"]["database"]["status"] == "unhealthy"
        assert "Database unavailable" in data["checks"]["database"]["message"]


# ============================================================================
# GET /health/live Tests
# ============================================================================


class TestLivenessEndpoint:
    """Tests for GET /health/live endpoint."""

    def test_liveness_returns_ok(self, client: TestClient) -> None:
        """Liveness probe returns ok."""
        response = client.get("/api/analytics/health/live")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


# ============================================================================
# GET /health/ready Tests
# ============================================================================


class TestReadinessEndpoint:
    """Tests for GET /health/ready endpoint."""

    def test_readiness_returns_ok_when_db_available(self, client: TestClient) -> None:
        """Readiness probe returns ok when database is available."""
        response = client.get("/api/analytics/health/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_readiness_returns_503_when_db_unavailable(
        self, sample_schema: DatabaseSchema, mock_engine: MagicMock
    ) -> None:
        """Readiness probe returns 503 when database is unavailable."""

        async def failing_check_connection() -> bool:
            raise ConnectionError("Database unavailable")

        mock_engine.check_connection = failing_check_connection

        app = FastAPI()
        router = create_router(mock_engine)
        app.include_router(router, prefix="/api/analytics")
        client = TestClient(app)

        response = client.get("/api/analytics/health/ready")

        assert response.status_code == 503
        data = response.json()
        assert "Service not ready" in data["detail"]


# ============================================================================
# GET /schema Tests
# ============================================================================


class TestGetSchema:
    """Tests for GET /schema endpoint."""

    def test_get_schema_returns_database_schema(self, client: TestClient) -> None:
        """Test that GET /schema returns the database schema."""
        response = client.get("/api/analytics/schema")

        assert response.status_code == 200
        data = response.json()
        assert "tables" in data
        assert "relationships" in data
        assert len(data["tables"]) == 2

    def test_get_schema_includes_table_names(self, client: TestClient) -> None:
        """Test that schema includes expected table names."""
        response = client.get("/api/analytics/schema")

        data = response.json()
        table_names = [t["name"] for t in data["tables"]]
        assert "users" in table_names
        assert "orders" in table_names


# ============================================================================
# GET /tables Tests
# ============================================================================


class TestGetTables:
    """Tests for GET /tables endpoint."""

    def test_get_tables_returns_list(self, client: TestClient) -> None:
        """Test that GET /tables returns a list of table names."""
        response = client.get("/api/analytics/tables")

        assert response.status_code == 200
        data = response.json()
        assert "tables" in data
        assert isinstance(data["tables"], list)

    def test_get_tables_includes_expected_tables(self, client: TestClient) -> None:
        """Test that tables list includes expected names."""
        response = client.get("/api/analytics/tables")

        data = response.json()
        assert "users" in data["tables"]
        assert "orders" in data["tables"]


# ============================================================================
# GET /tables/{table_name} Tests
# ============================================================================


class TestGetTable:
    """Tests for GET /tables/{table_name} endpoint."""

    def test_get_table_returns_table_schema(self, client: TestClient) -> None:
        """Test that GET /tables/{name} returns the table schema."""
        response = client.get("/api/analytics/tables/users")

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "users"
        assert "columns" in data

    def test_get_table_includes_columns(self, client: TestClient) -> None:
        """Test that table schema includes columns."""
        response = client.get("/api/analytics/tables/users")

        data = response.json()
        column_names = [c["name"] for c in data["columns"]]
        assert "id" in column_names
        assert "email" in column_names

    def test_get_table_not_found(self, client: TestClient) -> None:
        """Test that GET /tables/{name} returns 404 for unknown table."""
        response = client.get("/api/analytics/tables/nonexistent")

        assert response.status_code == 404


# ============================================================================
# POST /query/validate Tests
# ============================================================================


class TestValidateQuery:
    """Tests for POST /query/validate endpoint."""

    def test_validate_valid_query(self, client: TestClient) -> None:
        """Test validation of a valid query."""
        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/validate", json=query)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["errors"] == []

    def test_validate_invalid_query(self, client: TestClient, mock_engine: MagicMock) -> None:
        """Test validation of an invalid query."""

        # Override the async validation method to return errors
        async def validate_with_errors(
            query: QueryDefinition, schema_name: str | None = None
        ) -> list[str]:
            return ["Column 'nonexistent' not found"]

        mock_engine.validate_query_async = validate_with_errors

        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "nonexistent"}],
        }

        response = client.post("/api/analytics/query/validate", json=query)

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert len(data["errors"]) == 1


# ============================================================================
# POST /query/execute Tests
# ============================================================================


class TestExecuteQuery:
    """Tests for POST /query/execute endpoint."""

    def test_execute_query_returns_result(self, client: TestClient) -> None:
        """Test that execute returns query result."""
        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/execute", json={"query": query})

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "rows" in data
        assert "row_count" in data
        assert "execution_time_ms" in data
        # New cache metadata fields
        assert "cached_at" in data
        assert "is_from_cache" in data

    def test_execute_query_with_bypass_cache(self, client: TestClient) -> None:
        """Test that bypass_cache parameter works."""
        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post(
            "/api/analytics/query/execute",
            json={"query": query, "bypass_cache": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "is_from_cache" in data
        # When bypass_cache is True, is_from_cache should be False
        assert data["is_from_cache"] is False

    def test_execute_query_validation_error(
        self, client: TestClient, mock_engine: MagicMock
    ) -> None:
        """Test that validation errors return 400."""

        async def raise_validation_error(
            query: Any, schema_name: str | None = None, use_cache: bool = True
        ) -> None:
            raise QueryValidationError("Invalid query", errors=["Table not found"])

        mock_engine.execute_query = raise_validation_error

        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/execute", json={"query": query})

        assert response.status_code == 400


# ============================================================================
# POST /query/preview Tests
# ============================================================================


class TestPreviewQuery:
    """Tests for POST /query/preview endpoint."""

    def test_preview_query_returns_result(self, client: TestClient) -> None:
        """Test that preview returns query result."""
        request = {
            "query": {
                "tables": [{"id": "t1", "name": "users"}],
                "columns": [{"table_id": "t1", "column": "email"}],
            },
            "limit": 10,
        }

        response = client.post("/api/analytics/query/preview", json=request)

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "rows" in data

    def test_preview_query_default_limit(self, client: TestClient) -> None:
        """Test that preview uses default limit."""
        request = {
            "query": {
                "tables": [{"id": "t1", "name": "users"}],
                "columns": [{"table_id": "t1", "column": "email"}],
            },
        }

        response = client.post("/api/analytics/query/preview", json=request)

        assert response.status_code == 200

    def test_preview_query_validation_error(
        self, client: TestClient, mock_engine: MagicMock
    ) -> None:
        """Test that validation errors return 400."""

        async def raise_validation_error(
            query: Any, limit: int = 100, schema_name: str | None = None
        ) -> None:
            raise QueryValidationError("Invalid query", errors=["Column not found"])

        mock_engine.preview_query = raise_validation_error

        request = {
            "query": {
                "tables": [{"id": "t1", "name": "users"}],
                "columns": [{"table_id": "t1", "column": "email"}],
            },
        }

        response = client.post("/api/analytics/query/preview", json=request)

        assert response.status_code == 400


# ============================================================================
# Error Response Tests
# ============================================================================


class TestErrorResponses:
    """Tests for error response formats."""

    def test_404_includes_detail(self, client: TestClient) -> None:
        """Test that 404 responses include detail."""
        response = client.get("/api/analytics/tables/nonexistent")

        assert response.status_code == 404
        data = response.json()
        assert "detail" in data

    def test_validation_error_includes_errors_list(
        self, client: TestClient, mock_engine: MagicMock
    ) -> None:
        """Test that validation errors include errors list."""

        async def raise_validation_error(
            query: Any, schema_name: str | None = None, use_cache: bool = True
        ) -> None:
            raise QueryValidationError("Validation failed", errors=["Error 1", "Error 2"])

        mock_engine.execute_query = raise_validation_error

        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/execute", json={"query": query})

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
