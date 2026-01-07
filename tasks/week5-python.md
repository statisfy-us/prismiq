# Week 5: Python Backend - Production Ready

## Overview
Add caching, rate limiting, logging, health checks, and metrics for production deployment.

## Prerequisites
- Week 4 complete (dashboard system)

## Validation Command
```bash
make check
```

---

## Task 1: Redis Caching Infrastructure

**Goal:** Create a caching layer with Redis support.

**File:** `packages/python/prismiq/cache.py`

**Classes:**

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
import hashlib
import json

class CacheBackend(ABC):
    """Abstract cache backend interface."""

    @abstractmethod
    async def get(self, key: str) -> Any | None:
        """Get a value from cache."""
        ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set a value in cache with optional TTL in seconds."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Delete a key from cache."""
        ...

    @abstractmethod
    async def clear(self, pattern: str | None = None) -> int:
        """Clear cache, optionally matching a pattern."""
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if a key exists."""
        ...

class InMemoryCache(CacheBackend):
    """In-memory cache for development/testing."""

    def __init__(self) -> None:
        self._cache: dict[str, tuple[Any, float | None]] = {}

    # Implement all methods with expiration checking...

class RedisCache(CacheBackend):
    """Redis-backed cache for production."""

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis: Redis | None = None

    async def connect(self) -> None:
        """Connect to Redis."""
        ...

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        ...

class QueryCache:
    """High-level cache for query results."""

    def __init__(self, backend: CacheBackend, default_ttl: int = 300) -> None:
        self._backend = backend
        self._default_ttl = default_ttl

    def make_key(self, query: QueryDefinition) -> str:
        """Generate a cache key from a query definition."""
        ...

    async def get_result(self, query: QueryDefinition) -> QueryResult | None:
        """Get a cached query result."""
        ...

    async def cache_result(
        self,
        query: QueryDefinition,
        result: QueryResult,
        ttl: int | None = None
    ) -> None:
        """Cache a query result."""
        ...

    async def invalidate_table(self, table_name: str) -> int:
        """Invalidate all cached queries involving a table."""
        ...
```

**Requirements:**
- TTL-based expiration
- Key generation from query hash
- Serialization/deserialization of QueryResult
- Pattern-based invalidation

**Tests:** `packages/python/tests/test_cache.py`
- Test in-memory cache operations
- Test TTL expiration
- Test key generation
- Test pattern matching for invalidation

---

## Task 2: Schema Caching

**Goal:** Cache database schema to reduce introspection queries.

**File:** Update `packages/python/prismiq/schema.py`

**Add to SchemaIntrospector:**

```python
class SchemaIntrospector:
    def __init__(
        self,
        pool: Pool,
        cache: CacheBackend | None = None,
        cache_ttl: int = 3600,  # 1 hour default
    ) -> None:
        self._cache = cache
        self._cache_ttl = cache_ttl

    async def get_schema(self, force_refresh: bool = False) -> DatabaseSchema:
        """Get schema, using cache if available."""
        if self._cache and not force_refresh:
            cached = await self._cache.get("schema:full")
            if cached:
                return DatabaseSchema.model_validate(cached)

        schema = await self._introspect_schema()

        if self._cache:
            await self._cache.set(
                "schema:full",
                schema.model_dump(),
                self._cache_ttl
            )

        return schema

    async def invalidate_cache(self) -> None:
        """Invalidate schema cache."""
        if self._cache:
            await self._cache.clear("schema:*")
```

**Tests:** Update `packages/python/tests/test_schema.py`
- Test cached schema retrieval
- Test force refresh
- Test cache invalidation

---

## Task 3: Rate Limiting Middleware

**Goal:** Add request rate limiting middleware.

**File:** `packages/python/prismiq/middleware.py`

**Classes:**

```python
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
import time

class RateLimitConfig(BaseModel):
    """Rate limiting configuration."""
    model_config = ConfigDict(strict=True)

    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_limit: int = 10  # Max requests in 1 second

class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, config: RateLimitConfig) -> None:
        self._config = config
        self._buckets: dict[str, TokenBucket] = {}

    def check_rate_limit(self, client_id: str) -> tuple[bool, dict[str, Any]]:
        """Check if request is allowed.

        Returns:
            (allowed, headers) - whether request is allowed and rate limit headers
        """
        ...

class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting."""

    def __init__(
        self,
        app: ASGIApp,
        limiter: RateLimiter,
        get_client_id: Callable[[Request], str] | None = None,
    ) -> None:
        ...

    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting."""
        client_id = self._get_client_id(request)
        allowed, headers = self._limiter.check_rate_limit(client_id)

        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers=headers
            )

        response = await call_next(request)
        for key, value in headers.items():
            response.headers[key] = value
        return response
```

**Headers to include:**
- X-RateLimit-Limit
- X-RateLimit-Remaining
- X-RateLimit-Reset

**Tests:** `packages/python/tests/test_middleware.py`
- Test rate limit enforcement
- Test burst handling
- Test header generation
- Test client identification

---

## Task 4: Request Logging

**Goal:** Add structured logging for all API requests.

**File:** `packages/python/prismiq/logging.py`

**Classes:**

```python
import logging
import json
from datetime import datetime
from typing import Any
import uuid

class StructuredFormatter(logging.Formatter):
    """JSON structured log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }

        # Add extra fields
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms

        return json.dumps(log_data)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all incoming requests."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Log request
        logger.info(
            "Request started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": request.client.host,
            }
        )

        response = await call_next(request)

        # Log response
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
        )

        response.headers["X-Request-ID"] = request_id
        return response

