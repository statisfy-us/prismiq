"""SQLAlchemy declarative models for Prismiq tables.

These models are provided for integration with Alembic migrations
and programmatic table creation via ensure_tables_sync().

The declarative base (PrismiqBase) provides a separate metadata object
that can be combined with other SQLAlchemy metadata in multi-tenant
Alembic configurations.

Usage with Alembic:
    from prismiq import PrismiqBase

    # In env.py, add prismiq tables to target_metadata:
    for table in PrismiqBase.metadata.tables.values():
        table.to_metadata(target_metadata)

Usage with sync engines:
    from prismiq import ensure_tables_sync

    with engine.connect() as conn:
        ensure_tables_sync(conn, schema_name="tenant_123")
        conn.commit()
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class PrismiqBase(DeclarativeBase):
    """Base class for all Prismiq models.

    This provides a separate metadata object that can be combined with
    other SQLAlchemy metadata in multi-tenant Alembic configurations.
    """

    pass


def _utcnow() -> datetime:
    """Return current UTC time with timezone."""
    return datetime.now(timezone.utc)


class PrismiqDashboard(PrismiqBase):
    """Dashboard model for storing dashboard metadata.

    Attributes:
        id: Unique dashboard identifier (auto-increment integer)
        tenant_id: Tenant identifier for multi-tenancy
        name: Dashboard display name
        description: Optional description
        layout: Grid layout configuration (columns, rowHeight, margin)
        filters: Dashboard-level filter definitions
        owner_id: User who owns this dashboard
        is_public: Whether dashboard is visible to all tenant users
        allowed_viewers: List of user IDs with view permission
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """

    __tablename__ = "prismiq_dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    layout: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=lambda: {"columns": 12, "rowHeight": 50, "margin": [10, 10]}
    )
    filters: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    owner_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_viewers: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="unique_dashboard_name_per_tenant"),
        Index("idx_dashboards_tenant_id", "tenant_id"),
        Index("idx_dashboards_owner_id", "tenant_id", "owner_id"),
    )


class PrismiqWidget(PrismiqBase):
    """Widget model for storing widget metadata.

    Attributes:
        id: Unique widget identifier (auto-increment integer)
        dashboard_id: Parent dashboard ID (foreign key)
        type: Widget type (bar, line, pie, table, text, etc.)
        title: Widget display title
        query: Query definition (null for text widgets)
        position: Grid position {x, y, w, h}
        config: Widget-specific configuration
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """

    __tablename__ = "prismiq_widgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("prismiq_dashboards.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    query: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    position: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (Index("idx_widgets_dashboard_id", "dashboard_id"),)


class PrismiqSavedQuery(PrismiqBase):
    """Saved query model for reusable query definitions.

    Attributes:
        id: Unique query identifier (auto-increment integer)
        tenant_id: Tenant identifier for multi-tenancy
        name: Query display name
        description: Optional description
        query: Query definition
        owner_id: User who owns this query
        is_shared: Whether query is visible to other tenant users
        created_at: Creation timestamp
        updated_at: Last modification timestamp
    """

    __tablename__ = "prismiq_saved_queries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    query: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    owner_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="unique_query_name_per_tenant"),
        Index("idx_saved_queries_tenant", "tenant_id"),
    )


class PrismiqPinnedDashboard(PrismiqBase):
    """Tracks which dashboards are pinned to which contexts.

    Pins allow users to save dashboards to system-defined contexts
    (e.g., "dashboard", "accounts", "home") for quick access.

    Attributes:
        id: Unique pin identifier (auto-increment integer)
        tenant_id: Tenant identifier for multi-tenancy
        user_id: User who created the pin
        dashboard_id: Dashboard that is pinned (foreign key)
        context: Context identifier (e.g., "dashboard", "accounts")
        position: Order position within the context (0-based)
        pinned_at: Timestamp when the pin was created
    """

    __tablename__ = "prismiq_pinned_dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    dashboard_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("prismiq_dashboards.id", ondelete="CASCADE"),
        nullable=False,
    )
    context: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pinned_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=_utcnow
    )

    __table_args__ = (
        # Each user can only pin a dashboard once per context
        UniqueConstraint(
            "tenant_id", "user_id", "dashboard_id", "context", name="unique_pin_per_context"
        ),
        Index("idx_pinned_tenant_user_context", "tenant_id", "user_id", "context"),
        Index("idx_pinned_dashboard", "dashboard_id"),
    )
