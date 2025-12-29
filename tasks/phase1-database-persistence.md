# Phase 1: Database Persistence

## Overview
Persist dashboards and widgets to PostgreSQL so data survives restarts. This is the highest priority gap in the current implementation.

## Prerequisites
- Core SDK complete (Weeks 1-5)
- Demo app working
- E2E testing infrastructure (Phase 0)

## Validation Commands
```bash
make check                                    # Python tests pass
cd examples/demo/frontend && npm test         # E2E tests pass
```

## E2E Validation
```typescript
// New test: examples/demo/frontend/e2e/persistence.spec.ts
test('dashboard survives backend restart', async ({ request }) => {
  // Create dashboard
  const create = await request.post('/api/dashboards', {
    data: { name: 'Persistence Test', description: 'Test' }
  });
  const { id } = await create.json();

  // Restart backend (simulated by checking API still returns it)
  const get = await request.get(`/api/dashboards/${id}`);
  expect(get.ok()).toBeTruthy();
  expect((await get.json()).name).toBe('Persistence Test');
});
```

---

## Task 1: Database Schema SQL

**File:** `packages/python/prismiq/persistence/schema.sql`

```sql
-- Prismiq metadata tables
-- Created in customer's database alongside their data tables

-- Dashboards
CREATE TABLE IF NOT EXISTS prismiq_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{"columns": 12, "rowHeight": 50, "margin": [10, 10]}',
    filters JSONB NOT NULL DEFAULT '[]',
    owner_id VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    allowed_viewers TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_dashboard_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_dashboards_tenant_id ON prismiq_dashboards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner_id ON prismiq_dashboards(tenant_id, owner_id);

-- Widgets
CREATE TABLE IF NOT EXISTS prismiq_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES prismiq_dashboards(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    query JSONB,  -- Null for text widgets
    position JSONB NOT NULL,  -- {x, y, w, h}
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_id ON prismiq_widgets(dashboard_id);

-- Schema configuration per tenant
CREATE TABLE IF NOT EXISTS prismiq_schema_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_config_tenant ON prismiq_schema_config(tenant_id);

-- Saved queries for reuse
CREATE TABLE IF NOT EXISTS prismiq_saved_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query JSONB NOT NULL,
    owner_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_query_name_per_tenant UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_tenant ON prismiq_saved_queries(tenant_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION prismiq_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS prismiq_dashboards_updated ON prismiq_dashboards;
CREATE TRIGGER prismiq_dashboards_updated
    BEFORE UPDATE ON prismiq_dashboards
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_widgets_updated ON prismiq_widgets;
CREATE TRIGGER prismiq_widgets_updated
    BEFORE UPDATE ON prismiq_widgets
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_schema_config_updated ON prismiq_schema_config;
CREATE TRIGGER prismiq_schema_config_updated
    BEFORE UPDATE ON prismiq_schema_config
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();

DROP TRIGGER IF EXISTS prismiq_saved_queries_updated ON prismiq_saved_queries;
CREATE TRIGGER prismiq_saved_queries_updated
    BEFORE UPDATE ON prismiq_saved_queries
    FOR EACH ROW EXECUTE FUNCTION prismiq_update_timestamp();
```

---

## Task 2: SQLAlchemy Core Table Definitions

**File:** `packages/python/prismiq/persistence/__init__.py`

```python
"""Database persistence layer for Prismiq."""

from prismiq.persistence.tables import (
    metadata,
    dashboards_table,
    widgets_table,
    schema_config_table,
    saved_queries_table,
)
from prismiq.persistence.postgres_store import PostgresDashboardStore
from prismiq.persistence.setup import ensure_tables, drop_tables

__all__ = [
    "metadata",
    "dashboards_table",
    "widgets_table",
    "schema_config_table",
    "saved_queries_table",
    "PostgresDashboardStore",
    "ensure_tables",
    "drop_tables",
]
```

**File:** `packages/python/prismiq/persistence/tables.py`

