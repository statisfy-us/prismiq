"""Caching layer for Prismiq with Redis and in-memory backends.

This module provides cache abstractions for storing query results,
schema metadata, and other frequently accessed data.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import time
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from prismiq.types import QueryDefinition, QueryResult


class CacheBackend(ABC):
    """Abstract cache backend interface.

    All cache implementations must inherit from this class and implement
    the required methods.
    """

    @abstractmethod
    async def get(self, key: str) -> Any | None:
        """Get a value from cache.

        Args:
            key: Cache key to retrieve.

        Returns:
            Cached value or None if not found or expired.
        """
        ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a value in cache with optional TTL.

        Args:
            key: Cache key.
            value: Value to cache (must be JSON-serializable).
            ttl: Time to live in seconds. None means no expiration.
        """
        ...

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a key from cache.

        Args:
            key: Cache key to delete.

        Returns:
            True if key existed and was deleted, False otherwise.
        """
        ...

    @abstractmethod
    async def clear(self, pattern: str | None = None) -> int:
        """Clear cache entries, optionally matching a pattern.

        Args:
            pattern: Glob-style pattern (e.g., "query:*"). If None, clears all.

        Returns:
            Number of entries cleared.
        """
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache.

        Args:
            key: Cache key to check.

        Returns:
            True if key exists and is not expired.
        """
        ...


class InMemoryCache(CacheBackend):
    """In-memory cache for development and testing.

    Stores values with optional TTL-based expiration. Not suitable for
    production use with multiple processes.
    """

    def __init__(self) -> None:
        """Initialize empty cache."""
        # Store (value, expiration_time) tuples
        self._cache: dict[str, tuple[Any, float | None]] = {}

    async def get(self, key: str) -> Any | None:
        """Get a value from cache."""
        if key not in self._cache:
            return None

        value, expires_at = self._cache[key]

        # Check expiration
        if expires_at is not None and time.time() > expires_at:
            del self._cache[key]
            return None

        return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a value in cache."""
        expires_at = time.time() + ttl if ttl is not None else None
        self._cache[key] = (value, expires_at)

    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    async def exists(self, key: str) -> bool:
        """Check if a key exists."""
        if key not in self._cache:
            return False

        _, expires_at = self._cache[key]

        if expires_at is not None and time.time() > expires_at:
            del self._cache[key]
            return False

        return True

    async def clear(self, pattern: str | None = None) -> int:
        """Clear cache entries matching pattern."""
        if pattern is None:
            count = len(self._cache)
            self._cache.clear()
            return count

        # Find keys matching pattern
        keys_to_delete = [key for key in self._cache if fnmatch.fnmatch(key, pattern)]

        for key in keys_to_delete:
            del self._cache[key]

        return len(keys_to_delete)

    def _cleanup_expired(self) -> None:
        """Remove expired entries (for testing/maintenance)."""
        current_time = time.time()
        keys_to_delete = [
            key
            for key, (_, expires_at) in self._cache.items()
            if expires_at is not None and current_time > expires_at
        ]
        for key in keys_to_delete:
            del self._cache[key]


class RedisCache(CacheBackend):
    """Redis-backed cache for production use.

    Requires redis-py async client. Install with:
        pip install redis

    Example:
        >>> cache = RedisCache("redis://localhost:6379/0")
        >>> await cache.connect()
        >>> await cache.set("key", {"data": "value"}, ttl=300)
        >>> await cache.disconnect()
    """

    def __init__(self, redis_url: str, key_prefix: str = "prismiq:") -> None:
        """Initialize Redis cache.

        Args:
            redis_url: Redis connection URL (e.g., "redis://localhost:6379/0").
            key_prefix: Prefix for all cache keys.
        """
        self._redis_url = redis_url
        self._key_prefix = key_prefix
        self._redis: Any | None = None

    async def connect(self) -> None:
        """Connect to Redis.

        Must be called before using the cache.
        """
        try:
            # pyright: ignore[reportMissingImports]
            from redis.asyncio import Redis  # type: ignore[import-not-found]
        except ImportError as e:
            raise ImportError(
                "redis package is required for RedisCache. Install with: pip install redis"
            ) from e

        self._redis = Redis.from_url(self._redis_url, decode_responses=True)
        # Test connection
        await self._redis.ping()  # type: ignore[union-attr]

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        if self._redis is not None:
            await self._redis.close()
            self._redis = None

    def _make_key(self, key: str) -> str:
        """Add prefix to key."""
        return f"{self._key_prefix}{key}"

    async def get(self, key: str) -> Any | None:
        """Get a value from Redis."""
        if self._redis is None:
            raise RuntimeError("RedisCache not connected. Call connect() first.")

        full_key = self._make_key(key)
        value = await self._redis.get(full_key)

        if value is None:
            return None

        return json.loads(value)

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a value in Redis."""
        if self._redis is None:
            raise RuntimeError("RedisCache not connected. Call connect() first.")

        full_key = self._make_key(key)
        serialized = json.dumps(value, default=str)

        if ttl is not None:
            await self._redis.setex(full_key, ttl, serialized)
        else:
            await self._redis.set(full_key, serialized)

    async def delete(self, key: str) -> bool:
        """Delete a key from Redis."""
        if self._redis is None:
            raise RuntimeError("RedisCache not connected. Call connect() first.")

        full_key = self._make_key(key)
        result = await self._redis.delete(full_key)
        return result > 0

    async def exists(self, key: str) -> bool:
        """Check if a key exists in Redis."""
        if self._redis is None:
            raise RuntimeError("RedisCache not connected. Call connect() first.")

        full_key = self._make_key(key)
        return await self._redis.exists(full_key) > 0

    async def clear(self, pattern: str | None = None) -> int:
        """Clear cache entries matching pattern."""
        if self._redis is None:
            raise RuntimeError("RedisCache not connected. Call connect() first.")

        # Determine search pattern with prefix
        search_pattern = f"{self._key_prefix}*" if pattern is None else self._make_key(pattern)

        # Use SCAN to find matching keys (safer than KEYS for large datasets)
        count = 0
        cursor = 0
        while True:
            cursor, keys = await self._redis.scan(cursor, match=search_pattern, count=100)
            if keys:
                await self._redis.delete(*keys)
                count += len(keys)
            if cursor == 0:
                break

        return count