def setup_logging(level: str = "INFO", json_format: bool = True) -> None:
    """Configure application logging."""
    ...
```

**Tests:** `packages/python/tests/test_logging.py`
- Test structured format output
- Test request ID generation
- Test duration tracking

---

## Task 5: Health Check Endpoint

**Goal:** Add health check endpoint for monitoring.

**File:** Update `packages/python/prismiq/api.py`

**Endpoints:**

```python
class HealthStatus(BaseModel):
    """Health check response."""
    model_config = ConfigDict(strict=True)

    status: str  # "healthy", "degraded", "unhealthy"
    version: str
    uptime_seconds: float
    checks: dict[str, HealthCheck]

class HealthCheck(BaseModel):
    """Individual health check."""
    model_config = ConfigDict(strict=True)

    status: str
    message: str | None = None
    latency_ms: float | None = None

@router.get("/health")
async def health_check() -> HealthStatus:
    """Basic health check."""
    checks = {}

    # Check database connection
    try:
        start = time.perf_counter()
        await engine.check_connection()
        latency = (time.perf_counter() - start) * 1000
        checks["database"] = HealthCheck(
            status="healthy",
            latency_ms=round(latency, 2)
        )
    except Exception as e:
        checks["database"] = HealthCheck(
            status="unhealthy",
            message=str(e)
        )

    # Check cache if configured
    if engine.cache:
        try:
            await engine.cache.set("health_check", "ok", ttl=1)
            checks["cache"] = HealthCheck(status="healthy")
        except Exception as e:
            checks["cache"] = HealthCheck(
                status="unhealthy",
                message=str(e)
            )

    # Determine overall status
    all_healthy = all(c.status == "healthy" for c in checks.values())
    any_unhealthy = any(c.status == "unhealthy" for c in checks.values())

    return HealthStatus(
        status="healthy" if all_healthy else ("unhealthy" if any_unhealthy else "degraded"),
        version=__version__,
        uptime_seconds=get_uptime(),
        checks=checks
    )

@router.get("/health/live")
async def liveness() -> dict:
    """Kubernetes liveness probe - is the process alive?"""
    return {"status": "ok"}

@router.get("/health/ready")
async def readiness() -> dict:
    """Kubernetes readiness probe - can we accept traffic?"""
    # Check if we can connect to the database
    await engine.check_connection()
    return {"status": "ok"}
```

**Tests:** Update `packages/python/tests/test_api.py`
- Test health endpoint with healthy database
- Test health endpoint with degraded state
- Test liveness/readiness probes

---

## Task 6: Prometheus Metrics

**Goal:** Add Prometheus-compatible metrics endpoint.

**File:** `packages/python/prismiq/metrics.py`

**Classes:**

```python
from dataclasses import dataclass
from collections import defaultdict
import time

@dataclass
class MetricValue:
    """A single metric value."""
    name: str
    value: float
    labels: dict[str, str]
    type: str  # "counter", "gauge", "histogram"

class Metrics:
    """Prometheus-compatible metrics collector."""

    def __init__(self) -> None:
        self._counters: dict[str, float] = defaultdict(float)
        self._gauges: dict[str, float] = {}
        self._histograms: dict[str, list[float]] = defaultdict(list)

    def inc_counter(self, name: str, value: float = 1, **labels: str) -> None:
        """Increment a counter."""
        key = self._make_key(name, labels)
        self._counters[key] += value

    def set_gauge(self, name: str, value: float, **labels: str) -> None:
        """Set a gauge value."""
        key = self._make_key(name, labels)
        self._gauges[key] = value

    def observe_histogram(self, name: str, value: float, **labels: str) -> None:
        """Record a histogram observation."""
        key = self._make_key(name, labels)
        self._histograms[key].append(value)

    def format_prometheus(self) -> str:
        """Format metrics in Prometheus exposition format."""
        lines = []

        for key, value in self._counters.items():
            name, labels = self._parse_key(key)
            lines.append(f"# TYPE {name} counter")
            lines.append(f"{name}{{{labels}}} {value}")

        # Similar for gauges and histograms...

        return "\n".join(lines)