```python
"""SQLAlchemy Core table definitions for Prismiq metadata."""

from __future__ import annotations

from sqlalchemy import (
    Table,
    Column,
    String,
    Boolean,
    Text,
    ForeignKey,
    MetaData,
    Index,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP, ARRAY

metadata = MetaData()

# Dashboards table
dashboards_table = Table(
    "prismiq_dashboards",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("tenant_id", String(255), nullable=False),
    Column("name", String(255), nullable=False),
    Column("description", Text, nullable=True),
    Column("layout", JSONB, nullable=False),
    Column("filters", JSONB, nullable=False),
    Column("owner_id", String(255), nullable=True),
    Column("is_public", Boolean, nullable=False, default=False),
    Column("allowed_viewers", ARRAY(Text), nullable=False, default=[]),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False),
    UniqueConstraint("tenant_id", "name", name="unique_dashboard_name_per_tenant"),
    Index("idx_dashboards_tenant_id", "tenant_id"),
    Index("idx_dashboards_owner_id", "tenant_id", "owner_id"),
)

# Widgets table
widgets_table = Table(
    "prismiq_widgets",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column(
        "dashboard_id",
        UUID(as_uuid=True),
        ForeignKey("prismiq_dashboards.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("type", String(50), nullable=False),
    Column("title", String(255), nullable=False),
    Column("query", JSONB, nullable=True),  # Null for text widgets
    Column("position", JSONB, nullable=False),
    Column("config", JSONB, nullable=False, default={}),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False),
    Index("idx_widgets_dashboard_id", "dashboard_id"),
)

# Schema configuration table
schema_config_table = Table(
    "prismiq_schema_config",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("tenant_id", String(255), nullable=False, unique=True),
    Column("config", JSONB, nullable=False, default={}),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False),
    Index("idx_schema_config_tenant", "tenant_id"),
)

# Saved queries table
saved_queries_table = Table(
    "prismiq_saved_queries",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("tenant_id", String(255), nullable=False),
    Column("name", String(255), nullable=False),
    Column("description", Text, nullable=True),
    Column("query", JSONB, nullable=False),
    Column("owner_id", String(255), nullable=True),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False),
    UniqueConstraint("tenant_id", "name", name="unique_query_name_per_tenant"),
    Index("idx_saved_queries_tenant", "tenant_id"),
)
```

---

## Task 3: Table Creation Utility

**File:** `packages/python/prismiq/persistence/setup.py`

```python
"""Database setup utilities for Prismiq tables."""

from __future__ import annotations

from pathlib import Path

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
```

---

## Task 4: PostgresDashboardStore Implementation

**File:** `packages/python/prismiq/persistence/postgres_store.py`

