"""PostgreSQL-backed saved query storage with tenant isolation."""

from __future__ import annotations

import builtins
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    Column,
    MetaData,
    String,
    Table,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID

from prismiq.types import QueryDefinition, SavedQuery, SavedQueryCreate, SavedQueryUpdate

if TYPE_CHECKING:
    from asyncpg import Pool  # type: ignore[import-not-found]

_logger = logging.getLogger(__name__)

# SQLAlchemy Table definition for saved queries (used for query generation)
# quote=True ensures all identifiers are double-quoted in generated SQL
_metadata = MetaData()
_saved_queries_table = Table(
    "prismiq_saved_queries",
    _metadata,
    Column("id", UUID, primary_key=True, quote=True),
    Column("tenant_id", String(255), nullable=False, quote=True),
    Column("name", String(255), nullable=False, quote=True),
    Column("description", String, nullable=True, quote=True),
    Column("query", JSONB, nullable=False, quote=True),
    Column("owner_id", String(255), nullable=True, quote=True),
    Column("is_shared", Boolean, nullable=False, quote=True),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False, quote=True),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False, quote=True),
    quote=True,
)


class SavedQueryStore:
    """PostgreSQL-backed saved query storage with tenant isolation.

    All operations are scoped to a tenant_id for multi-tenant security.
    Supports per-tenant PostgreSQL schema isolation via schema_name
    parameter.
    """

    def __init__(self, pool: Pool) -> None:
        """Initialize SavedQueryStore.

        Args:
            pool: asyncpg connection pool
        """
        self._pool = pool

    async def _set_search_path(self, conn: Any, schema_name: str | None) -> None:
        """Set PostgreSQL search_path for schema isolation.

        Uses session-scoped set_config so the search_path persists across
        statements on the same connection.

        Args:
            conn: asyncpg connection
            schema_name: Schema name to use, or None for default (public)
        """
        if schema_name:
            # Build search_path value with safely quoted schema identifier
            # Double any embedded double-quotes to escape them in the identifier
            escaped_schema = schema_name.replace('"', '""')
            search_path_value = f'"{escaped_schema}", "public"'
            _logger.debug("[saved_query_store] Setting search_path to: %s", search_path_value)
            await conn.fetchval("SELECT set_config('search_path', $1, false)", search_path_value)
        else:
            _logger.debug('[saved_query_store] Setting search_path to: "public"')
            await conn.fetchval("SELECT set_config('search_path', $1, false)", '"public"')

    async def list(
        self,
        tenant_id: str,
        user_id: str | None = None,
        schema_name: str | None = None,
    ) -> builtins.list[SavedQuery]:
        """List saved queries for a tenant.

        Returns queries owned by the user or shared with all users. If
        user_id is None, returns all queries for the tenant.

        Args:
            tenant_id: Tenant ID for isolation.
            user_id: Optional user ID to filter by access.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        t = _saved_queries_table
        stmt = select(t).where(t.c.tenant_id == tenant_id)

        if user_id:
            # Return user's queries and shared queries
            from sqlalchemy import or_

            stmt = stmt.where(
                or_(
                    t.c.owner_id == user_id,
                    t.c.is_shared.is_(True),
                    t.c.owner_id.is_(None),
                )
            )

        stmt = stmt.order_by(t.c.name.asc())

        sql, params = self._compile_query(stmt)
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            rows = await conn.fetch(sql, *params)
            return [self._row_to_saved_query(row) for row in rows]

    async def get(
        self,
        query_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> SavedQuery | None:
        """Get a saved query by ID with tenant check.

        Args:
            query_id: The saved query ID.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        t = _saved_queries_table
        stmt = select(t).where(
            t.c.id == uuid.UUID(query_id),
            t.c.tenant_id == tenant_id,
        )

        sql, params = self._compile_query(stmt)
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(sql, *params)
            if not row:
                return None
            return self._row_to_saved_query(row)

    async def create(
        self,
        data: SavedQueryCreate,
        tenant_id: str,
        owner_id: str | None = None,
        schema_name: str | None = None,
    ) -> SavedQuery:
        """Create a new saved query.

        Args:
            data: Saved query creation data.
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        query_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        t = _saved_queries_table
        stmt = (
            insert(t)
            .values(
                id=query_id,
                tenant_id=tenant_id,
                name=data.name,
                description=data.description,
                query=json.dumps(data.query.model_dump()),
                owner_id=owner_id,
                is_shared=data.is_shared,
                created_at=now,
                updated_at=now,
            )
            .returning(*t.c)
        )

        sql, params = self._compile_query(stmt)
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(sql, *params)
            return self._row_to_saved_query(row)

    async def update(
        self,
        query_id: str,
        data: SavedQueryUpdate,
        tenant_id: str,
        user_id: str | None = None,
        schema_name: str | None = None,
    ) -> SavedQuery | None:
        """Update a saved query.

        Only the owner can update a query.

        Args:
            query_id: The saved query ID to update.
            data: Update data.
            tenant_id: Tenant ID for isolation.
            user_id: User ID for ownership check.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Collect fields to update
        values: dict[str, Any] = {}

        if data.name is not None:
            values["name"] = data.name

        if data.description is not None:
            values["description"] = data.description

        if data.query is not None:
            values["query"] = json.dumps(data.query.model_dump())

        if data.is_shared is not None:
            values["is_shared"] = data.is_shared

        if not values:
            # No updates provided, just return current query
            return await self.get(query_id, tenant_id, schema_name)

        # Always update the timestamp
        values["updated_at"] = datetime.now(timezone.utc)

        t = _saved_queries_table
        stmt = (
            update(t)
            .where(
                t.c.id == uuid.UUID(query_id),
                t.c.tenant_id == tenant_id,
            )
            .values(**values)
            .returning(*t.c)
        )

        # Only owner can update
        if user_id:
            stmt = stmt.where(t.c.owner_id == user_id)

        sql, params = self._compile_query(stmt)
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(sql, *params)
            if not row:
                return None
            return self._row_to_saved_query(row)

    async def delete(
        self,
        query_id: str,
        tenant_id: str,
        user_id: str | None = None,
        schema_name: str | None = None,
    ) -> bool:
        """Delete a saved query.

        Only the owner can delete a query.

        Args:
            query_id: The saved query ID to delete.
            tenant_id: Tenant ID for isolation.
            user_id: User ID for ownership check.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        t = _saved_queries_table
        stmt = delete(t).where(
            t.c.id == uuid.UUID(query_id),
            t.c.tenant_id == tenant_id,
        )

        if user_id:
            stmt = stmt.where(t.c.owner_id == user_id)

        sql, params = self._compile_query(stmt)
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.execute(sql, *params)
            return result == "DELETE 1"

    def _row_to_saved_query(self, row: Any) -> SavedQuery:
        """Convert a database row to a SavedQuery model."""
        query_data = row["query"]
        if isinstance(query_data, str):
            query_data = json.loads(query_data)

        return SavedQuery(
            id=str(row["id"]),
            name=row["name"],
            description=row.get("description"),
            query=QueryDefinition(**query_data),
            tenant_id=row["tenant_id"],
            owner_id=row.get("owner_id"),
            is_shared=row.get("is_shared", False),
            created_at=row["created_at"].isoformat() if row.get("created_at") else None,
            updated_at=row["updated_at"].isoformat() if row.get("updated_at") else None,
        )

    @staticmethod
    def _compile_query(stmt: Any) -> tuple[str, builtins.list[Any]]:
        """Compile a SQLAlchemy statement for asyncpg execution.

        Converts SQLAlchemy Core statements to SQL strings with positional
        parameters ($1, $2, etc.) compatible with asyncpg.

        Args:
            stmt: SQLAlchemy Core statement (select, insert, etc.)

        Returns:
            Tuple of (sql_string, list_of_parameters)
        """
        from sqlalchemy.dialects import postgresql

        dialect = postgresql.dialect(paramstyle="numeric")
        compiled = stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": False})
        sql = str(compiled)

        # Extract parameters in the order they appear in the SQL
        # The compiled.positiontup gives param names in order for positional dialects
        if hasattr(compiled, "positiontup") and compiled.positiontup:
            params = [compiled.params[name] for name in compiled.positiontup]
        else:
            # Fallback: params dict should be ordered in Python 3.7+
            params = list(compiled.params.values())

        return sql, params
