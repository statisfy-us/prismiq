"""PostgreSQL-backed dashboard storage with tenant isolation."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Column,
    Integer,
    MetaData,
    String,
    Table,
    delete,
    exists,
    func,
    insert,
    not_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP

from prismiq.dashboards import (
    Dashboard,
    DashboardCreate,
    DashboardFilter,
    DashboardLayout,
    DashboardUpdate,
    Widget,
    WidgetConfig,
    WidgetCreate,
    WidgetPosition,
    WidgetType,
    WidgetUpdate,
)
from prismiq.pins import PinnedDashboard
from prismiq.types import QueryDefinition

if TYPE_CHECKING:
    from asyncpg import Pool  # type: ignore[import-not-found]

_logger = logging.getLogger(__name__)

# SQLAlchemy Table definition for pinned dashboards (used for query generation)
# quote=True ensures all identifiers are double-quoted in generated SQL
# Note: IDs are Integer (autoincrement) to match Alembic migration
_metadata = MetaData()
_pinned_dashboards_table = Table(
    "prismiq_pinned_dashboards",
    _metadata,
    Column("id", Integer, primary_key=True, autoincrement=True, quote=True),
    Column("tenant_id", String(255), nullable=False, quote=True),
    Column("user_id", String(255), nullable=False, quote=True),
    Column("dashboard_id", Integer, nullable=False, quote=True),
    Column("context", String(100), nullable=False, quote=True),
    Column("position", Integer, nullable=False, quote=True),
    Column("pinned_at", TIMESTAMP(timezone=True), nullable=False, quote=True),
    quote=True,
)


class PostgresDashboardStore:
    """PostgreSQL-backed dashboard storage with tenant isolation.

    All operations are scoped to a tenant_id for multi-tenant security.
    Supports per-tenant PostgreSQL schema isolation via schema_name
    parameter.
    """

    def __init__(self, pool: Pool) -> None:
        """Initialize PostgresDashboardStore.

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
            # Use double-quoted identifiers to handle schema names with special chars
            # Escape double quotes to prevent SQL injection
            escaped_schema = schema_name.replace('"', '""')
            sql = f'SET search_path TO "{escaped_schema}", public'
            _logger.info(f"[postgres_store] Setting search_path: {sql}")
            await conn.execute(sql)
        else:
            # Explicitly set to public when no schema_name provided
            _logger.info("[postgres_store] Setting search_path: SET search_path TO public")
            await conn.execute("SET search_path TO public")

    # -------------------------------------------------------------------------
    # Dashboard Operations
    # -------------------------------------------------------------------------

    async def list_dashboards(
        self,
        tenant_id: str,
        owner_id: str | None = None,
        schema_name: str | None = None,
    ) -> list[Dashboard]:
        """List all dashboards for a tenant.

        Args:
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID to filter by access.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
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
                            'config', w.config,
                            'created_at', w.created_at,
                            'updated_at', w.updated_at
                        )
                        ORDER BY (w.position->>'y')::int, (w.position->>'x')::int
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
            await self._set_search_path(conn, schema_name)
            # Debug: verify current search_path
            current_path = await conn.fetchval("SHOW search_path")
            _logger.info(f"[postgres_store] Current search_path: {current_path}")
            rows = await conn.fetch(query, *params)
            return [self._row_to_dashboard(row) for row in rows]

    async def get_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Dashboard | None:
        """Get a dashboard by ID with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
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
                            'config', w.config,
                            'created_at', w.created_at,
                            'updated_at', w.updated_at
                        )
                        ORDER BY (w.position->>'y')::int, (w.position->>'x')::int
                    ) FILTER (WHERE w.id IS NOT NULL),
                    '[]'
                ) as widgets
            FROM prismiq_dashboards d
            LEFT JOIN prismiq_widgets w ON w.dashboard_id = d.id
            WHERE d.id = $1 AND d.tenant_id = $2
            GROUP BY d.id
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, int(dashboard_id), tenant_id)
            if not row:
                return None
            return self._row_to_dashboard(row)

    async def create_dashboard(
        self,
        dashboard: DashboardCreate,
        tenant_id: str,
        owner_id: str | None = None,
        schema_name: str | None = None,
    ) -> Dashboard:
        """Create a new dashboard.

        Args:
            dashboard: Dashboard data to create.
            tenant_id: Tenant ID for isolation.
            owner_id: Optional owner ID.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        now = datetime.now(timezone.utc)
        layout = dashboard.layout or DashboardLayout()

        # Don't specify id - let PostgreSQL SERIAL auto-generate it
        query = """
            INSERT INTO prismiq_dashboards
            (tenant_id, name, description, layout, filters, owner_id, is_public, allowed_viewers, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(
                query,
                tenant_id,
                dashboard.name,
                dashboard.description,
                json.dumps(layout.model_dump()),
                json.dumps([]),  # Empty filters initially
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
        update: DashboardUpdate,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Dashboard | None:
        """Update a dashboard with tenant check.

        Args:
            dashboard_id: The dashboard ID to update.
            update: Update data.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Build dynamic UPDATE based on provided fields
        updates: list[str] = []
        params: list[Any] = []
        param_num = 1

        if update.name is not None:
            updates.append(f"name = ${param_num}")
            params.append(update.name)
            param_num += 1

        if update.description is not None:
            updates.append(f"description = ${param_num}")
            params.append(update.description)
            param_num += 1

        if update.layout is not None:
            updates.append(f"layout = ${param_num}")
            params.append(json.dumps(update.layout.model_dump()))
            param_num += 1

        if update.filters is not None:
            updates.append(f"filters = ${param_num}")
            params.append(json.dumps([f.model_dump() for f in update.filters]))
            param_num += 1

        if update.is_public is not None:
            updates.append(f"is_public = ${param_num}")
            params.append(update.is_public)
            param_num += 1

        if update.allowed_viewers is not None:
            updates.append(f"allowed_viewers = ${param_num}")
            params.append(update.allowed_viewers)
            param_num += 1

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            # Handle widgets update if provided (replace all widgets)
            if update.widgets is not None:
                # Delete existing widgets
                await conn.execute(
                    "DELETE FROM prismiq_widgets WHERE dashboard_id = $1",
                    int(dashboard_id),
                )
                # Insert new widgets (let autoincrement generate IDs)
                for widget in update.widgets:
                    await conn.execute(
                        """
                        INSERT INTO prismiq_widgets (
                            dashboard_id, title, type, query, config, position
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        int(dashboard_id),
                        widget.title,
                        widget.type.value,
                        json.dumps(widget.query.model_dump()) if widget.query else None,
                        json.dumps(widget.config.model_dump()) if widget.config else None,
                        json.dumps(widget.position.model_dump()) if widget.position else None,
                    )

            if not updates:
                # No dashboard metadata updates, just return current dashboard
                return await self.get_dashboard(dashboard_id, tenant_id, schema_name)

            # Add dashboard_id and tenant_id as final params
            params.extend([int(dashboard_id), tenant_id])

            # Column names in `updates` are hardcoded above, not user input
            query = f"""
                UPDATE prismiq_dashboards
                SET {", ".join(updates)}
                WHERE id = ${param_num} AND tenant_id = ${param_num + 1}
                RETURNING *
            """  # noqa: S608

            row = await conn.fetchrow(query, *params)
            if not row:
                return None
            # Fetch with widgets
            return await self.get_dashboard(dashboard_id, tenant_id, schema_name)

    async def delete_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Delete a dashboard with tenant check.

        Widgets cascade delete.

        Args:
            dashboard_id: The dashboard ID to delete.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        query = "DELETE FROM prismiq_dashboards WHERE id = $1 AND tenant_id = $2"
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.execute(query, int(dashboard_id), tenant_id)
            return result == "DELETE 1"

    # -------------------------------------------------------------------------
    # Widget Operations
    # -------------------------------------------------------------------------

    async def add_widget(
        self,
        dashboard_id: str,
        widget: WidgetCreate,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Widget | None:
        """Add a widget to a dashboard with tenant check.

        Args:
            dashboard_id: The dashboard ID to add to.
            widget: Widget data to create.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Verify dashboard belongs to tenant
        dashboard = await self.get_dashboard(dashboard_id, tenant_id, schema_name)
        if not dashboard:
            return None

        now = datetime.now(timezone.utc)

        # Don't specify id - let PostgreSQL SERIAL auto-generate it
        query = """
            INSERT INTO prismiq_widgets
            (dashboard_id, type, title, query, position, config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(
                query,
                int(dashboard_id),
                widget.type.value,
                widget.title,
                json.dumps(widget.query.model_dump()) if widget.query else None,
                json.dumps(widget.position.model_dump()),
                json.dumps((widget.config or WidgetConfig()).model_dump()),
                now,
                now,
            )
            return self._row_to_widget(row)

    async def get_widget(
        self,
        widget_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Widget | None:
        """Get a widget by ID with tenant check via dashboard.

        Args:
            widget_id: The widget ID.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        query = """
            SELECT w.*
            FROM prismiq_widgets w
            JOIN prismiq_dashboards d ON d.id = w.dashboard_id
            WHERE w.id = $1 AND d.tenant_id = $2
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, int(widget_id), tenant_id)
            if not row:
                return None
            return self._row_to_widget(row)

    async def update_widget(
        self,
        widget_id: str,
        update: WidgetUpdate,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Widget | None:
        """Update a widget with tenant check.

        Args:
            widget_id: The widget ID to update.
            update: Update data.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Build dynamic UPDATE
        updates: list[str] = []
        params: list[Any] = []
        param_num = 1

        if update.title is not None:
            updates.append(f"title = ${param_num}")
            params.append(update.title)
            param_num += 1

        if update.query is not None:
            updates.append(f"query = ${param_num}")
            params.append(json.dumps(update.query.model_dump()))
            param_num += 1

        if update.position is not None:
            updates.append(f"position = ${param_num}")
            params.append(json.dumps(update.position.model_dump()))
            param_num += 1

        if update.config is not None:
            updates.append(f"config = ${param_num}")
            params.append(json.dumps(update.config.model_dump()))
            param_num += 1

        if not updates:
            return await self.get_widget(widget_id, tenant_id, schema_name)

        params.extend([int(widget_id), tenant_id])

        # Column names in `updates` are hardcoded above, not user input
        query = f"""
            UPDATE prismiq_widgets w
            SET {", ".join(updates)}
            FROM prismiq_dashboards d
            WHERE w.dashboard_id = d.id
            AND w.id = ${param_num}
            AND d.tenant_id = ${param_num + 1}
            RETURNING w.*
        """  # noqa: S608

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, *params)
            if not row:
                return None
            return self._row_to_widget(row)

    async def delete_widget(
        self,
        widget_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Delete a widget with tenant check.

        Args:
            widget_id: The widget ID to delete.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        query = """
            DELETE FROM prismiq_widgets w
            USING prismiq_dashboards d
            WHERE w.dashboard_id = d.id
            AND w.id = $1
            AND d.tenant_id = $2
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.execute(query, int(widget_id), tenant_id)
            return result == "DELETE 1"

    async def duplicate_widget(
        self,
        widget_id: str,
        tenant_id: str,
        schema_name: str | None = None,
    ) -> Widget | None:
        """Duplicate a widget with tenant check.

        Args:
            widget_id: The widget ID to duplicate.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Get the original widget
        original = await self.get_widget(widget_id, tenant_id, schema_name)
        if not original:
            return None

        # Get the dashboard_id from the original widget
        query = """
            SELECT dashboard_id FROM prismiq_widgets WHERE id = $1
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(query, int(widget_id))
            if not row:
                return None
            dashboard_id = row["dashboard_id"]  # Keep as int

        # Create a new widget with copied data
        now = datetime.now(timezone.utc)

        # Offset position slightly
        new_position = WidgetPosition(
            x=original.position.x + 1,
            y=original.position.y,
            w=original.position.w,
            h=original.position.h,
        )

        # Don't specify id - let PostgreSQL SERIAL auto-generate it
        insert_query = """
            INSERT INTO prismiq_widgets
            (dashboard_id, type, title, query, position, config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        """
        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            row = await conn.fetchrow(
                insert_query,
                int(dashboard_id),
                original.type.value,
                f"{original.title} (Copy)",
                json.dumps(original.query.model_dump()) if original.query else None,
                json.dumps(new_position.model_dump()),
                json.dumps(original.config.model_dump()),
                now,
                now,
            )
            return self._row_to_widget(row)

    async def update_widget_positions(
        self,
        dashboard_id: str,
        positions: list[dict[str, Any]],
        tenant_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Batch update widget positions with tenant check.

        Args:
            dashboard_id: The dashboard ID.
            positions: List of position updates.
            tenant_id: Tenant ID for isolation.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.
        """
        # Verify dashboard belongs to tenant
        dashboard = await self.get_dashboard(dashboard_id, tenant_id, schema_name)
        if not dashboard:
            return False

        async with self._pool.acquire() as conn, conn.transaction():
            await self._set_search_path(conn, schema_name)
            for pos in positions:
                widget_id = pos.get("widget_id") or pos.get("id")
                if widget_id is None:
                    continue
                position = pos.get("position", pos)
                await conn.execute(
                    """
                        UPDATE prismiq_widgets
                        SET position = $1
                        WHERE id = $2 AND dashboard_id = $3
                        """,
                    json.dumps(
                        {
                            "x": position.get("x", 0),
                            "y": position.get("y", 0),
                            "w": position.get("w", 4),
                            "h": position.get("h", 3),
                        }
                    ),
                    int(widget_id),
                    int(dashboard_id),
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
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    def _row_to_widget(self, row: Any) -> Widget:
        """Convert a database row to a Widget model."""
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
            config=WidgetConfig(**config_data) if config_data else WidgetConfig(),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    def _dict_to_widget(self, data: dict[str, Any]) -> Widget:
        """Convert a dictionary to a Widget model."""
        query_data = data.get("query")
        config_data = data.get("config", {})
        now = datetime.now(timezone.utc)

        return Widget(
            id=str(data["id"]),
            type=WidgetType(data["type"]),
            title=data["title"],
            query=QueryDefinition(**query_data) if query_data else None,
            position=WidgetPosition(**data["position"]),
            config=WidgetConfig(**config_data) if config_data else WidgetConfig(),
            created_at=data.get("created_at") or now,
            updated_at=data.get("updated_at") or now,
        )

    # -------------------------------------------------------------------------
    # Pin Operations
    # -------------------------------------------------------------------------

    async def pin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
        position: int | None = None,
        schema_name: str | None = None,
    ) -> PinnedDashboard:
        """Pin a dashboard to a context.

        Args:
            dashboard_id: The dashboard ID to pin.
            context: The context to pin to.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who is pinning.
            position: Optional position. If None, appends at end.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            The created PinnedDashboard entry.

        Raises:
            ValueError: If dashboard not found or already pinned.
        """
        # Verify dashboard exists and belongs to tenant
        dashboard = await self.get_dashboard(dashboard_id, tenant_id, schema_name)
        if not dashboard:
            raise ValueError(f"Dashboard '{dashboard_id}' not found")

        t = _pinned_dashboards_table

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            # Determine position if not provided using SQLAlchemy Core
            if position is None:
                max_pos_query = select(func.coalesce(func.max(t.c.position) + 1, 0)).where(
                    t.c.tenant_id == tenant_id,
                    t.c.user_id == user_id,
                    t.c.context == context,
                )
                sql, params = self._compile_query(max_pos_query)
                result = await conn.fetchval(sql, *params)
                position = int(result)

            now = datetime.now(timezone.utc)

            # Build INSERT using SQLAlchemy Core (let autoincrement generate id)
            insert_stmt = (
                insert(t)
                .values(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    dashboard_id=int(dashboard_id),
                    context=context,
                    position=position,
                    pinned_at=now,
                )
                .returning(*t.c)
            )
            insert_sql, insert_params = self._compile_query(insert_stmt)

            try:
                row = await conn.fetchrow(insert_sql, *insert_params)
            except Exception as e:
                # Unique constraint violation means already pinned
                if "unique_pin_per_context" in str(e):
                    raise ValueError(
                        f"Dashboard '{dashboard_id}' already pinned to context '{context}'"
                    ) from e
                raise

            return self._row_to_pinned_dashboard(row)

    async def unpin_dashboard(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Unpin a dashboard from a context.

        Args:
            dashboard_id: The dashboard ID to unpin.
            context: The context to unpin from.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pin.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            True if unpinned, False if not found.
        """
        t = _pinned_dashboards_table
        stmt = delete(t).where(
            t.c.tenant_id == tenant_id,
            t.c.user_id == user_id,
            t.c.dashboard_id == int(dashboard_id),
            t.c.context == context,
        )
        sql, params = self._compile_query(stmt)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.execute(sql, *params)
            return result == "DELETE 1"

    async def get_pinned_dashboards(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> list[Dashboard]:
        """Get all dashboards pinned to a context.

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            List of Dashboard objects, ordered by position.
        """
        # Get pinned dashboard IDs in order
        t = _pinned_dashboards_table
        stmt = (
            select(t.c.dashboard_id)
            .where(
                t.c.tenant_id == tenant_id,
                t.c.user_id == user_id,
                t.c.context == context,
            )
            .order_by(t.c.position)
        )
        sql, params = self._compile_query(stmt)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            rows = await conn.fetch(sql, *params)

        # Fetch each dashboard
        dashboards: list[Dashboard] = []
        for row in rows:
            dashboard = await self.get_dashboard(str(row["dashboard_id"]), tenant_id, schema_name)
            if dashboard:
                dashboards.append(dashboard)

        return dashboards

    async def get_pin_contexts_for_dashboard(
        self,
        dashboard_id: str,
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> list[str]:
        """Get all contexts where a dashboard is pinned.

        Args:
            dashboard_id: The dashboard ID.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            List of context names.
        """
        t = _pinned_dashboards_table
        stmt = (
            select(t.c.context)
            .where(
                t.c.tenant_id == tenant_id,
                t.c.user_id == user_id,
                t.c.dashboard_id == int(dashboard_id),
            )
            .order_by(t.c.context)
        )
        sql, params = self._compile_query(stmt)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            rows = await conn.fetch(sql, *params)
            return [row["context"] for row in rows]

    async def reorder_pins(
        self,
        context: str,
        dashboard_ids: list[str],
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Reorder pinned dashboards in a context.

        Pins specified in dashboard_ids get positions 0..N-1 in that order.
        Any remaining pins not in dashboard_ids retain their relative order
        and get positions starting at N.

        Args:
            context: The context to reorder.
            dashboard_ids: Ordered list of dashboard IDs for the new order.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            True if reordered, False otherwise.
        """
        t = _pinned_dashboards_table

        # Convert provided IDs to UUIDs
        provided_ids = [int(d_id) for d_id in dashboard_ids]

        async with self._pool.acquire() as conn, conn.transaction():
            await self._set_search_path(conn, schema_name)
            # First, get any remaining pins not in dashboard_ids, ordered by current position
            if provided_ids:
                remaining_stmt = (
                    select(t.c.dashboard_id)
                    .where(
                        t.c.tenant_id == tenant_id,
                        t.c.user_id == user_id,
                        t.c.context == context,
                        not_(t.c.dashboard_id.in_(provided_ids)),
                    )
                    .order_by(t.c.position)
                )
            else:
                # No provided IDs, get all pins ordered by position
                remaining_stmt = (
                    select(t.c.dashboard_id)
                    .where(
                        t.c.tenant_id == tenant_id,
                        t.c.user_id == user_id,
                        t.c.context == context,
                    )
                    .order_by(t.c.position)
                )

            remaining_sql, remaining_params = self._compile_query(remaining_stmt)
            remaining_rows = await conn.fetch(remaining_sql, *remaining_params)
            remaining_uuids = [row["dashboard_id"] for row in remaining_rows]

            # Build combined list: provided IDs first, then remaining IDs
            all_uuids = provided_ids + remaining_uuids

            # Update positions for all pins
            for i, d_uuid in enumerate(all_uuids):
                stmt = (
                    update(t)
                    .where(
                        t.c.tenant_id == tenant_id,
                        t.c.user_id == user_id,
                        t.c.context == context,
                        t.c.dashboard_id == d_uuid,
                    )
                    .values(position=i)
                )
                sql, params = self._compile_query(stmt)
                await conn.execute(sql, *params)

        return True

    async def is_dashboard_pinned(
        self,
        dashboard_id: str,
        context: str,
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> bool:
        """Check if a dashboard is pinned to a context.

        Args:
            dashboard_id: The dashboard ID.
            context: The context to check.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            True if pinned, False otherwise.
        """
        t = _pinned_dashboards_table
        subquery = select(t.c.id).where(
            t.c.tenant_id == tenant_id,
            t.c.user_id == user_id,
            t.c.context == context,
            t.c.dashboard_id == int(dashboard_id),
        )
        stmt = select(exists(subquery))
        sql, params = self._compile_query(stmt)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            result = await conn.fetchval(sql, *params)
            return bool(result)

    async def get_pins_for_context(
        self,
        context: str,
        tenant_id: str,
        user_id: str,
        schema_name: str | None = None,
    ) -> list[PinnedDashboard]:
        """Get pin entries for a context (for API responses).

        Args:
            context: The context to get pins for.
            tenant_id: Tenant ID for isolation.
            user_id: User ID who owns the pins.
            schema_name: PostgreSQL schema name for per-tenant schema isolation.

        Returns:
            List of PinnedDashboard entries, ordered by position.
        """
        t = _pinned_dashboards_table
        stmt = (
            select(t)
            .where(
                t.c.tenant_id == tenant_id,
                t.c.user_id == user_id,
                t.c.context == context,
            )
            .order_by(t.c.position)
        )
        sql, params = self._compile_query(stmt)

        async with self._pool.acquire() as conn:
            await self._set_search_path(conn, schema_name)
            rows = await conn.fetch(sql, *params)
            return [self._row_to_pinned_dashboard(row) for row in rows]

    def _row_to_pinned_dashboard(self, row: Any) -> PinnedDashboard:
        """Convert a database row to a PinnedDashboard model."""
        return PinnedDashboard(
            id=str(row["id"]),
            dashboard_id=str(row["dashboard_id"]),
            context=row["context"],
            position=row["position"],
            pinned_at=row["pinned_at"],
        )

    @staticmethod
    def _compile_query(stmt: Any) -> tuple[str, list[Any]]:
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