```python
"""PostgreSQL-backed dashboard storage with tenant isolation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from asyncpg import Pool

from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    DashboardLayout,
    DashboardFilter,
    Widget,
    WidgetCreate,
    WidgetUpdate,
    WidgetPosition,
    WidgetType,
)
from prismiq.dashboard_store import DashboardStore


class PostgresDashboardStore(DashboardStore):
    """
    PostgreSQL-backed dashboard storage with tenant isolation.

    All operations are scoped to a tenant_id for multi-tenant security.
    """

    def __init__(self, pool: Pool) -> None:
        """
        Initialize PostgresDashboardStore.

        Args:
            pool: asyncpg connection pool
        """
        self._pool = pool

    # -------------------------------------------------------------------------
    # Dashboard Operations
    # -------------------------------------------------------------------------

    async def list_dashboards(
        self,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> list[Dashboard]:
        """List all dashboards for a tenant."""
        query = """
            SELECT
                d.id,
                d.tenant_id,
                d.name,
                d.description,
                d.layout,
                d.filters,
                d.owner_id,
                d.is_public,
                d.allowed_viewers,
                d.created_at,
                d.updated_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', w.id,
                            'type', w.type,
                            'title', w.title,
                            'query', w.query,
                            'position', w.position,
                            'config', w.config
                        )
                        ORDER BY w.position->>'y', w.position->>'x'
                    ) FILTER (WHERE w.id IS NOT NULL),
                    '[]'
                ) as widgets
            FROM prismiq_dashboards d
            LEFT JOIN prismiq_widgets w ON w.dashboard_id = d.id
            WHERE d.tenant_id = $1
        """
        params: list[Any] = [tenant_id]

        if owner_id:
            query += """
                AND (
                    d.owner_id = $2
                    OR d.is_public = TRUE
                    OR $2 = ANY(d.allowed_viewers)
                )
            """
            params.append(owner_id)

        query += " GROUP BY d.id ORDER BY d.updated_at DESC"

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [self._row_to_dashboard(row) for row in rows]

    async def get_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> Dashboard | None:
        """Get a dashboard by ID with tenant check."""
        query = """
            SELECT
                d.id,
                d.tenant_id,
                d.name,
                d.description,
                d.layout,
                d.filters,
                d.owner_id,
                d.is_public,
                d.allowed_viewers,
                d.created_at,
                d.updated_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', w.id,
                            'type', w.type,
                            'title', w.title,
                            'query', w.query,
                            'position', w.position,
                            'config', w.config
                        )
                        ORDER BY w.position->>'y', w.position->>'x'
                    ) FILTER (WHERE w.id IS NOT NULL),
                    '[]'
                ) as widgets
            FROM prismiq_dashboards d
            LEFT JOIN prismiq_widgets w ON w.dashboard_id = d.id
            WHERE d.id = $1 AND d.tenant_id = $2
            GROUP BY d.id
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, uuid.UUID(dashboard_id), tenant_id)
            if not row:
                return None
            return self._row_to_dashboard(row)

    async def create_dashboard(
        self,
        data: DashboardCreate,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> Dashboard:
        """Create a new dashboard."""
        dashboard_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        layout = data.layout or DashboardLayout()

        query = """
            INSERT INTO prismiq_dashboards
            (id, tenant_id, name, description, layout, filters, owner_id, is_public, allowed_viewers, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                dashboard_id,
                tenant_id,
                data.name,
                data.description,
                layout.model_dump(),
                [],  # Empty filters initially
                owner_id,
                False,  # is_public default
                [],  # allowed_viewers default
                now,
                now,
            )
            return self._row_to_dashboard(row, widgets=[])

    async def update_dashboard(
        self,
        dashboard_id: str,
        data: DashboardUpdate,
        tenant_id: str,
    ) -> Dashboard | None:
        """Update a dashboard with tenant check."""
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

        if data.layout is not None:
            updates.append(f"layout = ${param_num}")
            params.append(data.layout.model_dump())
            param_num += 1

        if data.filters is not None:
            updates.append(f"filters = ${param_num}")
            params.append([f.model_dump() for f in data.filters])
            param_num += 1

        if data.is_public is not None:
            updates.append(f"is_public = ${param_num}")
            params.append(data.is_public)
            param_num += 1

        if data.allowed_viewers is not None:
            updates.append(f"allowed_viewers = ${param_num}")
            params.append(data.allowed_viewers)
            param_num += 1

        if not updates:
            # No updates provided, just return current dashboard
            return await self.get_dashboard(dashboard_id, tenant_id)

        # Add dashboard_id and tenant_id as final params
        params.extend([uuid.UUID(dashboard_id), tenant_id])

        query = f"""
            UPDATE prismiq_dashboards
            SET {", ".join(updates)}
            WHERE id = ${param_num} AND tenant_id = ${param_num + 1}
            RETURNING *
        """

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            if not row:
                return None
            # Fetch with widgets
            return await self.get_dashboard(dashboard_id, tenant_id)

    async def delete_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a dashboard with tenant check. Widgets cascade delete."""
        query = "DELETE FROM prismiq_dashboards WHERE id = $1 AND tenant_id = $2"
        async with self._pool.acquire() as conn:
            result = await conn.execute(query, uuid.UUID(dashboard_id), tenant_id)
            return result == "DELETE 1"

    # -------------------------------------------------------------------------
    # Widget Operations
    # -------------------------------------------------------------------------

    async def add_widget(
        self,
        dashboard_id: str,
        data: WidgetCreate,
        tenant_id: str,
    ) -> Widget | None:
        """Add a widget to a dashboard with tenant check."""
        # Verify dashboard belongs to tenant
        dashboard = await self.get_dashboard(dashboard_id, tenant_id)
        if not dashboard:
            return None

        widget_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        query = """
            INSERT INTO prismiq_widgets
            (id, dashboard_id, type, title, query, position, config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                widget_id,
                uuid.UUID(dashboard_id),
                data.type.value if isinstance(data.type, WidgetType) else data.type,
                data.title,
                data.query.model_dump() if data.query else None,
                data.position.model_dump(),
                data.config or {},
                now,
                now,
            )
            return self._row_to_widget(row)

    async def get_widget(
        self,
        widget_id: str,
        tenant_id: str,
    ) -> Widget | None:
        """Get a widget by ID with tenant check via dashboard."""
        query = """
            SELECT w.*
            FROM prismiq_widgets w
            JOIN prismiq_dashboards d ON d.id = w.dashboard_id
            WHERE w.id = $1 AND d.tenant_id = $2
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, uuid.UUID(widget_id), tenant_id)
            if not row:
                return None
            return self._row_to_widget(row)

    async def update_widget(
        self,
        widget_id: str,
        data: WidgetUpdate,
        tenant_id: str,
    ) -> Widget | None:
        """Update a widget with tenant check."""
        # Build dynamic UPDATE
        updates: list[str] = []
        params: list[Any] = []
        param_num = 1

        if data.title is not None:
            updates.append(f"title = ${param_num}")
            params.append(data.title)
            param_num += 1

        if data.query is not None:
            updates.append(f"query = ${param_num}")
            params.append(data.query.model_dump())
            param_num += 1

        if data.position is not None:
            updates.append(f"position = ${param_num}")
            params.append(data.position.model_dump())
            param_num += 1

        if data.config is not None:
            updates.append(f"config = ${param_num}")
            params.append(data.config)
            param_num += 1

        if not updates:
            return await self.get_widget(widget_id, tenant_id)

        params.extend([uuid.UUID(widget_id), tenant_id])

        query = f"""
            UPDATE prismiq_widgets w
            SET {", ".join(updates)}
            FROM prismiq_dashboards d
            WHERE w.dashboard_id = d.id
            AND w.id = ${param_num}
            AND d.tenant_id = ${param_num + 1}
            RETURNING w.*
        """

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            if not row:
                return None
            return self._row_to_widget(row)

    async def delete_widget(
        self,
        widget_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a widget with tenant check."""
        query = """
            DELETE FROM prismiq_widgets w
            USING prismiq_dashboards d
            WHERE w.dashboard_id = d.id
            AND w.id = $1
            AND d.tenant_id = $2
        """
        async with self._pool.acquire() as conn:
            result = await conn.execute(query, uuid.UUID(widget_id), tenant_id)
            return result == "DELETE 1"

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, Any]],
        tenant_id: str,
    ) -> bool:
        """Batch update widget positions with tenant check."""
        # Verify dashboard belongs to tenant
        dashboard = await self.get_dashboard(dashboard_id, tenant_id)
        if not dashboard:
            return False

        async with self._pool.acquire() as conn:
            async with conn.transaction():
                for pos in positions:
                    widget_id = pos.get("widget_id") or pos.get("id")
                    position = pos.get("position", pos)
                    await conn.execute(
                        """
                        UPDATE prismiq_widgets
                        SET position = $1
                        WHERE id = $2 AND dashboard_id = $3
                        """,
                        {
                            "x": position.get("x", 0),
                            "y": position.get("y", 0),
                            "w": position.get("w", 4),
                            "h": position.get("h", 3),
                        },
                        uuid.UUID(widget_id),
                        uuid.UUID(dashboard_id),
                    )
        return True

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _row_to_dashboard(
        self,
        row: Any,
        widgets: list[Widget] | None = None,
    ) -> Dashboard:
        """Convert a database row to a Dashboard model."""
        import json

        # Parse widgets from JSON if present
        if widgets is None:
            widgets_data = row.get("widgets", [])
            if isinstance(widgets_data, str):
                widgets_data = json.loads(widgets_data)
            widgets = [self._dict_to_widget(w) for w in widgets_data if w]

        # Parse layout
        layout_data = row["layout"]
        if isinstance(layout_data, str):
            layout_data = json.loads(layout_data)

        # Parse filters
        filters_data = row["filters"]
        if isinstance(filters_data, str):
            filters_data = json.loads(filters_data)

        return Dashboard(
            id=str(row["id"]),
            name=row["name"],
            description=row.get("description"),
            layout=DashboardLayout(**layout_data),
            filters=[DashboardFilter(**f) for f in filters_data],
            widgets=widgets,
            owner_id=row.get("owner_id"),
            is_public=row.get("is_public", False),
            allowed_viewers=list(row.get("allowed_viewers", [])),
        )

    def _row_to_widget(self, row: Any) -> Widget:
        """Convert a database row to a Widget model."""
        import json
        from prismiq.types import QueryDefinition

        position_data = row["position"]
        if isinstance(position_data, str):
            position_data = json.loads(position_data)

        query_data = row.get("query")
        if isinstance(query_data, str):
            query_data = json.loads(query_data)

        config_data = row.get("config", {})
        if isinstance(config_data, str):
            config_data = json.loads(config_data)

        return Widget(
            id=str(row["id"]),
            type=WidgetType(row["type"]),
            title=row["title"],
            query=QueryDefinition(**query_data) if query_data else None,
            position=WidgetPosition(**position_data),
            config=config_data,
        )

    def _dict_to_widget(self, data: dict[str, Any]) -> Widget:
        """Convert a dictionary to a Widget model."""
        from prismiq.types import QueryDefinition

        return Widget(
            id=str(data["id"]),
            type=WidgetType(data["type"]),
            title=data["title"],
            query=QueryDefinition(**data["query"]) if data.get("query") else None,
            position=WidgetPosition(**data["position"]),
            config=data.get("config", {}),
        )
```

