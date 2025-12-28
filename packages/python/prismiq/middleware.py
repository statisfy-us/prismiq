"""
HTTP middleware for Prismiq API.

This module provides middleware components for rate limiting,
request tracking, and other cross-cutting concerns.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

if TYPE_CHECKING:
    from starlette.requests import Request
    from starlette.responses import Response


class RateLimitConfig(BaseModel):
    """Configuration for rate limiting."""

    model_config = ConfigDict(strict=True)

    requests_per_minute: int = 60
    """Maximum requests per minute per client."""

    requests_per_hour: int = 1000
    """Maximum requests per hour per client."""

    burst_size: int = 10
    """Maximum burst size (requests allowed in quick succession)."""

    window_size_seconds: int = 60
    """Sliding window size in seconds for rate tracking."""

    enabled: bool = True
    """Whether rate limiting is enabled."""


@dataclass
class TokenBucket:
    """
    Token bucket for rate limiting.

    Implements a token bucket algorithm where tokens are added at a fixed rate
    and consumed on each request. Allows for controlled bursting.
    """

    capacity: float
    """Maximum number of tokens in the bucket."""

    refill_rate: float
    """Tokens added per second."""

    tokens: float = field(default=0.0)
    """Current token count."""

    last_update: float = field(default_factory=time.time)
    """Timestamp of last token update."""

    def consume(self, tokens: int = 1) -> bool:
        """
        Attempt to consume tokens from the bucket.

        Args:
            tokens: Number of tokens to consume.

        Returns:
            True if tokens were consumed, False if rate limited.
        """
        self._refill()

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True

        return False

    def _refill(self) -> None:
        """Refill tokens based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_update
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_update = now

    def time_until_available(self, tokens: int = 1) -> float:
        """
        Calculate time until the requested tokens are available.

        Args:
            tokens: Number of tokens needed.

        Returns:
            Time in seconds until tokens are available (0 if available now).
        """
        self._refill()

        if self.tokens >= tokens:
            return 0.0

        needed = tokens - self.tokens
        return needed / self.refill_rate


@dataclass
class SlidingWindowCounter:
    """
    Sliding window counter for rate limiting.

    Tracks request counts in a sliding time window for more accurate
    rate limiting than fixed windows.
    """

    window_size: float
    """Window size in seconds."""

    max_requests: int
    """Maximum requests allowed in the window."""

    requests: list[float] = field(default_factory=list)
    """List of request timestamps."""

    def record(self) -> bool:
        """
        Record a request and check if rate limited.

        Returns:
            True if request is allowed, False if rate limited.
        """
        now = time.time()
        self._cleanup(now)

        if len(self.requests) >= self.max_requests:
            return False

        self.requests.append(now)
        return True

    def _cleanup(self, now: float) -> None:
        """Remove requests outside the current window."""
        cutoff = now - self.window_size
        self.requests = [t for t in self.requests if t > cutoff]

    def remaining(self) -> int:
        """Get remaining requests in current window."""
        self._cleanup(time.time())
        return max(0, self.max_requests - len(self.requests))

    def reset_time(self) -> float:
        """Get time until oldest request expires from window."""
        if not self.requests:
            return 0.0

        self._cleanup(time.time())
        if not self.requests:
            return 0.0

        oldest = min(self.requests)
        return max(0.0, oldest + self.window_size - time.time())


