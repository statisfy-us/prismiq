"""Tests for schema introspection."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from prismiq.cache import InMemoryCache
from prismiq.schema import SchemaIntrospector
from prismiq.types import TableNotFoundError

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_pool() -> MagicMock:
    """Create a mock asyncpg connection pool."""
    pool = MagicMock()

    # Mock the async context manager for acquire()
    mock_connection = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_connection
    mock_context.__aexit__.return_value = None
    pool.acquire.return_value = mock_context

    return pool


@pytest.fixture
def mock_connection(mock_pool: MagicMock) -> AsyncMock:
    """Get the mock connection from the pool."""
    return mock_pool.acquire.return_value.__aenter__.return_value


def make_record(data: dict[str, Any]) -> MagicMock:
    """Create a mock asyncpg Record."""
    record = MagicMock()
    record.__getitem__ = lambda self, key: data[key]
    record.keys.return_value = data.keys()
    return record


# ============================================================================
# Tests
# ============================================================================


class TestSchemaIntrospectorInit:
    """Tests for SchemaIntrospector initialization."""

    def test_init_with_defaults(self, mock_pool: MagicMock) -> None:
        """Test initialization with default values."""
        introspector = SchemaIntrospector(mock_pool)
        assert introspector._pool is mock_pool
        assert introspector._exposed_tables is None
        assert introspector._schema_name == "public"
        assert introspector._cache is None
        assert introspector._cache_ttl == 3600

    def test_init_with_exposed_tables(self, mock_pool: MagicMock) -> None:
        """Test initialization with exposed_tables."""
        introspector = SchemaIntrospector(mock_pool, exposed_tables=["users", "orders"])
        assert introspector._exposed_tables == ["users", "orders"]

    def test_init_with_custom_schema(self, mock_pool: MagicMock) -> None:
        """Test initialization with custom schema name."""
        introspector = SchemaIntrospector(mock_pool, schema_name="analytics")
        assert introspector._schema_name == "analytics"

    def test_init_with_cache(self, mock_pool: MagicMock) -> None:
        """Test initialization with cache."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache, cache_ttl=1800)
        assert introspector._cache is cache
        assert introspector._cache_ttl == 1800