---

## Task 5: Update DashboardStore Protocol

**File:** Update `packages/python/prismiq/dashboard_store.py`

Add `tenant_id` parameter to all methods in the Protocol:

```python
"""Dashboard storage abstraction."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    Widget,
    WidgetCreate,
    WidgetUpdate,
)


@runtime_checkable
class DashboardStore(Protocol):
    """Protocol for dashboard storage backends."""

    # Dashboard operations
    async def list_dashboards(
        self,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> list[Dashboard]:
        """List dashboards for a tenant."""
        ...

    async def get_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> Dashboard | None:
        """Get a dashboard by ID."""
        ...

    async def create_dashboard(
        self,
        data: DashboardCreate,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> Dashboard:
        """Create a new dashboard."""
        ...

    async def update_dashboard(
        self,
        dashboard_id: str,
        data: DashboardUpdate,
        tenant_id: str,
    ) -> Dashboard | None:
        """Update a dashboard."""
        ...

    async def delete_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a dashboard."""
        ...

    # Widget operations
    async def add_widget(
        self,
        dashboard_id: str,
        data: WidgetCreate,
        tenant_id: str,
    ) -> Widget | None:
        """Add a widget to a dashboard."""
        ...

    async def get_widget(
        self,
        widget_id: str,
        tenant_id: str,
    ) -> Widget | None:
        """Get a widget by ID."""
        ...

    async def update_widget(
        self,
        widget_id: str,
        data: WidgetUpdate,
        tenant_id: str,
    ) -> Widget | None:
        """Update a widget."""
        ...

    async def delete_widget(
        self,
        widget_id: str,
        tenant_id: str,
    ) -> bool:
        """Delete a widget."""
        ...

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, Any]],
        tenant_id: str,
    ) -> bool:
        """Batch update widget positions."""
        ...
```

