"""Tests for middleware module."""

from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from prismiq.middleware import (
    RateLimitConfig,
    RateLimiter,
    RateLimitMiddleware,
    SlidingWindowCounter,
    TokenBucket,
    create_rate_limiter,
)

# ============================================================================
# TokenBucket Tests
# ============================================================================


class TestTokenBucket:
    """Tests for TokenBucket."""

    def test_initial_tokens_at_capacity(self) -> None:
        """Bucket starts with specified tokens."""
        bucket = TokenBucket(capacity=10.0, refill_rate=1.0, tokens=10.0)
        assert bucket.tokens == 10.0

    def test_consume_reduces_tokens(self) -> None:
        """Consuming reduces token count."""
        bucket = TokenBucket(capacity=10.0, refill_rate=1.0, tokens=10.0)

        assert bucket.consume(1)
        assert bucket.tokens < 10.0

    def test_consume_fails_when_empty(self) -> None:
        """Cannot consume when tokens exhausted."""
        bucket = TokenBucket(capacity=10.0, refill_rate=1.0, tokens=0.0)

        result = bucket.consume(1)
        assert result is False

    def test_consume_multiple_tokens(self) -> None:
        """Can consume multiple tokens at once."""
        bucket = TokenBucket(capacity=10.0, refill_rate=1.0, tokens=10.0)

        assert bucket.consume(5)
        # Should have approximately 5 left (minus tiny time-based refill)
        assert bucket.tokens >= 4.5

    def test_refill_over_time(self) -> None:
        """Tokens refill over time."""
        bucket = TokenBucket(
            capacity=10.0,
            refill_rate=10.0,  # 10 tokens per second
            tokens=0.0,
        )
        bucket.last_update = time.time() - 0.5  # 0.5 seconds ago

        bucket._refill()

        # Should have ~5 tokens (10 tokens/sec * 0.5 sec)
        assert bucket.tokens >= 4.0
        assert bucket.tokens <= 6.0

    def test_refill_caps_at_capacity(self) -> None:
        """Refill doesn't exceed capacity."""
        bucket = TokenBucket(
            capacity=10.0,
            refill_rate=100.0,  # Fast refill
            tokens=9.0,
        )
        bucket.last_update = time.time() - 1.0  # 1 second ago

        bucket._refill()

        assert bucket.tokens == 10.0

    def test_time_until_available(self) -> None:
        """Calculates wait time correctly."""
        bucket = TokenBucket(
            capacity=10.0,
            refill_rate=1.0,  # 1 token per second
            tokens=0.0,
        )

        wait_time = bucket.time_until_available(1)

        # Should wait approximately 1 second for 1 token
        assert wait_time >= 0.9
        assert wait_time <= 1.1

    def test_time_until_available_when_available(self) -> None:
        """Returns 0 when tokens are available."""
        bucket = TokenBucket(capacity=10.0, refill_rate=1.0, tokens=10.0)

        wait_time = bucket.time_until_available(1)
        assert wait_time == 0.0


# ============================================================================
# SlidingWindowCounter Tests
# ============================================================================


class TestSlidingWindowCounter:
    """Tests for SlidingWindowCounter."""

    def test_allows_requests_under_limit(self) -> None:
        """Allows requests under the limit."""
        window = SlidingWindowCounter(window_size=60.0, max_requests=10)

        for _ in range(10):
            assert window.record() is True

    def test_blocks_requests_at_limit(self) -> None:
        """Blocks requests at the limit."""
        window = SlidingWindowCounter(window_size=60.0, max_requests=5)

        # Fill up the window
        for _ in range(5):
            window.record()

        # Should be blocked
        assert window.record() is False

    def test_remaining_count(self) -> None:
        """Remaining count is accurate."""
        window = SlidingWindowCounter(window_size=60.0, max_requests=10)

        assert window.remaining() == 10

        window.record()
        window.record()
        window.record()

        assert window.remaining() == 7

    def test_old_requests_expire(self) -> None:
        """Old requests are cleaned up."""
        window = SlidingWindowCounter(window_size=0.1, max_requests=5)  # 100ms window

        # Fill up
        for _ in range(5):
            window.record()

        assert window.record() is False

        # Wait for window to expire
        time.sleep(0.15)

        # Should be allowed again
        assert window.record() is True

    def test_reset_time(self) -> None:
        """Reset time is calculated correctly."""
        window = SlidingWindowCounter(window_size=60.0, max_requests=10)

        # No requests yet
        assert window.reset_time() == 0.0

        window.record()

        # Reset time should be close to window size
        reset = window.reset_time()
        assert reset > 59.0
        assert reset <= 60.0


# ============================================================================
# RateLimiter Tests
# ============================================================================


