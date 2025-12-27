"""Pytest configuration and fixtures."""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest


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


@pytest.fixture
def sample_tables_data() -> list[dict[str, Any]]:
    """Sample table metadata from information_schema."""
    return [
        {"table_name": "users", "table_schema": "public"},
        {"table_name": "orders", "table_schema": "public"},
        {"table_name": "products", "table_schema": "public"},
    ]


@pytest.fixture
def sample_columns_data() -> list[dict[str, Any]]:
    """Sample column metadata from information_schema."""
    return [
        {
            "column_name": "id",
            "data_type": "integer",
            "is_nullable": "NO",
            "column_default": "nextval('users_id_seq'::regclass)",
            "ordinal_position": 1,
        },
        {
            "column_name": "email",
            "data_type": "character varying",
            "is_nullable": "NO",
            "column_default": None,
            "ordinal_position": 2,
        },
        {
            "column_name": "created_at",
            "data_type": "timestamp with time zone",
            "is_nullable": "NO",
            "column_default": "now()",
            "ordinal_position": 3,
        },
    ]


# ============================================================================
# Integration test fixtures (require DATABASE_URL)
# ============================================================================


@pytest.fixture
def database_url() -> str | None:
    """Get database URL from environment."""
    return os.environ.get("DATABASE_URL")


@pytest.fixture
async def real_pool(database_url: str | None) -> AsyncGenerator[Any, None]:
    """
    Create a real asyncpg connection pool for integration tests.

    Skip if DATABASE_URL is not set.

    Usage:
        @pytest.mark.integration
        async def test_real_query(real_pool):
            async with real_pool.acquire() as conn:
                result = await conn.fetch("SELECT 1")
    """
    if database_url is None:
        pytest.skip("DATABASE_URL not set, skipping integration test")

    import asyncpg

    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
    try:
        yield pool
    finally:
        await pool.close()


def pytest_configure(config: Any) -> None:
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test (requires DATABASE_URL)"
    )