---

## Task 6: Update InMemoryDashboardStore

**File:** Update `packages/python/prismiq/dashboard_store.py`

Update `InMemoryDashboardStore` to match the new protocol with `tenant_id`:

```python
class InMemoryDashboardStore:
    """In-memory dashboard store for development/testing."""

    def __init__(self) -> None:
        self._dashboards: dict[str, Dashboard] = {}

    async def list_dashboards(
        self,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> list[Dashboard]:
        """List dashboards for a tenant."""
        # Filter by tenant_id (simulated via name prefix for now)
        dashboards = [
            d for d in self._dashboards.values()
            if getattr(d, "tenant_id", tenant_id) == tenant_id
        ]

        if owner_id:
            dashboards = [
                d for d in dashboards
                if d.owner_id == owner_id or d.is_public or owner_id in d.allowed_viewers
            ]

        return sorted(dashboards, key=lambda d: d.name)

    async def get_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
    ) -> Dashboard | None:
        """Get a dashboard by ID with tenant check."""
        dashboard = self._dashboards.get(dashboard_id)
        if dashboard and getattr(dashboard, "tenant_id", tenant_id) == tenant_id:
            return dashboard
        return None

    async def create_dashboard(
        self,
        data: DashboardCreate,
        tenant_id: str,
        owner_id: str | None = None,
    ) -> Dashboard:
        """Create a new dashboard."""
        import uuid
        dashboard_id = str(uuid.uuid4())

        dashboard = Dashboard(
            id=dashboard_id,
            name=data.name,
            description=data.description,
            layout=data.layout or DashboardLayout(),
            filters=[],
            widgets=[],
            owner_id=owner_id,
            is_public=False,
            allowed_viewers=[],
        )
        # Store tenant_id as attribute (hack for in-memory)
        object.__setattr__(dashboard, "tenant_id", tenant_id)

        self._dashboards[dashboard_id] = dashboard
        return dashboard

    # ... update all other methods similarly with tenant_id parameter
```

---

## Task 7: Update Engine to Support PostgreSQL Store

**File:** Update `packages/python/prismiq/engine.py`

```python
class PrismiqEngine:
    """Main Prismiq engine orchestrating all components."""

    def __init__(
        self,
        database_url: str,
        *,
        # Persistence options
        persist_dashboards: bool = True,
        auto_create_tables: bool = True,
        # Existing options...
        allowed_schemas: list[str] | None = None,
        cache_backend: CacheBackend | None = None,
        schema_cache_ttl: int = 3600,
        query_cache_ttl: int = 300,
    ) -> None:
        self._database_url = database_url
        self._persist_dashboards = persist_dashboards
        self._auto_create_tables = auto_create_tables
        # ... rest of init

        self._pool: Pool | None = None
        self._dashboard_store: DashboardStore | None = None

    async def startup(self) -> None:
        """Initialize engine resources."""
        # Create connection pool
        self._pool = await asyncpg.create_pool(self._database_url)

        # Create prismiq tables if needed
        if self._persist_dashboards and self._auto_create_tables:
            from prismiq.persistence.setup import ensure_tables
            await ensure_tables(self._pool)

        # Initialize dashboard store
        if self._persist_dashboards:
            from prismiq.persistence.postgres_store import PostgresDashboardStore
            self._dashboard_store = PostgresDashboardStore(self._pool)
        else:
            from prismiq.dashboard_store import InMemoryDashboardStore
            self._dashboard_store = InMemoryDashboardStore()

        # ... rest of startup

    @property
    def dashboards(self) -> DashboardStore:
        """Get the dashboard store."""
        if not self._dashboard_store:
            raise RuntimeError("Engine not started. Call startup() first.")
        return self._dashboard_store
```

