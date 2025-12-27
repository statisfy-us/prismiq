"""Tests for PrismiqEngine."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from prismiq.engine import PrismiqEngine
from prismiq.types import (
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    QueryDefinition,
    QueryResult,
    QueryTable,
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
        ],
        relationships=[],
    )


@pytest.fixture
def mock_pool() -> MagicMock:
    """Create a mock asyncpg connection pool."""
    pool = MagicMock()
    pool.close = AsyncMock()

    mock_connection = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_connection
    mock_context.__aexit__.return_value = None
    pool.acquire.return_value = mock_context

    return pool


# ============================================================================
# Initialization Tests
# ============================================================================


class TestEngineInit:
    """Tests for PrismiqEngine initialization."""

    def test_init_with_required_args(self) -> None:
        """Test initialization with required arguments only."""
        engine = PrismiqEngine(database_url="postgresql://localhost/test")

        assert engine._database_url == "postgresql://localhost/test"
        assert engine._exposed_tables is None
        assert engine._query_timeout == 30.0
        assert engine._max_rows == 10000
        assert engine._schema_name == "public"

    def test_init_with_all_args(self) -> None:
        """Test initialization with all arguments."""
        engine = PrismiqEngine(
            database_url="postgresql://localhost/test",
            exposed_tables=["users", "orders"],
            query_timeout=60.0,
            max_rows=5000,
            schema_name="analytics",
        )

        assert engine._exposed_tables == ["users", "orders"]
        assert engine._query_timeout == 60.0
        assert engine._max_rows == 5000
        assert engine._schema_name == "analytics"

    def test_init_components_are_none(self) -> None:
        """Test that components are None before startup."""
        engine = PrismiqEngine(database_url="postgresql://localhost/test")

        assert engine._pool is None
        assert engine._introspector is None
        assert engine._executor is None
        assert engine._builder is None
        assert engine._schema is None


# ============================================================================
# Lifecycle Tests
# ============================================================================


class TestLifecycle:
    """Tests for startup/shutdown lifecycle."""

    async def test_startup_creates_pool(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that startup creates connection pool."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            # Mock SchemaIntrospector
            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                mock_asyncpg.create_pool.assert_called_once()
                assert engine._pool is not None

    async def test_startup_introspects_schema(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that startup introspects schema."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                mock_introspector.get_schema.assert_called_once()
                assert engine._schema is not None

    async def test_startup_creates_builder_and_executor(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that startup creates builder and executor."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                assert engine._builder is not None
                assert engine._executor is not None

    async def test_shutdown_closes_pool(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that shutdown closes the pool."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()
                await engine.shutdown()

                mock_pool.close.assert_called_once()

    async def test_shutdown_clears_components(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that shutdown clears all components."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()
                await engine.shutdown()

                assert engine._pool is None
                assert engine._introspector is None
                assert engine._executor is None
                assert engine._builder is None
                assert engine._schema is None


# ============================================================================
# Ensure Started Tests
# ============================================================================


class TestEnsureStarted:
    """Tests for ensure_started checks."""

    def test_get_schema_before_startup_raises(self) -> None:
        """Test that get_schema raises RuntimeError before startup."""
        engine = PrismiqEngine(database_url="postgresql://localhost/test")

        with pytest.raises(RuntimeError) as exc_info:
            # Need to run the coroutine to trigger the check
            import asyncio

            asyncio.get_event_loop().run_until_complete(engine.get_schema())

        assert "not started" in str(exc_info.value).lower()

    def test_validate_query_before_startup_raises(self) -> None:
        """Test that validate_query raises RuntimeError before startup."""
        engine = PrismiqEngine(database_url="postgresql://localhost/test")

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        with pytest.raises(RuntimeError) as exc_info:
            engine.validate_query(query)

        assert "not started" in str(exc_info.value).lower()


# ============================================================================
# Get Schema Tests
# ============================================================================


class TestGetSchema:
    """Tests for get_schema method."""

    async def test_get_schema_returns_schema(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that get_schema returns the database schema."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                schema = await engine.get_schema()

                assert schema == sample_schema
                assert len(schema.tables) == 1
                assert schema.tables[0].name == "users"


# ============================================================================
# Get Table Tests
# ============================================================================


class TestGetTable:
    """Tests for get_table method."""

    async def test_get_table_returns_table(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that get_table returns the table schema."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector.get_table = AsyncMock(return_value=sample_schema.tables[0])
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                table = await engine.get_table("users")

                assert table.name == "users"


# ============================================================================
# Validate Query Tests
# ============================================================================


class TestValidateQuery:
    """Tests for validate_query method."""

    async def test_validate_query_returns_errors(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that validate_query returns validation errors."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                query = QueryDefinition(
                    tables=[QueryTable(id="t1", name="users")],
                    columns=[ColumnSelection(table_id="t1", column="nonexistent")],
                )

                errors = engine.validate_query(query)

                assert len(errors) == 1
                assert "nonexistent" in errors[0]

    async def test_validate_valid_query_returns_empty(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that validate_query returns empty list for valid query."""
        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                query = QueryDefinition(
                    tables=[QueryTable(id="t1", name="users")],
                    columns=[ColumnSelection(table_id="t1", column="email")],
                )

                errors = engine.validate_query(query)

                assert errors == []


# ============================================================================
# Execute Query Tests
# ============================================================================


class TestExecuteQuery:
    """Tests for execute_query method."""

    async def test_execute_query_returns_result(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that execute_query returns QueryResult."""
        mock_connection = mock_pool.acquire.return_value.__aenter__.return_value

        # Mock the fetch to return results
        class MockRecord(dict[str, Any]):
            def keys(self) -> list[str]:
                return list(super().keys())

            def values(self) -> list[Any]:
                return list(super().values())

        mock_connection.fetch.return_value = [MockRecord({"email": "test@example.com"})]

        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                query = QueryDefinition(
                    tables=[QueryTable(id="t1", name="users")],
                    columns=[ColumnSelection(table_id="t1", column="email")],
                )

                result = await engine.execute_query(query)

                assert isinstance(result, QueryResult)
                assert result.row_count >= 0


# ============================================================================
# Preview Query Tests
# ============================================================================


class TestPreviewQuery:
    """Tests for preview_query method."""

    async def test_preview_query_returns_result(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that preview_query returns QueryResult."""
        mock_connection = mock_pool.acquire.return_value.__aenter__.return_value

        class MockRecord(dict[str, Any]):
            def keys(self) -> list[str]:
                return list(super().keys())

            def values(self) -> list[Any]:
                return list(super().values())

        mock_connection.fetch.return_value = [MockRecord({"email": "test@example.com"})]

        with patch("prismiq.engine.asyncpg") as mock_asyncpg:
            mock_asyncpg.create_pool = AsyncMock(return_value=mock_pool)

            with patch("prismiq.engine.SchemaIntrospector") as mock_introspector_class:
                mock_introspector = MagicMock()
                mock_introspector.get_schema = AsyncMock(return_value=sample_schema)
                mock_introspector_class.return_value = mock_introspector

                engine = PrismiqEngine(database_url="postgresql://localhost/test")
                await engine.startup()

                query = QueryDefinition(
                    tables=[QueryTable(id="t1", name="users")],
                    columns=[ColumnSelection(table_id="t1", column="email")],
                )

                result = await engine.preview_query(query, limit=10)

                assert isinstance(result, QueryResult)
