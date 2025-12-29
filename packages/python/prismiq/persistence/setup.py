"""Database setup utilities for Prismiq tables."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from asyncpg import Pool

# Load SQL from adjacent schema.sql file
SCHEMA_SQL = (Path(__file__).parent / "schema.sql").read_text()


async def ensure_tables(pool: Pool) -> None:
    """
    Create Prismiq metadata tables if they don't exist.

    This is idempotent - safe to call multiple times.
    Uses CREATE TABLE IF NOT EXISTS for all tables.

    Args:
        pool: asyncpg connection pool
    """
    async with pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)


async def drop_tables(pool: Pool) -> None:
    """
    Drop all Prismiq metadata tables.

    WARNING: This will delete all dashboard and widget data.
    Use with caution - primarily for testing.

    Args:
        pool: asyncpg connection pool
    """
    async with pool.acquire() as conn:
        await conn.execute("""
            DROP TABLE IF EXISTS prismiq_widgets CASCADE;
            DROP TABLE IF EXISTS prismiq_dashboards CASCADE;
            DROP TABLE IF EXISTS prismiq_schema_config CASCADE;
            DROP TABLE IF EXISTS prismiq_saved_queries CASCADE;
            DROP FUNCTION IF EXISTS prismiq_update_timestamp CASCADE;
        """)


async def table_exists(pool: Pool, table_name: str) -> bool:
    """
    Check if a Prismiq table exists.

    Args:
        pool: asyncpg connection pool
        table_name: Name of the table to check

    Returns:
        True if table exists, False otherwise
    """
    async with pool.acquire() as conn:
        result = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = $1
            )
            """,
            table_name,
        )
        return bool(result)