---

## Task 8: Update API Router

**File:** Update `packages/python/prismiq/api.py`

Update all dashboard/widget endpoints to use `tenant_id`:

```python
# For now, use a default tenant until Phase 2 adds proper auth
DEFAULT_TENANT_ID = "default"


def create_router(
    engine: PrismiqEngine,
    dashboard_store: DashboardStore | None = None,
) -> APIRouter:
    """Create Prismiq API router."""
    router = APIRouter()

    # Use engine's dashboard store if not provided
    store = dashboard_store or engine.dashboards

    @router.get("/dashboards")
    async def list_dashboards() -> list[Dashboard]:
        return await store.list_dashboards(tenant_id=DEFAULT_TENANT_ID)

    @router.get("/dashboards/{dashboard_id}")
    async def get_dashboard(dashboard_id: str) -> Dashboard:
        dashboard = await store.get_dashboard(dashboard_id, tenant_id=DEFAULT_TENANT_ID)
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        return dashboard

    @router.post("/dashboards")
    async def create_dashboard(data: DashboardCreate) -> Dashboard:
        return await store.create_dashboard(data, tenant_id=DEFAULT_TENANT_ID)

    # ... update all other endpoints
```

---

## Task 9: Tests for PostgresDashboardStore

**File:** `packages/python/tests/test_postgres_store.py`

