"""Tests for FastAPI routes."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from prismiq.api import create_router
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

    # Mock async methods
    async def get_schema() -> DatabaseSchema:
        return sample_schema

    async def get_table(table_name: str) -> TableSchema:
        table = sample_schema.get_table(table_name)
        if table is None:
            raise TableNotFoundError(table_name)
        return table

    async def execute_query(query: QueryDefinition) -> QueryResult:
        return QueryResult(
            columns=["id", "email"],
            column_types=["integer", "text"],
            rows=[[1, "test@example.com"]],
            row_count=1,
            execution_time_ms=5.0,
        )

    async def preview_query(query: QueryDefinition, limit: int = 100) -> QueryResult:
        return QueryResult(
            columns=["id", "email"],
            column_types=["integer", "text"],
            rows=[[1, "test@example.com"]],
            row_count=1,
            execution_time_ms=2.0,
        )

    engine.get_schema = get_schema
    engine.get_table = get_table
    engine.execute_query = execute_query
    engine.preview_query = preview_query
    engine.validate_query = MagicMock(return_value=[])

    return engine


@pytest.fixture
def client(mock_engine: MagicMock) -> TestClient:
    """Create a FastAPI test client with the analytics router."""
    app = FastAPI()
    router = create_router(mock_engine)
    app.include_router(router, prefix="/api/analytics")
    return TestClient(app)


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
        mock_engine.validate_query.return_value = ["Column 'nonexistent' not found"]

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

        response = client.post("/api/analytics/query/execute", json=query)

        assert response.status_code == 200
        data = response.json()
        assert "columns" in data
        assert "rows" in data
        assert "row_count" in data
        assert "execution_time_ms" in data

    def test_execute_query_validation_error(
        self, client: TestClient, mock_engine: MagicMock
    ) -> None:
        """Test that validation errors return 400."""

        async def raise_validation_error(query: Any) -> None:
            raise QueryValidationError("Invalid query", errors=["Table not found"])

        mock_engine.execute_query = raise_validation_error

        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/execute", json=query)

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

        async def raise_validation_error(query: Any, limit: int = 100) -> None:
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

        async def raise_validation_error(query: Any) -> None:
            raise QueryValidationError("Validation failed", errors=["Error 1", "Error 2"])

        mock_engine.execute_query = raise_validation_error

        query = {
            "tables": [{"id": "t1", "name": "users"}],
            "columns": [{"table_id": "t1", "column": "email"}],
        }

        response = client.post("/api/analytics/query/execute", json=query)

        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