class CacheConfig(BaseModel):
    """Configuration for cache behavior."""

    model_config = ConfigDict(strict=True)

    default_ttl: int = 86400
    """Default TTL in seconds (24 hours)."""

    schema_ttl: int = 3600
    """TTL for schema cache (1 hour)."""

    query_ttl: int = 86400
    """TTL for query results (24 hours)."""

    max_result_size: int = 1_000_000
    """Maximum size in bytes for cached query results."""


class QueryCache:
    """High-level cache for query results.

    Handles serialization, key generation, and table-based invalidation.
    Supports multi-tenancy via schema_name parameter for cache key isolation.
    """

    def __init__(
        self,
        backend: CacheBackend,
        config: CacheConfig | None = None,
        schema_name: str = "public",
    ) -> None:
        """Initialize query cache.

        Args:
            backend: Cache backend to use.
            config: Cache configuration.
            schema_name: PostgreSQL schema name for cache key isolation (multi-tenancy).
        """
        self._backend = backend
        self._config = config or CacheConfig()
        self._schema_name = schema_name
        # Track which tables are used in each cached query
        self._table_keys: dict[str, set[str]] = {}

    def make_key(self, query: QueryDefinition) -> str:
        """Generate a cache key from a query definition.

        Uses a hash of the query's JSON representation.
        Includes schema_name for multi-tenant isolation.

        Args:
            query: Query definition to hash.

        Returns:
            Cache key string.
        """
        # Serialize query to JSON
        query_json = query.model_dump_json(exclude_none=True)
        # Create hash
        query_hash = hashlib.sha256(query_json.encode()).hexdigest()[:16]
        return f"query:{self._schema_name}:{query_hash}"

    async def get_result(self, query: QueryDefinition) -> QueryResult | None:
        """Get a cached query result.

        Args:
            query: Query definition to look up.

        Returns:
            Cached QueryResult or None if not found.
        """
        from prismiq.types import QueryResult

        key = self.make_key(query)
        cached = await self._backend.get(key)

        if cached is None:
            return None

        return QueryResult.model_validate(cached)

    async def cache_result(
        self,
        query: QueryDefinition,
        result: QueryResult,
        ttl: int | None = None,
    ) -> float:
        """Cache a query result.

        Args:
            query: Query definition (used for key generation).
            result: Query result to cache.
            ttl: TTL in seconds (uses default if not specified).

        Returns:
            Unix timestamp when the result was cached.
        """
        key = self.make_key(query)
        effective_ttl = ttl if ttl is not None else self._config.query_ttl
        cached_at = time.time()

        # Check result size
        result_json = result.model_dump_json()
        if len(result_json) > self._config.max_result_size:
            # Skip caching oversized results
            return cached_at

        # Track tables used in this query for invalidation
        table_names = [t.name for t in query.tables]
        for table_name in table_names:
            if table_name not in self._table_keys:
                self._table_keys[table_name] = set()
            self._table_keys[table_name].add(key)

        # Store result and metadata
        await self._backend.set(key, result.model_dump(), effective_ttl)
        await self._backend.set(
            f"meta:{key}", {"cached_at": cached_at, "ttl": effective_ttl}, effective_ttl
        )

        return cached_at

    async def get_cache_metadata(self, query: QueryDefinition) -> dict[str, float | int] | None:
        """Get cache metadata for a query.

        Args:
            query: Query definition to look up.

        Returns:
            Dict with 'cached_at' timestamp and 'ttl', or None if not cached.
        """
        key = self.make_key(query)
        metadata = await self._backend.get(f"meta:{key}")
        return metadata

    async def invalidate_table(self, table_name: str) -> int:
        """Invalidate all cached queries involving a table.

        Args:
            table_name: Name of the table that changed.

        Returns:
            Number of cache entries invalidated.
        """
        if table_name not in self._table_keys:
            return 0

        keys_to_invalidate = self._table_keys[table_name]
        count = 0

        for key in list(keys_to_invalidate):
            if await self._backend.delete(key):
                count += 1
            # Also delete metadata
            await self._backend.delete(f"meta:{key}")

        # Clear the tracking set
        self._table_keys[table_name].clear()

        return count

    async def invalidate_all(self) -> int:
        """Invalidate all cached query results for this schema.

        Returns:
            Number of cache entries invalidated.
        """
        count = await self._backend.clear(f"query:{self._schema_name}:*")
        # Also clear all metadata for this schema
        await self._backend.clear(f"meta:query:{self._schema_name}:*")
        self._table_keys.clear()
        return count