```python
"""Tests for PostgresDashboardStore."""

from __future__ import annotations

import pytest
from asyncpg import Pool

from prismiq.persistence.postgres_store import PostgresDashboardStore
from prismiq.persistence.setup import ensure_tables, drop_tables
from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardUpdate,
    DashboardLayout,
    Widget,
    WidgetCreate,
    WidgetUpdate,
    WidgetPosition,
    WidgetType,
)
from prismiq.types import QueryDefinition, QueryTable, QueryColumn


@pytest.fixture
async def pool(database_url: str) -> Pool:
    """Create connection pool for tests."""
    import asyncpg
    pool = await asyncpg.create_pool(database_url)
    yield pool
    await pool.close()


@pytest.fixture
async def store(pool: Pool) -> PostgresDashboardStore:
    """Create store with fresh tables."""
    await drop_tables(pool)
    await ensure_tables(pool)
    yield PostgresDashboardStore(pool)
    await drop_tables(pool)


class TestDashboardCRUD:
    """Test dashboard CRUD operations."""

    async def test_create_dashboard(self, store: PostgresDashboardStore) -> None:
        """Test creating a dashboard."""
        data = DashboardCreate(name="Test Dashboard", description="A test")
        dashboard = await store.create_dashboard(data, tenant_id="tenant1")

        assert dashboard.id is not None
        assert dashboard.name == "Test Dashboard"
        assert dashboard.description == "A test"
        assert dashboard.widgets == []

    async def test_get_dashboard(self, store: PostgresDashboardStore) -> None:
        """Test getting a dashboard by ID."""
        data = DashboardCreate(name="Get Test")
        created = await store.create_dashboard(data, tenant_id="tenant1")

        fetched = await store.get_dashboard(created.id, tenant_id="tenant1")
        assert fetched is not None
        assert fetched.id == created.id
        assert fetched.name == "Get Test"

    async def test_get_dashboard_wrong_tenant(self, store: PostgresDashboardStore) -> None:
        """Test that tenants can't see each other's dashboards."""
        data = DashboardCreate(name="Tenant1 Dashboard")
        created = await store.create_dashboard(data, tenant_id="tenant1")

        # Tenant2 should not see tenant1's dashboard
        fetched = await store.get_dashboard(created.id, tenant_id="tenant2")
        assert fetched is None

    async def test_list_dashboards_by_tenant(self, store: PostgresDashboardStore) -> None:
        """Test listing dashboards is tenant-scoped."""
        await store.create_dashboard(
            DashboardCreate(name="Tenant1 Dash"), tenant_id="tenant1"
        )
        await store.create_dashboard(
            DashboardCreate(name="Tenant2 Dash"), tenant_id="tenant2"
        )

        tenant1_dashboards = await store.list_dashboards(tenant_id="tenant1")
        assert len(tenant1_dashboards) == 1
        assert tenant1_dashboards[0].name == "Tenant1 Dash"

        tenant2_dashboards = await store.list_dashboards(tenant_id="tenant2")
        assert len(tenant2_dashboards) == 1
        assert tenant2_dashboards[0].name == "Tenant2 Dash"

    async def test_update_dashboard(self, store: PostgresDashboardStore) -> None:
        """Test updating a dashboard."""
        data = DashboardCreate(name="Original Name")
        created = await store.create_dashboard(data, tenant_id="tenant1")

        updated = await store.update_dashboard(
            created.id,
            DashboardUpdate(name="New Name", description="Updated"),
            tenant_id="tenant1",
        )

        assert updated is not None
        assert updated.name == "New Name"
        assert updated.description == "Updated"

    async def test_delete_dashboard(self, store: PostgresDashboardStore) -> None:
        """Test deleting a dashboard."""
        data = DashboardCreate(name="To Delete")
        created = await store.create_dashboard(data, tenant_id="tenant1")

        result = await store.delete_dashboard(created.id, tenant_id="tenant1")
        assert result is True

        fetched = await store.get_dashboard(created.id, tenant_id="tenant1")
        assert fetched is None


class TestWidgetCRUD:
    """Test widget CRUD operations."""

    async def test_add_widget(self, store: PostgresDashboardStore) -> None:
        """Test adding a widget to a dashboard."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Widget Test"), tenant_id="tenant1"
        )

        widget_data = WidgetCreate(
            type=WidgetType.METRIC,
            title="Test Metric",
            position=WidgetPosition(x=0, y=0, w=3, h=2),
            query=QueryDefinition(
                tables=[QueryTable(schema="public", table="orders")],
                columns=[QueryColumn(table="orders", column="total", aggregation="SUM")],
            ),
        )

        widget = await store.add_widget(dashboard.id, widget_data, tenant_id="tenant1")
        assert widget is not None
        assert widget.title == "Test Metric"
        assert widget.type == WidgetType.METRIC

    async def test_widgets_loaded_with_dashboard(self, store: PostgresDashboardStore) -> None:
        """Test that widgets are loaded when fetching dashboard."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="With Widgets"), tenant_id="tenant1"
        )

        await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Widget 1",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            tenant_id="tenant1",
        )

        fetched = await store.get_dashboard(dashboard.id, tenant_id="tenant1")
        assert fetched is not None
        assert len(fetched.widgets) == 1
        assert fetched.widgets[0].title == "Widget 1"

    async def test_delete_widget(self, store: PostgresDashboardStore) -> None:
        """Test deleting a widget."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Delete Widget Test"), tenant_id="tenant1"
        )

        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.TABLE,
                title="To Delete",
                position=WidgetPosition(x=0, y=0, w=6, h=4),
            ),
            tenant_id="tenant1",
        )

        result = await store.delete_widget(widget.id, tenant_id="tenant1")
        assert result is True

        fetched = await store.get_widget(widget.id, tenant_id="tenant1")
        assert fetched is None

    async def test_cascade_delete_widgets(self, store: PostgresDashboardStore) -> None:
        """Test that deleting dashboard cascades to widgets."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Cascade Test"), tenant_id="tenant1"
        )

        widget = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.BAR_CHART,
                title="Cascade Widget",
                position=WidgetPosition(x=0, y=0, w=6, h=4),
            ),
            tenant_id="tenant1",
        )

        await store.delete_dashboard(dashboard.id, tenant_id="tenant1")

        fetched_widget = await store.get_widget(widget.id, tenant_id="tenant1")
        assert fetched_widget is None


class TestPositionUpdates:
    """Test batch position updates."""

    async def test_update_positions(self, store: PostgresDashboardStore) -> None:
        """Test batch updating widget positions."""
        dashboard = await store.create_dashboard(
            DashboardCreate(name="Position Test"), tenant_id="tenant1"
        )

        widget1 = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Widget 1",
                position=WidgetPosition(x=0, y=0, w=3, h=2),
            ),
            tenant_id="tenant1",
        )

        widget2 = await store.add_widget(
            dashboard.id,
            WidgetCreate(
                type=WidgetType.METRIC,
                title="Widget 2",
                position=WidgetPosition(x=3, y=0, w=3, h=2),
            ),
            tenant_id="tenant1",
        )

        # Update positions
        await store.update_widget_positions(
            dashboard.id,
            [
                {"widget_id": widget1.id, "position": {"x": 6, "y": 0, "w": 3, "h": 2}},
                {"widget_id": widget2.id, "position": {"x": 0, "y": 2, "w": 6, "h": 4}},
            ],
            tenant_id="tenant1",
        )

        # Verify positions updated
        fetched = await store.get_dashboard(dashboard.id, tenant_id="tenant1")
        assert fetched is not None

        widget1_pos = next(w for w in fetched.widgets if w.id == widget1.id).position
        assert widget1_pos.x == 6

        widget2_pos = next(w for w in fetched.widgets if w.id == widget2.id).position
        assert widget2_pos.y == 2
```