class RateLimiter:
    """
    Rate limiter that combines token bucket and sliding window algorithms.

    Uses token bucket for burst control and sliding window for
    sustained rate limiting.
    """

    def __init__(self, config: RateLimitConfig | None = None) -> None:
        """
        Initialize rate limiter.

        Args:
            config: Rate limit configuration.
        """
        self._config = config or RateLimitConfig()
        # Token buckets per client (for burst control)
        self._buckets: dict[str, TokenBucket] = {}
        # Sliding windows per client (for sustained rate)
        self._windows: dict[str, SlidingWindowCounter] = {}
        # Lock for thread-safe access
        self._lock = asyncio.Lock()

    @property
    def config(self) -> RateLimitConfig:
        """Get rate limit configuration."""
        return self._config

    async def is_allowed(self, client_id: str) -> tuple[bool, dict[str, Any]]:
        """
        Check if a request from the client is allowed.

        Args:
            client_id: Unique identifier for the client.

        Returns:
            Tuple of (is_allowed, rate_limit_info).
        """
        if not self._config.enabled:
            return True, {"enabled": False}

        async with self._lock:
            # Get or create bucket for this client
            if client_id not in self._buckets:
                self._buckets[client_id] = TokenBucket(
                    capacity=float(self._config.burst_size),
                    refill_rate=self._config.requests_per_minute / 60.0,
                    tokens=float(self._config.burst_size),
                )

            # Get or create sliding window for this client
            if client_id not in self._windows:
                self._windows[client_id] = SlidingWindowCounter(
                    window_size=float(self._config.window_size_seconds),
                    max_requests=self._config.requests_per_minute,
                )

            bucket = self._buckets[client_id]
            window = self._windows[client_id]

            # Check both token bucket and sliding window
            bucket_allowed = bucket.consume()
            window_allowed = window.record() if bucket_allowed else False

            info = {
                "limit": self._config.requests_per_minute,
                "remaining": window.remaining(),
                "reset": window.reset_time(),
                "retry_after": bucket.time_until_available() if not bucket_allowed else 0,
            }

            return bucket_allowed and window_allowed, info

    async def reset(self, client_id: str) -> None:
        """
        Reset rate limits for a client.

        Args:
            client_id: Client to reset.
        """
        async with self._lock:
            self._buckets.pop(client_id, None)
            self._windows.pop(client_id, None)

    async def reset_all(self) -> None:
        """Reset all rate limits."""
        async with self._lock:
            self._buckets.clear()
            self._windows.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI/Starlette middleware for rate limiting.

    Applies rate limiting based on client IP address or API key.
    """

    def __init__(
        self,
        app: Any,
        rate_limiter: RateLimiter | None = None,
        key_func: Callable[[Request], str] | None = None,
        exclude_paths: list[str] | None = None,
    ) -> None:
        """
        Initialize rate limit middleware.

        Args:
            app: ASGI application.
            rate_limiter: Rate limiter instance. Creates default if not provided.
            key_func: Function to extract client key from request. Defaults to IP.
            exclude_paths: Paths to exclude from rate limiting.
        """
        super().__init__(app)
        self._limiter = rate_limiter or RateLimiter()
        self._key_func = key_func or self._default_key_func
        self._exclude_paths = set(exclude_paths or [])

    def _default_key_func(self, request: Request) -> str:
        """Extract client key from request (default: IP address)."""
        # Check for X-Forwarded-For header (proxy/load balancer)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Get first IP in the chain
            return forwarded.split(",")[0].strip()

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process the request through rate limiting."""
        # Skip rate limiting for excluded paths
        if request.url.path in self._exclude_paths:
            return await call_next(request)

        client_id = self._key_func(request)
        allowed, info = await self._limiter.is_allowed(client_id)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": "Rate limit exceeded. Please try again later.",
                    "retry_after": info.get("retry_after", 60),
                },
                headers={
                    "X-RateLimit-Limit": str(info.get("limit", 0)),
                    "X-RateLimit-Remaining": str(info.get("remaining", 0)),
                    "X-RateLimit-Reset": str(int(info.get("reset", 0))),
                    "Retry-After": str(int(info.get("retry_after", 60))),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(info.get("limit", 0))
        response.headers["X-RateLimit-Remaining"] = str(info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(int(info.get("reset", 0)))

        return response


def create_rate_limiter(
    requests_per_minute: int = 60,
    burst_size: int = 10,
    enabled: bool = True,
) -> RateLimiter:
    """
    Create a rate limiter with common defaults.

    Args:
        requests_per_minute: Maximum requests per minute.
        burst_size: Maximum burst size.
        enabled: Whether rate limiting is enabled.

    Returns:
        Configured RateLimiter instance.
    """
    config = RateLimitConfig(
        requests_per_minute=requests_per_minute,
        burst_size=burst_size,
        enabled=enabled,
    )
    return RateLimiter(config)