class TestGetSchema:
    """Tests for get_schema method."""

    async def test_get_schema_returns_database_schema(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_schema returns a DatabaseSchema."""
        # Mock table names query
        mock_connection.fetch.side_effect = [
            # Tables query
            [make_record({"table_name": "users"})],
            # Columns query for users
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
                make_record(
                    {
                        "column_name": "email",
                        "data_type": "text",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            # Primary keys query for users
            [make_record({"column_name": "id"})],
            # Relationships query
            [],
        ]

        introspector = SchemaIntrospector(mock_pool)
        schema = await introspector.get_schema()

        assert len(schema.tables) == 1
        assert schema.tables[0].name == "users"
        assert len(schema.tables[0].columns) == 2
        assert schema.tables[0].columns[0].is_primary_key is True

    async def test_get_schema_filters_exposed_tables(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_schema respects exposed_tables filter."""
        # Mock returns all tables, but we only expose "users"
        mock_connection.fetch.side_effect = [
            # Tables query returns multiple tables
            [
                make_record({"table_name": "orders"}),
                make_record({"table_name": "users"}),
            ],
            # Columns for users only (orders filtered out)
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            # Primary keys for users
            [make_record({"column_name": "id"})],
            # Relationships
            [],
        ]

        introspector = SchemaIntrospector(mock_pool, exposed_tables=["users"])
        schema = await introspector.get_schema()

        # Only users table should be returned
        assert len(schema.tables) == 1
        assert schema.tables[0].name == "users"


class TestGetTable:
    """Tests for get_table method."""

    async def test_get_table_returns_table_schema(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_table returns a TableSchema."""
        mock_connection.fetch.side_effect = [
            # Tables query
            [make_record({"table_name": "users"})],
            # Columns query
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            # Primary keys query
            [make_record({"column_name": "id"})],
        ]

        introspector = SchemaIntrospector(mock_pool)
        table = await introspector.get_table("users")

        assert table.name == "users"
        assert len(table.columns) == 1

    async def test_get_table_raises_for_unexposed_table(self, mock_pool: MagicMock) -> None:
        """Test that get_table raises TableNotFoundError for unexposed tables."""
        introspector = SchemaIntrospector(mock_pool, exposed_tables=["users"])

        with pytest.raises(TableNotFoundError) as exc_info:
            await introspector.get_table("orders")

        assert exc_info.value.table_name == "orders"

    async def test_get_table_raises_for_nonexistent_table(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_table raises TableNotFoundError for nonexistent tables."""
        # Tables query returns empty
        mock_connection.fetch.return_value = []

        introspector = SchemaIntrospector(mock_pool)

        with pytest.raises(TableNotFoundError) as exc_info:
            await introspector.get_table("nonexistent")

        assert exc_info.value.table_name == "nonexistent"


class TestDetectRelationships:
    """Tests for detect_relationships method."""

    async def test_detect_relationships_returns_list(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that detect_relationships returns a list of Relationships."""
        mock_connection.fetch.return_value = [
            make_record(
                {
                    "from_table": "orders",
                    "from_column": "user_id",
                    "to_table": "users",
                    "to_column": "id",
                }
            ),
        ]

        introspector = SchemaIntrospector(mock_pool)
        relationships = await introspector.detect_relationships()

        assert len(relationships) == 1
        assert relationships[0].from_table == "orders"
        assert relationships[0].from_column == "user_id"
        assert relationships[0].to_table == "users"
        assert relationships[0].to_column == "id"

    async def test_detect_relationships_filters_by_exposed_tables(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that relationships are filtered by exposed_tables."""
        mock_connection.fetch.return_value = [
            make_record(
                {
                    "from_table": "orders",
                    "from_column": "user_id",
                    "to_table": "users",
                    "to_column": "id",
                }
            ),
            make_record(
                {
                    "from_table": "items",
                    "from_column": "order_id",
                    "to_table": "orders",
                    "to_column": "id",
                }
            ),
        ]

        # Only expose users and orders (not items)
        introspector = SchemaIntrospector(mock_pool, exposed_tables=["users", "orders"])
        relationships = await introspector.detect_relationships()

        # Only orders->users relationship should be included
        # items->orders is excluded because items is not exposed
        assert len(relationships) == 1
        assert relationships[0].from_table == "orders"

    async def test_detect_relationships_empty_when_no_fks(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test empty list when no foreign keys exist."""
        mock_connection.fetch.return_value = []

        introspector = SchemaIntrospector(mock_pool)
        relationships = await introspector.detect_relationships()

        assert relationships == []


class TestPrimaryKeyDetection:
    """Tests for primary key detection."""

    async def test_marks_primary_key_columns(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that primary key columns are marked correctly."""
        mock_connection.fetch.side_effect = [
            # Tables query
            [make_record({"table_name": "users"})],
            # Columns query
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
                make_record(
                    {
                        "column_name": "email",
                        "data_type": "text",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            # Primary keys query - id is primary key
            [make_record({"column_name": "id"})],
        ]

        introspector = SchemaIntrospector(mock_pool)
        table = await introspector.get_table("users")

        # Find columns
        id_col = next(c for c in table.columns if c.name == "id")
        email_col = next(c for c in table.columns if c.name == "email")

        assert id_col.is_primary_key is True
        assert email_col.is_primary_key is False

    async def test_handles_composite_primary_keys(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test handling of composite primary keys."""
        mock_connection.fetch.side_effect = [
            # Tables query
            [make_record({"table_name": "order_items"})],
            # Columns query
            [
                make_record(
                    {
                        "column_name": "order_id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
                make_record(
                    {
                        "column_name": "product_id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
                make_record(
                    {
                        "column_name": "quantity",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            # Composite primary key
            [
                make_record({"column_name": "order_id"}),
                make_record({"column_name": "product_id"}),
            ],
        ]

        introspector = SchemaIntrospector(mock_pool)
        table = await introspector.get_table("order_items")

        order_id_col = next(c for c in table.columns if c.name == "order_id")
        product_id_col = next(c for c in table.columns if c.name == "product_id")
        quantity_col = next(c for c in table.columns if c.name == "quantity")

        assert order_id_col.is_primary_key is True
        assert product_id_col.is_primary_key is True
        assert quantity_col.is_primary_key is False


# ============================================================================
# Schema Caching Tests
# ============================================================================


class TestSchemaCaching:
    """Tests for schema caching functionality."""

    async def test_get_schema_uses_cache(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_schema uses cache when available."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache)

        # First call: mock database response
        mock_connection.fetch.side_effect = [
            [make_record({"table_name": "users"})],
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            [make_record({"column_name": "id"})],
            [],
        ]

        schema1 = await introspector.get_schema()
        assert len(schema1.tables) == 1

        # Reset mock to track second call
        mock_connection.fetch.reset_mock()
        mock_connection.fetch.side_effect = None

        # Second call should use cache (no DB calls)
        schema2 = await introspector.get_schema()

        assert schema2.tables[0].name == schema1.tables[0].name
        mock_connection.fetch.assert_not_called()

    async def test_get_schema_force_refresh_bypasses_cache(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that force_refresh bypasses cache."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache)

        # Setup database responses for both calls
        def setup_mock() -> None:
            mock_connection.fetch.side_effect = [
                [make_record({"table_name": "users"})],
                [
                    make_record(
                        {
                            "column_name": "id",
                            "data_type": "integer",
                            "is_nullable": "NO",
                            "column_default": None,
                        }
                    ),
                ],
                [make_record({"column_name": "id"})],
                [],
            ]

        # First call populates cache
        setup_mock()
        await introspector.get_schema()

        # Second call with force_refresh
        setup_mock()
        schema = await introspector.get_schema(force_refresh=True)

        # Should have made database calls
        assert schema.tables[0].name == "users"
        assert mock_connection.fetch.call_count > 0

    async def test_get_table_uses_cache(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_table uses cache when available."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache)

        # First call: mock database response
        mock_connection.fetch.side_effect = [
            [make_record({"table_name": "users"})],
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            [make_record({"column_name": "id"})],
        ]

        table1 = await introspector.get_table("users")
        assert table1.name == "users"

        # Reset mock to track second call
        mock_connection.fetch.reset_mock()
        mock_connection.fetch.side_effect = None

        # Second call should use cache
        table2 = await introspector.get_table("users")

        assert table2.name == table1.name
        mock_connection.fetch.assert_not_called()

    async def test_get_table_force_refresh_bypasses_cache(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that get_table force_refresh bypasses cache."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache)

        def setup_mock() -> None:
            mock_connection.fetch.side_effect = [
                [make_record({"table_name": "users"})],
                [
                    make_record(
                        {
                            "column_name": "id",
                            "data_type": "integer",
                            "is_nullable": "NO",
                            "column_default": None,
                        }
                    ),
                ],
                [make_record({"column_name": "id"})],
            ]

        # First call populates cache
        setup_mock()
        await introspector.get_table("users")

        # Second call with force_refresh
        setup_mock()
        table = await introspector.get_table("users", force_refresh=True)

        assert table.name == "users"
        assert mock_connection.fetch.call_count > 0

    async def test_invalidate_cache_clears_schema(
        self, mock_pool: MagicMock, mock_connection: AsyncMock
    ) -> None:
        """Test that invalidate_cache clears all schema entries."""
        cache = InMemoryCache()
        introspector = SchemaIntrospector(mock_pool, cache=cache)

        # Populate cache
        mock_connection.fetch.side_effect = [
            [make_record({"table_name": "users"})],
            [
                make_record(
                    {
                        "column_name": "id",
                        "data_type": "integer",
                        "is_nullable": "NO",
                        "column_default": None,
                    }
                ),
            ],
            [make_record({"column_name": "id"})],
            [],
        ]
        await introspector.get_schema()

        # Invalidate cache
        count = await introspector.invalidate_cache()

        assert count >= 1

        # Verify cache is empty for schema
        cached = await cache.get("schema:full")
        assert cached is None

    async def test_invalidate_cache_without_cache_returns_zero(self, mock_pool: MagicMock) -> None:
        """Test that invalidate_cache returns 0 when no cache is configured."""
        introspector = SchemaIntrospector(mock_pool)
        count = await introspector.invalidate_cache()
        assert count == 0