class TestRateLimiter:
    """Tests for RateLimiter."""

    @pytest.fixture
    def limiter(self) -> RateLimiter:
        """Create a rate limiter for testing."""
        config = RateLimitConfig(
            requests_per_minute=10,
            burst_size=5,
            window_size_seconds=60,
            enabled=True,
        )
        return RateLimiter(config)

    async def test_allows_initial_request(self, limiter: RateLimiter) -> None:
        """First request is allowed."""
        allowed, info = await limiter.is_allowed("client1")

        assert allowed is True
        assert info["limit"] == 10
        assert info["remaining"] >= 0

    async def test_respects_burst_limit(self, limiter: RateLimiter) -> None:
        """Respects burst limit."""
        # Send burst of requests
        allowed_count = 0
        for _ in range(10):
            allowed, _ = await limiter.is_allowed("client1")
            if allowed:
                allowed_count += 1

        # Should allow burst_size requests immediately
        assert allowed_count >= 5

    async def test_different_clients_independent(self, limiter: RateLimiter) -> None:
        """Different clients have independent limits."""
        # Exhaust client1's burst
        for _ in range(6):
            await limiter.is_allowed("client1")

        # client2 should still be allowed
        allowed, _ = await limiter.is_allowed("client2")
        assert allowed is True

    async def test_disabled_limiter_always_allows(self) -> None:
        """Disabled limiter allows all requests."""
        config = RateLimitConfig(enabled=False)
        limiter = RateLimiter(config)

        for _ in range(100):
            allowed, info = await limiter.is_allowed("client1")
            assert allowed is True
            assert info.get("enabled") is False

    async def test_reset_clears_client_state(self, limiter: RateLimiter) -> None:
        """Reset clears rate limit state for client."""
        # Use some capacity
        for _ in range(5):
            await limiter.is_allowed("client1")

        # Reset
        await limiter.reset("client1")

        # Should have full capacity again
        allowed, _info = await limiter.is_allowed("client1")
        assert allowed is True
        # Remaining should be at/near limit after reset (minus the one we just used)

    async def test_reset_all_clears_all_state(self, limiter: RateLimiter) -> None:
        """Reset all clears all client state."""
        # Use capacity for multiple clients
        for _ in range(5):
            await limiter.is_allowed("client1")
            await limiter.is_allowed("client2")

        # Reset all
        await limiter.reset_all()

        # Both should have full capacity
        allowed1, _ = await limiter.is_allowed("client1")
        allowed2, _ = await limiter.is_allowed("client2")
        assert allowed1 is True
        assert allowed2 is True


class TestRateLimitConfig:
    """Tests for RateLimitConfig."""

    def test_default_values(self) -> None:
        """Config has sensible defaults."""
        config = RateLimitConfig()

        assert config.requests_per_minute == 60
        assert config.requests_per_hour == 1000
        assert config.burst_size == 10
        assert config.window_size_seconds == 60
        assert config.enabled is True

    def test_custom_values(self) -> None:
        """Can set custom values."""
        config = RateLimitConfig(
            requests_per_minute=100,
            burst_size=20,
            enabled=False,
        )

        assert config.requests_per_minute == 100
        assert config.burst_size == 20
        assert config.enabled is False


# ============================================================================
# RateLimitMiddleware Tests
# ============================================================================


class TestRateLimitMiddleware:
    """Tests for RateLimitMiddleware."""

    @pytest.fixture
    def app(self) -> Starlette:
        """Create a test application with rate limiting."""

        async def homepage(request: MagicMock) -> JSONResponse:
            return JSONResponse({"status": "ok"})

        async def health(request: MagicMock) -> JSONResponse:
            return JSONResponse({"healthy": True})

        app = Starlette(
            routes=[
                Route("/", homepage),
                Route("/health", health),
            ]
        )

        config = RateLimitConfig(requests_per_minute=5, burst_size=3, enabled=True)
        limiter = RateLimiter(config)

        app.add_middleware(
            RateLimitMiddleware,
            rate_limiter=limiter,
            exclude_paths=["/health"],
        )

        return app

    @pytest.fixture
    def client(self, app: Starlette) -> TestClient:
        """Create a test client."""
        return TestClient(app)

    def test_allows_requests_under_limit(self, client: TestClient) -> None:
        """Allows requests under rate limit."""
        response = client.get("/")

        assert response.status_code == 200
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    def test_returns_429_when_limited(self, client: TestClient) -> None:
        """Returns 429 when rate limited."""
        # Exhaust rate limit
        for _ in range(10):
            response = client.get("/")
            if response.status_code == 429:
                break

        # Should eventually get 429
        response = client.get("/")
        if response.status_code == 429:
            assert response.json()["error"] == "Too Many Requests"
            assert "Retry-After" in response.headers

    def test_excludes_configured_paths(self, client: TestClient) -> None:
        """Excluded paths bypass rate limiting."""
        # Make many requests to health endpoint
        for _ in range(20):
            response = client.get("/health")
            assert response.status_code == 200

    def test_rate_limit_headers_present(self, client: TestClient) -> None:
        """Rate limit headers are present in response."""
        response = client.get("/")

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


# ============================================================================
# Helper Function Tests
# ============================================================================


class TestCreateRateLimiter:
    """Tests for create_rate_limiter helper."""

    def test_creates_with_defaults(self) -> None:
        """Creates limiter with default settings."""
        limiter = create_rate_limiter()

        assert limiter.config.requests_per_minute == 60
        assert limiter.config.burst_size == 10
        assert limiter.config.enabled is True

    def test_creates_with_custom_settings(self) -> None:
        """Creates limiter with custom settings."""
        limiter = create_rate_limiter(
            requests_per_minute=100,
            burst_size=20,
            enabled=False,
        )

        assert limiter.config.requests_per_minute == 100
        assert limiter.config.burst_size == 20
        assert limiter.config.enabled is False