---

## Task 10: E2E Persistence Test

**File:** `examples/demo/frontend/e2e/persistence.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const API = 'http://localhost:8000/api';

test.describe('Database Persistence', () => {
  test('created dashboard persists across API calls', async ({ request }) => {
    // Create a dashboard
    const createResponse = await request.post(`${API}/dashboards`, {
      data: {
        name: `Persistence Test ${Date.now()}`,
        description: 'Testing database persistence',
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const created = await createResponse.json();

    // Fetch it back
    const getResponse = await request.get(`${API}/dashboards/${created.id}`);
    expect(getResponse.ok()).toBeTruthy();
    const fetched = await getResponse.json();

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe(created.name);

    // Cleanup
    await request.delete(`${API}/dashboards/${created.id}`);
  });

  test('widgets persist with dashboard', async ({ request }) => {
    // Create dashboard
    const dashResponse = await request.post(`${API}/dashboards`, {
      data: { name: `Widget Persist Test ${Date.now()}` },
    });
    const dashboard = await dashResponse.json();

    // Add widget
    const widgetResponse = await request.post(
      `${API}/dashboards/${dashboard.id}/widgets`,
      {
        data: {
          type: 'metric',
          title: 'Persisted Metric',
          position: { x: 0, y: 0, w: 3, h: 2 },
        },
      }
    );
    expect(widgetResponse.ok()).toBeTruthy();
    const widget = await widgetResponse.json();

    // Fetch dashboard and verify widget is included
    const getResponse = await request.get(`${API}/dashboards/${dashboard.id}`);
    const fetched = await getResponse.json();

    expect(fetched.widgets.length).toBe(1);
    expect(fetched.widgets[0].id).toBe(widget.id);
    expect(fetched.widgets[0].title).toBe('Persisted Metric');

    // Cleanup
    await request.delete(`${API}/dashboards/${dashboard.id}`);
  });

  test('deleted dashboard is gone', async ({ request }) => {
    // Create
    const createResponse = await request.post(`${API}/dashboards`, {
      data: { name: `Delete Test ${Date.now()}` },
    });
    const dashboard = await createResponse.json();

    // Delete
    const deleteResponse = await request.delete(`${API}/dashboards/${dashboard.id}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify gone
    const getResponse = await request.get(`${API}/dashboards/${dashboard.id}`);
    expect(getResponse.status()).toBe(404);
  });

  test('widget positions persist after update', async ({ request }) => {
    // Create dashboard with widget
    const dashResponse = await request.post(`${API}/dashboards`, {
      data: { name: `Position Test ${Date.now()}` },
    });
    const dashboard = await dashResponse.json();

    const widgetResponse = await request.post(
      `${API}/dashboards/${dashboard.id}/widgets`,
      {
        data: {
          type: 'bar_chart',
          title: 'Movable Chart',
          position: { x: 0, y: 0, w: 6, h: 4 },
        },
      }
    );
    const widget = await widgetResponse.json();

    // Update position
    const updateResponse = await request.patch(
      `${API}/dashboards/${dashboard.id}/layout`,
      {
        data: [
          {
            widget_id: widget.id,
            position: { x: 6, y: 2, w: 6, h: 4 },
          },
        ],
      }
    );
    expect(updateResponse.ok()).toBeTruthy();

    // Verify position updated
    const getResponse = await request.get(`${API}/dashboards/${dashboard.id}`);
    const fetched = await getResponse.json();

    expect(fetched.widgets[0].position.x).toBe(6);
    expect(fetched.widgets[0].position.y).toBe(2);

    // Cleanup
    await request.delete(`${API}/dashboards/${dashboard.id}`);
  });
});
```

---

## Completion Criteria

- [ ] `prismiq_dashboards` and `prismiq_widgets` tables created automatically
- [ ] `PostgresDashboardStore` implements full CRUD for dashboards and widgets
- [ ] All operations scoped by `tenant_id`
- [ ] Widgets cascade delete when dashboard deleted
- [ ] `InMemoryDashboardStore` updated to match new protocol
- [ ] `PrismiqEngine` uses PostgreSQL store by default
- [ ] `persist_dashboards=False` falls back to in-memory store
- [ ] All existing tests pass with new `tenant_id` parameter
- [ ] New `test_postgres_store.py` tests pass
- [ ] E2E persistence tests pass
- [ ] Demo app uses PostgreSQL persistence