class SchemaCache:
    """High-level cache for database schema.

    Provides caching for schema introspection results.
    Supports multi-tenancy via schema_name parameter for cache key isolation.
    """

    def __init__(
        self,
        backend: CacheBackend,
        ttl: int = 3600,
        schema_name: str = "public",
    ) -> None:
        """Initialize schema cache.

        Args:
            backend: Cache backend to use.
            ttl: TTL for schema cache in seconds.
            schema_name: PostgreSQL schema name for cache key isolation (multi-tenancy).
        """
        self._backend = backend
        self._ttl = ttl
        self._schema_name = schema_name

    def _make_key(self, key: str) -> str:
        """Create a cache key with schema prefix for tenant isolation."""
        return f"schema:{self._schema_name}:{key}"

    async def get_schema(self) -> dict[str, Any] | None:
        """Get cached schema.

        Returns:
            Cached schema dict or None if not found.
        """
        return await self._backend.get(self._make_key("full"))

    async def set_schema(self, schema_dict: dict[str, Any]) -> None:
        """Cache schema.

        Args:
            schema_dict: Schema dictionary to cache.
        """
        await self._backend.set(self._make_key("full"), schema_dict, self._ttl)

    async def get_table(self, table_name: str) -> dict[str, Any] | None:
        """Get cached table schema.

        Args:
            table_name: Name of the table.

        Returns:
            Cached table dict or None if not found.
        """
        return await self._backend.get(self._make_key(f"table:{table_name}"))

    async def set_table(self, table_name: str, table_dict: dict[str, Any]) -> None:
        """Cache table schema.

        Args:
            table_name: Name of the table.
            table_dict: Table dictionary to cache.
        """
        await self._backend.set(self._make_key(f"table:{table_name}"), table_dict, self._ttl)

    async def invalidate(self) -> int:
        """Invalidate all schema cache for this schema.

        Returns:
            Number of cache entries invalidated.
        """
        return await self._backend.clear(f"schema:{self._schema_name}:*")
