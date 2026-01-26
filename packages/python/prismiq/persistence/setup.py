"""Database setup utilities for Prismiq tables."""

from __future__ import annotations

import logging
import re
from functools import cache
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from asyncpg import Pool  # type: ignore[import-not-found]
    from sqlalchemy import Connection

logger = logging.getLogger(__name__)

# Valid schema name pattern: starts with letter/underscore, alphanumeric thereafter
_SCHEMA_NAME_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

# Reserved PostgreSQL schemas that should not be used for tenant data
_RESERVED_SCHEMAS = frozenset({"public", "information_schema", "pg_catalog", "pg_toast"})


class TableCreationError(Exception):
    """Raised when Prismiq tables cannot be created."""

    pass


def _validate_schema_name(schema_name: str) -> None:
    """Validate schema name for safety and correctness.

    Args:
        schema_name: PostgreSQL schema name to validate

    Raises:
        ValueError: If schema name is invalid or reserved
    """
    if not schema_name:
        raise ValueError("schema_name cannot be empty. Use None for default schema.")

    if not _SCHEMA_NAME_PATTERN.match(schema_name):
        raise ValueError(
            f"Invalid schema name '{schema_name}'. Schema names must start with "
            f"a letter or underscore and contain only alphanumeric characters."
        )

    if schema_name.lower() in _RESERVED_SCHEMAS:
        raise ValueError(
            f"Cannot use reserved schema '{schema_name}'. "
            f"Use a tenant-specific schema name instead."
        )


@cache
def _get_schema_sql() -> str:
    """Load SQL from adjacent schema.sql file (lazy, cached).

    Raises:
        RuntimeError: If schema.sql file is missing (corrupted installation)
    """
    schema_path = Path(__file__).parent / "schema.sql"
    try:
        return schema_path.read_text()
    except FileNotFoundError:
        raise RuntimeError(
            f"Prismiq schema.sql not found at {schema_path}. "
            f"This indicates a corrupted package installation. "
            f"Try reinstalling: pip install --force-reinstall prismiq"
        ) from None


async def ensure_tables(pool: Pool) -> None:
    """Create Prismiq metadata tables if they don't exist.

    This is idempotent - safe to call multiple times.
    Uses CREATE TABLE IF NOT EXISTS for all tables.

    Note: This creates tables in the current search_path schema.
    For multi-tenant schema isolation, use ensure_tables_sync() with
    SQLAlchemy, or set search_path before calling this function.

    Args:
        pool: asyncpg connection pool

    Raises:
        TableCreationError: If table creation fails
    """
    try:
        async with pool.acquire() as conn:
            await conn.execute(_get_schema_sql())
        logger.info("Prismiq tables created/verified successfully")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to create Prismiq tables: {error_msg}")
        raise TableCreationError(
            f"Failed to create Prismiq tables. "
            f"Check database permissions and connectivity. Original error: {error_msg}"
        ) from e


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

    Raises:
        ValueError: If schema_name is invalid or uses a reserved schema
        TableCreationError: If table creation fails

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

    target_schema = schema_name or "default schema"

    # Validate schema name if provided
    if schema_name is not None:
        _validate_schema_name(schema_name)

    try:
        if schema_name:
            # Use schema_translate_map for multi-tenant support
            connection = connection.execution_options(schema_translate_map={None: schema_name})

        logger.info(f"Creating Prismiq tables in {target_schema}")
        PrismiqBase.metadata.create_all(connection)
        logger.info(f"Prismiq tables created/verified in {target_schema}")

    except ValueError:
        # Re-raise validation errors as-is
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Failed to create Prismiq tables in {target_schema}: {error_msg}")

        # Provide actionable error messages for common issues
        if "schema" in error_msg.lower() and "does not exist" in error_msg.lower():
            raise TableCreationError(
                f"Schema '{schema_name}' does not exist. "
                f"Create the schema before calling ensure_tables_sync()."
            ) from e

        raise TableCreationError(
            f"Failed to create Prismiq tables in {target_schema}. "
            f"Check database permissions and schema existence. "
            f"Original error: {error_msg}"
        ) from e