# Global metrics instance
metrics = Metrics()

# Convenience functions
def record_query_execution(duration_ms: float, status: str) -> None:
    """Record a query execution metric."""
    metrics.inc_counter("prismiq_queries_total", status=status)
    metrics.observe_histogram("prismiq_query_duration_ms", duration_ms)

def record_cache_hit(hit: bool) -> None:
    """Record cache hit/miss."""
    metrics.inc_counter(
        "prismiq_cache_total",
        result="hit" if hit else "miss"
    )
```

**Endpoint:**

```python
@router.get("/metrics")
async def get_metrics() -> Response:
    """Prometheus metrics endpoint."""
    return Response(
        content=metrics.format_prometheus(),
        media_type="text/plain"
    )
```

**Metrics to track:**
- `prismiq_queries_total` (counter) - by status (success, error)
- `prismiq_query_duration_ms` (histogram) - query execution time
- `prismiq_cache_total` (counter) - by result (hit, miss)
- `prismiq_active_connections` (gauge) - database pool size
- `prismiq_requests_total` (counter) - by endpoint and status

**Tests:** `packages/python/tests/test_metrics.py`
- Test counter increment
- Test gauge setting
- Test histogram recording
- Test Prometheus format output

---

## Task 7: Engine Integration

**Goal:** Integrate caching, metrics, and logging into PrismiqEngine.

**File:** Update `packages/python/prismiq/engine.py`

**Add to PrismiqEngine:**

```python
class PrismiqEngine:
    def __init__(
        self,
        database_url: str,
        exposed_tables: list[str] | None = None,
        schema_config: SchemaConfig | None = None,
        dashboard_store: DashboardStore | None = None,
        cache: CacheBackend | None = None,  # NEW
        cache_ttl: int = 300,  # NEW
        query_timeout: float = 30.0,
        max_rows: int = 10000,
        enable_metrics: bool = True,  # NEW
    ):
        self._cache = cache
        self._cache_ttl = cache_ttl
        self._enable_metrics = enable_metrics
        self._query_cache = QueryCache(cache, cache_ttl) if cache else None

    @property
    def cache(self) -> CacheBackend | None:
        """Get the cache backend."""
        return self._cache

    async def execute_query(
        self,
        query: QueryDefinition,
        use_cache: bool = True,
    ) -> QueryResult:
        """Execute a query with optional caching."""
        start = time.perf_counter()

        # Check cache
        if use_cache and self._query_cache:
            cached = await self._query_cache.get_result(query)
            if cached:
                record_cache_hit(True)
                return cached
            record_cache_hit(False)

        # Execute query
        try:
            result = await self._executor.execute(query, self._schema)

            # Cache result
            if use_cache and self._query_cache:
                await self._query_cache.cache_result(query, result)

            # Record metrics
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "success")

            return result

        except Exception as e:
            if self._enable_metrics:
                duration = (time.perf_counter() - start) * 1000
                record_query_execution(duration, "error")
            raise

    async def check_connection(self) -> bool:
        """Check if database connection is healthy."""
        try:
            async with self._pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception:
            return False

    async def invalidate_cache(self, table_name: str | None = None) -> int:
        """Invalidate cached data."""
        if not self._query_cache:
            return 0

        if table_name:
            return await self._query_cache.invalidate_table(table_name)
        else:
            return await self._cache.clear("query:*")
```

**Update `__init__.py` exports:**
- CacheBackend, InMemoryCache, RedisCache, QueryCache
- RateLimitConfig, RateLimiter, RateLimitMiddleware
- RequestLoggingMiddleware, setup_logging
- HealthStatus, HealthCheck
- Metrics, metrics, record_query_execution, record_cache_hit

---

## Completion Criteria

All tasks complete when:
- [ ] Cache layer works with in-memory and Redis backends
- [ ] Schema caching reduces database queries
- [ ] Rate limiting prevents abuse
- [ ] Request logging produces structured logs
- [ ] Health check reports database/cache status
- [ ] Metrics endpoint produces Prometheus format
- [ ] Engine integrates all production features
- [ ] `make check` passes (lint, types, tests)
