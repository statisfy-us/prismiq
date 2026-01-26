"""Database setup utilities for Prismiq tables."""

from __future__ import annotations

from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from asyncpg import Pool  # type: ignore[import-not-found]
    from sqlalchemy import Connection


@cache
def _get_schema_sql() -> str:
    """Load SQL from adjacent schema.sql file (lazy, cached)."""
    return (Path(__file__).parent / "schema.sql").read_text()


async def ensure_tables(pool: Pool) -> None:
    """Create Prismiq metadata tables if they don't exist.

    This is idempotent - safe to call multiple times.
    Uses CREATE TABLE IF NOT EXISTS for all tables.

    Args:
        pool: asyncpg connection pool
    """
    async with pool.acquire() as conn:
        await conn.execute(_get_schema_sql())


async def drop_tables(pool: Pool) -> None:
    """Drop all Prismiq metadata tables.

    WARNING: This will delete all dashboard and widget data.
    Use with caution - primarily for testing.

    Args:
        pool: asyncpg connection pool
    """
    async with pool.acquire() as conn:
        await conn.execute(
            """
            DROP TABLE IF EXISTS prismiq_widgets CASCADE;
            DROP TABLE IF EXISTS prismiq_dashboards CASCADE;
            DROP TABLE IF EXISTS prismiq_saved_queries CASCADE;
            DROP FUNCTION IF EXISTS prismiq_update_timestamp CASCADE;
        """
        )


async def table_exists(pool: Pool, table_name: str) -> bool:
    """Check if a Prismiq table exists.

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


def ensure_tables_sync(connection: Connection, schema_name: str | None = None) -> None:
    """Create Prismiq tables in specified schema (synchronous).

    For use with SQLAlchemy sync engines in multi-tenant systems. This function
    creates all Prismiq tables using the declarative models from models.py.

    This is the recommended approach for:
    - Alembic migrations with schema-based multi-tenancy
    - Programmatic table creation during tenant provisioning
    - Integration with existing SQLAlchemy-based applications

    Args:
        connection: SQLAlchemy sync connection
        schema_name: PostgreSQL schema name (e.g., "tenant_123"). If provided,
            tables are created in this schema using schema_translate_map.
            If None, tables are created in the default schema.

    Example:
        from sqlalchemy import create_engine
        from prismiq import ensure_tables_sync

        engine = create_engine("postgresql://user:pass@localhost/db")

        # Create in default schema
        with engine.connect() as conn:
            ensure_tables_sync(conn)
            conn.commit()

        # Create in tenant-specific schema
        with engine.connect() as conn:
            ensure_tables_sync(conn, schema_name="tenant_123")
            conn.commit()
    """
    from prismiq.persistence.models import PrismiqBase

    if schema_name:
        # Use schema_translate_map for multi-tenant support
        # This translates None (default schema) to the specified schema
        connection = connection.execution_options(schema_translate_map={None: schema_name})

    PrismiqBase.metadata.create_all(connection)
