"""PostgreSQL-backed saved query storage with tenant isolation."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from prismiq.types import (QueryDefinition, SavedQuery, SavedQueryCreate,
                           SavedQueryUpdate)

if TYPE_CHECKING:
    from asyncpg import Pool  # type: ignore[import-not-found]

_logger = logging.getLogger(__name__)


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

        Args:
            conn: asyncpg connection
            schema_name: Schema name to use, or None for default (public)
        """
        if schema_name:
            # Set search_path to the tenant schema, falling back to public
            # Escape double quotes to prevent SQL injection
            escaped_schema = schema_name.replace('"', '""')
            sql = f'SET search_path TO "{escaped_schema}", public'
            _logger.info(f"[saved_query_store] Setting search_path: {sql}")
            await conn.execute(sql)
        else:
            _logger.info(
                "[saved_query_store] Setting search_path: SET search_path TO public"
            )
            await conn.execute("SET search_path TO public")

    async def list(
        self,
        tenant_id: str,
        user_id: str | None = None,
        schema_name: str | None = None,
    ) -> list[SavedQuery]:
        """List saved queries for a tenant.

        Returns queries owned by the user or shared with all users. If
        user_id is None, returns all queries for the tenant.

        Args:
            tenant_id: Tenant ID for isolation.
            user_id: Optional user ID to filter by access.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        query = """
            SELECT *
            FROM prismiq_saved_queries
            WHERE tenant_id = $1
        """
        params: list[Any] = [tenant_id]

        if user_id:
            # Return user's queries and shared queries
            query += """
                AND (owner_id = $2 OR is_shared = TRUE OR owner_id IS NULL)
            """
            params.append(user_id)

        query += " ORDER BY name ASC"

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            rows = await conn.fetch(query, *params)
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
        query = """
            SELECT *
            FROM prismiq_saved_queries
            WHERE id = $1 AND tenant_id = $2
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, uuid.UUID(query_id), tenant_id)
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

        query = """
            INSERT INTO prismiq_saved_queries
            (id, tenant_id, name, description, query, owner_id, is_shared, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(
                query,
                query_id,
                tenant_id,
                data.name,
                data.description,
                json.dumps(data.query.model_dump()),
                owner_id,
                data.is_shared,
                now,
                now,
            )
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
        # Build dynamic UPDATE based on provided fields
        updates: list[str] = []
        params: list[Any] = []
        param_num = 1

        if data.name is not None:
            updates.append(f"name = ${param_num}")
            params.append(data.name)
            param_num += 1

        if data.description is not None:
            updates.append(f"description = ${param_num}")
            params.append(data.description)
            param_num += 1

        if data.query is not None:
            updates.append(f"query = ${param_num}")
            params.append(json.dumps(data.query.model_dump()))
            param_num += 1

        if data.is_shared is not None:
            updates.append(f"is_shared = ${param_num}")
            params.append(data.is_shared)
            param_num += 1

        if not updates:
            # No updates provided, just return current query
            return await self.get(query_id, tenant_id, schema_name)

        # Add query_id and tenant_id as final params
        params.extend([uuid.UUID(query_id), tenant_id])

        # Build WHERE clause - only owner can update
        where_clause = f"id = ${param_num} AND tenant_id = ${param_num + 1}"
        if user_id:
            params.append(user_id)
            where_clause += f" AND owner_id = ${param_num + 2}"

        # Column names in `updates` are hardcoded above, not user input
        query = f"""
            UPDATE prismiq_saved_queries
            SET {", ".join(updates)}
            WHERE {where_clause}
            RETURNING *
        """  # noqa: S608

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, *params)
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
        query = "DELETE FROM prismiq_saved_queries WHERE id = $1 AND tenant_id = $2"
        params: list[Any] = [uuid.UUID(query_id), tenant_id]

        if user_id:
            query += " AND owner_id = $3"
            params.append(user_id)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.execute(query, *params)
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
