"""Tests for the caching module."""

from __future__ import annotations

import asyncio
import time

import pytest

from prismiq.cache import (
    CacheBackend,
    CacheConfig,
    InMemoryCache,
    QueryCache,
    SchemaCache,
)
from prismiq.types import (
    ColumnSelection,
    QueryDefinition,
    QueryResult,
    QueryTable,
)

# ============================================================================
# InMemoryCache Tests
# ============================================================================


class TestInMemoryCacheBasicOperations:
    """Tests for basic cache operations."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_get_nonexistent_key_returns_none(self, cache: InMemoryCache) -> None:
        """Getting a non-existent key returns None."""
        result = await cache.get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_and_get_string(self, cache: InMemoryCache) -> None:
        """Can set and get a string value."""
        await cache.set("key", "value")
        result = await cache.get("key")
        assert result == "value"

    @pytest.mark.asyncio
    async def test_set_and_get_dict(self, cache: InMemoryCache) -> None:
        """Can set and get a dictionary."""
        data = {"name": "test", "value": 42}
        await cache.set("key", data)
        result = await cache.get("key")
        assert result == data

    @pytest.mark.asyncio
    async def test_set_and_get_list(self, cache: InMemoryCache) -> None:
        """Can set and get a list."""
        data = [1, 2, 3, "four"]
        await cache.set("key", data)
        result = await cache.get("key")
        assert result == data

    @pytest.mark.asyncio
    async def test_set_overwrites_existing(self, cache: InMemoryCache) -> None:
        """Setting a key overwrites existing value."""
        await cache.set("key", "original")
        await cache.set("key", "updated")
        result = await cache.get("key")
        assert result == "updated"


class TestInMemoryCacheDelete:
    """Tests for cache deletion."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_delete_existing_key_returns_true(self, cache: InMemoryCache) -> None:
        """Deleting an existing key returns True."""
        await cache.set("key", "value")
        result = await cache.delete("key")
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_nonexistent_key_returns_false(self, cache: InMemoryCache) -> None:
        """Deleting a non-existent key returns False."""
        result = await cache.delete("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_removes_key(self, cache: InMemoryCache) -> None:
        """Deleted key is no longer retrievable."""
        await cache.set("key", "value")
        await cache.delete("key")
        result = await cache.get("key")
        assert result is None


class TestInMemoryCacheExists:
    """Tests for checking key existence."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_exists_for_existing_key(self, cache: InMemoryCache) -> None:
        """Exists returns True for existing key."""
        await cache.set("key", "value")
        result = await cache.exists("key")
        assert result is True

    @pytest.mark.asyncio
    async def test_exists_for_nonexistent_key(self, cache: InMemoryCache) -> None:
        """Exists returns False for non-existent key."""
        result = await cache.exists("nonexistent")
        assert result is False


class TestInMemoryCacheTTL:
    """Tests for TTL expiration."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_ttl_expiration_on_get(self, cache: InMemoryCache) -> None:
        """Expired entries are removed on get."""
        # Set with very short TTL
        await cache.set("key", "value", ttl=0)
        # Wait a moment
        await asyncio.sleep(0.01)
        result = await cache.get("key")
        assert result is None

    @pytest.mark.asyncio
    async def test_ttl_expiration_on_exists(self, cache: InMemoryCache) -> None:
        """Expired entries are removed on exists."""
        await cache.set("key", "value", ttl=0)
        await asyncio.sleep(0.01)
        result = await cache.exists("key")
        assert result is False

    @pytest.mark.asyncio
    async def test_no_ttl_never_expires(self, cache: InMemoryCache) -> None:
        """Entries without TTL don't expire."""
        await cache.set("key", "value", ttl=None)
        result = await cache.get("key")
        assert result == "value"

    @pytest.mark.asyncio
    async def test_positive_ttl_not_expired(self, cache: InMemoryCache) -> None:
        """Entries with future TTL are accessible."""
        await cache.set("key", "value", ttl=60)
        result = await cache.get("key")
        assert result == "value"


class TestInMemoryCacheClear:
    """Tests for cache clearing."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_clear_all(self, cache: InMemoryCache) -> None:
        """Clear without pattern removes all entries."""
        await cache.set("key1", "value1")
        await cache.set("key2", "value2")
        await cache.set("key3", "value3")

        count = await cache.clear()

        assert count == 3
        assert await cache.get("key1") is None
        assert await cache.get("key2") is None
        assert await cache.get("key3") is None

    @pytest.mark.asyncio
    async def test_clear_with_pattern(self, cache: InMemoryCache) -> None:
        """Clear with pattern only removes matching entries."""
        await cache.set("query:abc", "value1")
        await cache.set("query:def", "value2")
        await cache.set("schema:full", "value3")

        count = await cache.clear("query:*")

        assert count == 2
        assert await cache.get("query:abc") is None
        assert await cache.get("query:def") is None
        assert await cache.get("schema:full") == "value3"

    @pytest.mark.asyncio
    async def test_clear_empty_cache(self, cache: InMemoryCache) -> None:
        """Clear on empty cache returns 0."""
        count = await cache.clear()
        assert count == 0

    @pytest.mark.asyncio
    async def test_clear_no_matches(self, cache: InMemoryCache) -> None:
        """Clear with non-matching pattern returns 0."""
        await cache.set("key", "value")
        count = await cache.clear("other:*")
        assert count == 0
        assert await cache.get("key") == "value"


class TestInMemoryCacheCleanup:
    """Tests for expired entry cleanup."""

    @pytest.fixture
    def cache(self) -> InMemoryCache:
        """Create a fresh in-memory cache."""
        return InMemoryCache()

    @pytest.mark.asyncio
    async def test_cleanup_removes_expired(self, cache: InMemoryCache) -> None:
        """Cleanup removes expired entries."""
        await cache.set("expired", "value", ttl=0)
        await cache.set("valid", "value", ttl=60)
        await asyncio.sleep(0.01)

        cache._cleanup_expired()

        # Expired should be removed
        assert "expired" not in cache._cache
        # Valid should remain
        assert "valid" in cache._cache


# ============================================================================
# QueryCache Tests
# ============================================================================


class TestQueryCacheKeyGeneration:
    """Tests for query cache key generation."""

    @pytest.fixture
    def cache(self) -> QueryCache:
        """Create a query cache with in-memory backend."""
        return QueryCache(InMemoryCache())

    def test_make_key_deterministic(self, cache: QueryCache) -> None:
        """Same query produces same key."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

        key1 = cache.make_key(query)
        key2 = cache.make_key(query)

        assert key1 == key2

    def test_make_key_different_queries(self, cache: QueryCache) -> None:
        """Different queries produce different keys."""
        query1 = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )
        query2 = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        key1 = cache.make_key(query1)
        key2 = cache.make_key(query2)

        assert key1 != key2

    def test_make_key_has_prefix(self, cache: QueryCache) -> None:
        """Generated keys have query: prefix."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

        key = cache.make_key(query)

        assert key.startswith("query:")


class TestQueryCacheCacheResult:
    """Tests for caching query results."""

    @pytest.fixture
    def cache(self) -> QueryCache:
        """Create a query cache with in-memory backend."""
        return QueryCache(InMemoryCache())

    @pytest.fixture
    def sample_query(self) -> QueryDefinition:
        """Create a sample query."""
        return QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

    @pytest.fixture
    def sample_result(self) -> QueryResult:
        """Create a sample query result."""
        return QueryResult(
            columns=["name"],
            column_types=["text"],
            rows=[["Alice"], ["Bob"]],
            row_count=2,
            execution_time_ms=10.5,
        )

    @pytest.mark.asyncio
    async def test_cache_and_retrieve(
        self, cache: QueryCache, sample_query: QueryDefinition, sample_result: QueryResult
    ) -> None:
        """Can cache and retrieve a query result."""
        await cache.cache_result(sample_query, sample_result)
        result = await cache.get_result(sample_query)

        assert result is not None
        assert result.columns == sample_result.columns
        assert result.rows == sample_result.rows
        assert result.row_count == sample_result.row_count

    @pytest.mark.asyncio
    async def test_get_uncached_returns_none(
        self, cache: QueryCache, sample_query: QueryDefinition
    ) -> None:
        """Getting uncached query returns None."""
        result = await cache.get_result(sample_query)
        assert result is None

    @pytest.mark.asyncio
    async def test_cache_with_custom_ttl(
        self, cache: QueryCache, sample_query: QueryDefinition, sample_result: QueryResult
    ) -> None:
        """Can cache with custom TTL."""
        await cache.cache_result(sample_query, sample_result, ttl=1)
        # Immediately should be available
        result = await cache.get_result(sample_query)
        assert result is not None

    @pytest.mark.asyncio
    async def test_large_result_not_cached(self, cache: QueryCache) -> None:
        """Results exceeding max size are not cached."""
        # Create cache with small max size
        config = CacheConfig(max_result_size=100)
        small_cache = QueryCache(InMemoryCache(), config)

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

        # Create large result
        large_result = QueryResult(
            columns=["name"],
            column_types=["text"],
            rows=[["A" * 200]],  # Large row
            row_count=1,
            execution_time_ms=10.0,
        )

        await small_cache.cache_result(query, large_result)
        result = await small_cache.get_result(query)

        # Should not be cached
        assert result is None


class TestQueryCacheInvalidation:
    """Tests for cache invalidation."""

    @pytest.fixture
    def cache(self) -> QueryCache:
        """Create a query cache with in-memory backend."""
        return QueryCache(InMemoryCache())

    @pytest.mark.asyncio
    async def test_invalidate_table(self, cache: QueryCache) -> None:
        """Can invalidate queries by table name."""
        # Cache queries for different tables
        query_users = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )
        query_orders = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        result = QueryResult(
            columns=["x"],
            column_types=["text"],
            rows=[],
            row_count=0,
            execution_time_ms=1.0,
        )

        await cache.cache_result(query_users, result)
        await cache.cache_result(query_orders, result)

        # Invalidate users table
        count = await cache.invalidate_table("users")

        assert count == 1
        assert await cache.get_result(query_users) is None
        assert await cache.get_result(query_orders) is not None

    @pytest.mark.asyncio
    async def test_invalidate_nonexistent_table(self, cache: QueryCache) -> None:
        """Invalidating non-existent table returns 0."""
        count = await cache.invalidate_table("nonexistent")
        assert count == 0

    @pytest.mark.asyncio
    async def test_invalidate_all(self, cache: QueryCache) -> None:
        """Can invalidate all cached queries."""
        query1 = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )
        query2 = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        result = QueryResult(
            columns=["x"],
            column_types=["text"],
            rows=[],
            row_count=0,
            execution_time_ms=1.0,
        )

        await cache.cache_result(query1, result)
        await cache.cache_result(query2, result)

        count = await cache.invalidate_all()

        assert count == 2
        assert await cache.get_result(query1) is None
        assert await cache.get_result(query2) is None


class TestQueryCacheMultiTableQueries:
    """Tests for queries involving multiple tables."""

    @pytest.fixture
    def cache(self) -> QueryCache:
        """Create a query cache with in-memory backend."""
        return QueryCache(InMemoryCache())

    @pytest.mark.asyncio
    async def test_multi_table_query_invalidation(self, cache: QueryCache) -> None:
        """Multi-table query is invalidated when any table changes."""
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[
                ColumnSelection(table_id="t1", column="name"),
                ColumnSelection(table_id="t2", column="total"),
            ],
        )

        result = QueryResult(
            columns=["name", "total"],
            column_types=["text", "numeric"],
            rows=[],
            row_count=0,
            execution_time_ms=1.0,
        )

        await cache.cache_result(query, result)

        # Invalidating either table should invalidate the query
        count = await cache.invalidate_table("users")

        assert count == 1
        assert await cache.get_result(query) is None


# ============================================================================
# QueryCache Metadata Tests
# ============================================================================


class TestQueryCacheMetadata:
    """Tests for cache metadata retrieval."""

    @pytest.fixture
    def cache(self) -> QueryCache:
        """Create a query cache with in-memory backend."""
        return QueryCache(InMemoryCache())

    @pytest.fixture
    def sample_query(self) -> QueryDefinition:
        """Create a sample query definition."""
        return QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

    @pytest.fixture
    def sample_result(self) -> QueryResult:
        """Create a sample query result."""
        return QueryResult(
            columns=["name"],
            column_types=["text"],
            rows=[["Alice"], ["Bob"]],
            row_count=2,
            execution_time_ms=10.0,
        )

    @pytest.mark.asyncio
    async def test_get_cache_metadata_returns_none_for_uncached(
        self, cache: QueryCache, sample_query: QueryDefinition
    ) -> None:
        """Metadata returns None for queries that have not been cached."""
        metadata = await cache.get_cache_metadata(sample_query)
        assert metadata is None

    @pytest.mark.asyncio
    async def test_get_cache_metadata_returns_data_after_caching(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata contains cached_at and ttl after caching."""
        await cache.cache_result(sample_query, sample_result)
        metadata = await cache.get_cache_metadata(sample_query)

        assert metadata is not None
        assert "cached_at" in metadata
        assert "ttl" in metadata
        assert isinstance(metadata["cached_at"], float)
        assert isinstance(metadata["ttl"], int)

    @pytest.mark.asyncio
    async def test_cache_result_returns_timestamp(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """cache_result returns the cached_at timestamp."""
        before = time.time()
        cached_at = await cache.cache_result(sample_query, sample_result)
        after = time.time()

        assert before <= cached_at <= after

    @pytest.mark.asyncio
    async def test_cache_result_returns_timestamp_for_oversized_result(
        self, cache: QueryCache, sample_query: QueryDefinition
    ) -> None:
        """cache_result returns timestamp even when result is too large to cache."""
        # Create a cache with a very small max_result_size
        small_cache = QueryCache(
            InMemoryCache(),
            config=CacheConfig(max_result_size=10),  # Very small limit
        )

        # Create a result that exceeds the limit
        large_result = QueryResult(
            columns=["name"],
            column_types=["text"],
            rows=[["A very long string that exceeds the limit"] * 100],
            row_count=100,
            execution_time_ms=10.0,
        )

        before = time.time()
        cached_at = await small_cache.cache_result(sample_query, large_result)
        after = time.time()

        # Should still return a timestamp
        assert before <= cached_at <= after

        # But the result should NOT be cached
        result = await small_cache.get_result(sample_query)
        assert result is None

    @pytest.mark.asyncio
    async def test_metadata_timestamp_matches_cache_result_return(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata cached_at matches the value returned by cache_result."""
        returned_timestamp = await cache.cache_result(sample_query, sample_result)
        metadata = await cache.get_cache_metadata(sample_query)

        assert metadata is not None
        assert metadata["cached_at"] == returned_timestamp

    @pytest.mark.asyncio
    async def test_metadata_contains_correct_ttl(
        self,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata ttl matches the configured query_ttl."""
        custom_ttl = 600  # 10 minutes
        cache = QueryCache(
            InMemoryCache(),
            config=CacheConfig(query_ttl=custom_ttl),
        )

        await cache.cache_result(sample_query, sample_result)
        metadata = await cache.get_cache_metadata(sample_query)

        assert metadata is not None
        assert metadata["ttl"] == custom_ttl

    @pytest.mark.asyncio
    async def test_metadata_with_custom_ttl_override(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata ttl matches custom ttl when provided to cache_result."""
        custom_ttl = 120  # 2 minutes

        await cache.cache_result(sample_query, sample_result, ttl=custom_ttl)
        metadata = await cache.get_cache_metadata(sample_query)

        assert metadata is not None
        assert metadata["ttl"] == custom_ttl

    @pytest.mark.asyncio
    async def test_metadata_cleared_after_invalidate_table(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata is removed when table is invalidated."""
        await cache.cache_result(sample_query, sample_result)

        # Verify metadata exists before invalidation
        metadata = await cache.get_cache_metadata(sample_query)
        assert metadata is not None

        # Invalidate the table
        await cache.invalidate_table("users")

        # Metadata should now be None
        metadata = await cache.get_cache_metadata(sample_query)
        assert metadata is None

    @pytest.mark.asyncio
    async def test_metadata_cleared_after_invalidate_all(
        self,
        cache: QueryCache,
        sample_query: QueryDefinition,
        sample_result: QueryResult,
    ) -> None:
        """Metadata is removed when all queries are invalidated."""
        await cache.cache_result(sample_query, sample_result)

        # Verify metadata exists before invalidation
        metadata = await cache.get_cache_metadata(sample_query)
        assert metadata is not None

        # Invalidate all
        await cache.invalidate_all()

        # Metadata should now be None
        metadata = await cache.get_cache_metadata(sample_query)
        assert metadata is None


# ============================================================================
# SchemaCache Tests
# ============================================================================


class TestSchemaCacheBasicOperations:
    """Tests for schema cache operations."""

    @pytest.fixture
    def cache(self) -> SchemaCache:
        """Create a schema cache with in-memory backend."""
        return SchemaCache(InMemoryCache())

    @pytest.mark.asyncio
    async def test_set_and_get_schema(self, cache: SchemaCache) -> None:
        """Can cache and retrieve schema."""
        schema = {
            "tables": [{"name": "users", "columns": []}],
            "relationships": [],
        }

        await cache.set_schema(schema)
        result = await cache.get_schema()

        assert result == schema

    @pytest.mark.asyncio
    async def test_get_uncached_schema(self, cache: SchemaCache) -> None:
        """Getting uncached schema returns None."""
        result = await cache.get_schema()
        assert result is None

    @pytest.mark.asyncio
    async def test_set_and_get_table(self, cache: SchemaCache) -> None:
        """Can cache and retrieve individual table."""
        table = {"name": "users", "columns": [{"name": "id"}]}

        await cache.set_table("users", table)
        result = await cache.get_table("users")

        assert result == table

    @pytest.mark.asyncio
    async def test_get_uncached_table(self, cache: SchemaCache) -> None:
        """Getting uncached table returns None."""
        result = await cache.get_table("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalidate_clears_all_schema(self, cache: SchemaCache) -> None:
        """Invalidate clears all schema cache."""
        await cache.set_schema({"tables": []})
        await cache.set_table("users", {"name": "users"})
        await cache.set_table("orders", {"name": "orders"})

        count = await cache.invalidate()

        assert count == 3
        assert await cache.get_schema() is None
        assert await cache.get_table("users") is None
        assert await cache.get_table("orders") is None


# ============================================================================
# CacheConfig Tests
# ============================================================================


class TestCacheConfig:
    """Tests for cache configuration."""

    def test_default_values(self) -> None:
        """Config has sensible defaults."""
        config = CacheConfig()

        assert config.default_ttl == 86400  # 24 hours
        assert config.schema_ttl == 3600  # 1 hour
        assert config.query_ttl == 86400  # 24 hours
        assert config.max_result_size == 1_000_000

    def test_custom_values(self) -> None:
        """Can set custom values."""
        config = CacheConfig(
            default_ttl=60,
            schema_ttl=120,
            query_ttl=30,
            max_result_size=500_000,
        )

        assert config.default_ttl == 60
        assert config.schema_ttl == 120
        assert config.query_ttl == 30
        assert config.max_result_size == 500_000


# ============================================================================
# CacheBackend Interface Tests
# ============================================================================


class TestCacheBackendInterface:
    """Tests to verify InMemoryCache implements CacheBackend correctly."""

    def test_in_memory_cache_is_cache_backend(self) -> None:
        """InMemoryCache is a CacheBackend."""
        cache = InMemoryCache()
        assert isinstance(cache, CacheBackend)

    @pytest.mark.asyncio
    async def test_interface_methods_exist(self) -> None:
        """All interface methods are callable."""
        cache = InMemoryCache()

        # All these should work without error
        await cache.set("key", "value", ttl=60)
        await cache.get("key")
        await cache.exists("key")
        await cache.delete("key")
        await cache.clear()


# ============================================================================
# Multi-Tenant QueryCache Tests
# ============================================================================


class TestQueryCacheMultiTenancy:
    """Tests for multi-tenant query cache isolation."""

    @pytest.fixture
    def sample_query(self) -> QueryDefinition:
        """Create a sample query."""
        return QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
        )

    @pytest.fixture
    def sample_result(self) -> QueryResult:
        """Create a sample query result."""
        return QueryResult(
            columns=["name"],
            column_types=["text"],
            rows=[["Alice"]],
            row_count=1,
            execution_time_ms=10.0,
        )

    def test_default_schema_name_is_public(self) -> None:
        """QueryCache defaults to 'public' schema."""
        cache = QueryCache(InMemoryCache())
        assert cache._schema_name == "public"

    def test_custom_schema_name(self) -> None:
        """QueryCache accepts custom schema name."""
        cache = QueryCache(InMemoryCache(), schema_name="org_123")
        assert cache._schema_name == "org_123"

    def test_make_key_includes_schema_name(self, sample_query: QueryDefinition) -> None:
        """Cache keys include the schema name."""
        cache = QueryCache(InMemoryCache(), schema_name="tenant_abc")
        key = cache.make_key(sample_query)
        assert key.startswith("query:tenant_abc:")

    def test_different_schemas_produce_different_keys(self, sample_query: QueryDefinition) -> None:
        """Same query in different schemas produces different keys."""
        cache1 = QueryCache(InMemoryCache(), schema_name="org_1")
        cache2 = QueryCache(InMemoryCache(), schema_name="org_2")

        key1 = cache1.make_key(sample_query)
        key2 = cache2.make_key(sample_query)

        assert key1 != key2
        assert "org_1" in key1
        assert "org_2" in key2

    @pytest.mark.asyncio
    async def test_tenant_isolation_shared_backend(
        self, sample_query: QueryDefinition, sample_result: QueryResult
    ) -> None:
        """Different tenants have isolated caches even with shared backend."""
        # Shared backend simulates shared Redis instance
        shared_backend = InMemoryCache()

        cache_tenant_a = QueryCache(shared_backend, schema_name="tenant_a")
        cache_tenant_b = QueryCache(shared_backend, schema_name="tenant_b")

        # Tenant A caches a result
        await cache_tenant_a.cache_result(sample_query, sample_result)

        # Tenant A can retrieve it
        result_a = await cache_tenant_a.get_result(sample_query)
        assert result_a is not None

        # Tenant B cannot see Tenant A's cached result
        result_b = await cache_tenant_b.get_result(sample_query)
        assert result_b is None

    @pytest.mark.asyncio
    async def test_invalidate_all_only_affects_own_schema(
        self, sample_query: QueryDefinition, sample_result: QueryResult
    ) -> None:
        """invalidate_all only clears cache for the specific schema."""
        shared_backend = InMemoryCache()

        cache_tenant_a = QueryCache(shared_backend, schema_name="tenant_a")
        cache_tenant_b = QueryCache(shared_backend, schema_name="tenant_b")

        # Both tenants cache the same query
        await cache_tenant_a.cache_result(sample_query, sample_result)
        await cache_tenant_b.cache_result(sample_query, sample_result)

        # Tenant A invalidates all
        await cache_tenant_a.invalidate_all()

        # Tenant A's cache is cleared
        assert await cache_tenant_a.get_result(sample_query) is None

        # Tenant B's cache is untouched
        assert await cache_tenant_b.get_result(sample_query) is not None


# ============================================================================
# Multi-Tenant SchemaCache Tests
# ============================================================================


class TestSchemaCacheMultiTenancy:
    """Tests for multi-tenant schema cache isolation."""

    def test_default_schema_name_is_public(self) -> None:
        """SchemaCache defaults to 'public' schema."""
        cache = SchemaCache(InMemoryCache())
        assert cache._schema_name == "public"

    def test_custom_schema_name(self) -> None:
        """SchemaCache accepts custom schema name."""
        cache = SchemaCache(InMemoryCache(), schema_name="org_456")
        assert cache._schema_name == "org_456"

    def test_make_key_includes_schema_name(self) -> None:
        """Internal keys include the schema name."""
        cache = SchemaCache(InMemoryCache(), schema_name="tenant_xyz")
        key = cache._make_key("full")
        assert key == "schema:tenant_xyz:full"

        table_key = cache._make_key("table:users")
        assert table_key == "schema:tenant_xyz:table:users"

    @pytest.mark.asyncio
    async def test_tenant_isolation_schema_cache(self) -> None:
        """Different tenants have isolated schema caches."""
        shared_backend = InMemoryCache()

        cache_tenant_a = SchemaCache(shared_backend, schema_name="tenant_a")
        cache_tenant_b = SchemaCache(shared_backend, schema_name="tenant_b")

        schema_a = {"tables": [{"name": "users_a"}]}
        schema_b = {"tables": [{"name": "users_b"}]}

        # Each tenant caches different schema
        await cache_tenant_a.set_schema(schema_a)
        await cache_tenant_b.set_schema(schema_b)

        # Each tenant sees only their own schema
        assert await cache_tenant_a.get_schema() == schema_a
        assert await cache_tenant_b.get_schema() == schema_b

    @pytest.mark.asyncio
    async def test_tenant_isolation_table_cache(self) -> None:
        """Different tenants have isolated table caches."""
        shared_backend = InMemoryCache()

        cache_tenant_a = SchemaCache(shared_backend, schema_name="tenant_a")
        cache_tenant_b = SchemaCache(shared_backend, schema_name="tenant_b")

        table_a = {"name": "users", "columns": [{"name": "id_a"}]}
        table_b = {"name": "users", "columns": [{"name": "id_b"}]}

        # Same table name, different tenants
        await cache_tenant_a.set_table("users", table_a)
        await cache_tenant_b.set_table("users", table_b)

        # Each tenant sees their own version
        assert await cache_tenant_a.get_table("users") == table_a
        assert await cache_tenant_b.get_table("users") == table_b

    @pytest.mark.asyncio
    async def test_invalidate_only_affects_own_schema(self) -> None:
        """invalidate only clears cache for the specific schema."""
        shared_backend = InMemoryCache()

        cache_tenant_a = SchemaCache(shared_backend, schema_name="tenant_a")
        cache_tenant_b = SchemaCache(shared_backend, schema_name="tenant_b")

        # Both tenants cache schema
        await cache_tenant_a.set_schema({"tables": []})
        await cache_tenant_a.set_table("users", {"name": "users"})
        await cache_tenant_b.set_schema({"tables": []})
        await cache_tenant_b.set_table("users", {"name": "users"})

        # Tenant A invalidates
        await cache_tenant_a.invalidate()

        # Tenant A's cache is cleared
        assert await cache_tenant_a.get_schema() is None
        assert await cache_tenant_a.get_table("users") is None

        # Tenant B's cache is untouched
        assert await cache_tenant_b.get_schema() is not None
        assert await cache_tenant_b.get_table("users") is not None
