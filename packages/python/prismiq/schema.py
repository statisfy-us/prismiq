"""
Schema introspection for PostgreSQL databases.

This module provides the SchemaIntrospector class that reads database
metadata from PostgreSQL's information_schema.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
    Relationship,
    TableNotFoundError,
    TableSchema,
)

if TYPE_CHECKING:
    from asyncpg import Pool, Record


class SchemaIntrospector:
    """
    Introspects PostgreSQL database schema.

    Reads table and column metadata from information_schema,
    detects foreign key relationships, and provides a filtered
    view based on exposed_tables configuration.

    Example:
        >>> pool = await asyncpg.create_pool(database_url)
        >>> introspector = SchemaIntrospector(pool, exposed_tables=["users", "orders"])
        >>> schema = await introspector.get_schema()
        >>> print(schema.table_names())
        ['users', 'orders']
    """

    def __init__(
        self,
        pool: Pool,
        exposed_tables: list[str] | None = None,
        schema_name: str = "public",
    ) -> None:
        """
        Initialize the schema introspector.

        Args:
            pool: asyncpg connection pool to use for queries.
            exposed_tables: List of table names to expose. If None, all tables
                in the schema are exposed.
            schema_name: PostgreSQL schema to introspect (default: "public").
        """
        self._pool = pool
        self._exposed_tables = exposed_tables
        self._schema_name = schema_name

    async def get_schema(self) -> DatabaseSchema:
        """
        Get the complete database schema.

        Returns:
            DatabaseSchema containing all exposed tables and their relationships.
        """
        table_names = await self._get_table_names()
        tables: list[TableSchema] = []

        for table_name in table_names:
            table = await self._get_table_schema(table_name)
            tables.append(table)

        relationships = await self.detect_relationships()

        return DatabaseSchema(tables=tables, relationships=relationships)

    async def get_table(self, table_name: str) -> TableSchema:
        """
        Get schema information for a single table.

        Args:
            table_name: Name of the table to retrieve.

        Returns:
            TableSchema for the requested table.

        Raises:
            TableNotFoundError: If the table doesn't exist or isn't exposed.
        """
        # Check if table is exposed
        if self._exposed_tables is not None and table_name not in self._exposed_tables:
            raise TableNotFoundError(table_name)

        # Check if table exists in database
        table_names = await self._get_table_names()
        if table_name not in table_names:
            raise TableNotFoundError(table_name)

        return await self._get_table_schema(table_name)

    async def detect_relationships(self) -> list[Relationship]:
        """
        Detect foreign key relationships between exposed tables.

        Returns:
            List of Relationship objects representing foreign keys.
        """
        async with self._pool.acquire() as conn:
            # Query foreign key constraints
            query = """
                SELECT
                    tc.table_name AS from_table,
                    kcu.column_name AS from_column,
                    ccu.table_name AS to_table,
                    ccu.column_name AS to_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = $1
            """
            rows: list[Record] = await conn.fetch(query, self._schema_name)

        relationships: list[Relationship] = []
        exposed_set = set(self._exposed_tables) if self._exposed_tables else None

        for row in rows:
            from_table = row["from_table"]
            to_table = row["to_table"]

            # Filter to only include relationships between exposed tables
            if exposed_set is not None and (
                from_table not in exposed_set or to_table not in exposed_set
            ):
                continue

            relationships.append(
                Relationship(
                    from_table=from_table,
                    from_column=row["from_column"],
                    to_table=to_table,
                    to_column=row["to_column"],
                )
            )

        return relationships

    async def _get_table_names(self) -> list[str]:
        """Get list of table names in the schema."""
        async with self._pool.acquire() as conn:
            query = """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1
                    AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """
            rows: list[Record] = await conn.fetch(query, self._schema_name)

        table_names = [row["table_name"] for row in rows]

        # Filter to exposed tables if specified
        if self._exposed_tables is not None:
            table_names = [t for t in table_names if t in self._exposed_tables]

        return table_names

    async def _get_table_schema(self, table_name: str) -> TableSchema:
        """Get schema for a single table."""
        columns = await self._get_columns(table_name)
        primary_keys = await self._get_primary_keys(table_name)
        primary_key_set = set(primary_keys)

        # Mark primary key columns
        for col in columns:
            if col.name in primary_key_set:
                # Create new column with is_primary_key=True
                # (Pydantic models are immutable by default in strict mode)
                col_dict = col.model_dump()
                col_dict["is_primary_key"] = True
                columns[columns.index(col)] = ColumnSchema(**col_dict)

        return TableSchema(
            name=table_name,
            schema_name=self._schema_name,
            columns=columns,
        )

    async def _get_columns(self, table_name: str) -> list[ColumnSchema]:
        """Get column information for a table."""
        async with self._pool.acquire() as conn:
            query = """
                SELECT
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_schema = $1
                    AND table_name = $2
                ORDER BY ordinal_position
            """
            rows: list[Record] = await conn.fetch(query, self._schema_name, table_name)

        return [
            ColumnSchema(
                name=row["column_name"],
                data_type=row["data_type"],
                is_nullable=row["is_nullable"] == "YES",
                default_value=row["column_default"],
            )
            for row in rows
        ]

    async def _get_primary_keys(self, table_name: str) -> list[str]:
        """Get primary key column names for a table."""
        async with self._pool.acquire() as conn:
            query = """
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_schema = $1
                    AND tc.table_name = $2
                ORDER BY kcu.ordinal_position
            """
            rows: list[Record] = await conn.fetch(query, self._schema_name, table_name)

        return [row["column_name"] for row in rows]
