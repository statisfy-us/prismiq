"""SQLAlchemy Core table definitions for Prismiq metadata."""

from __future__ import annotations

from sqlalchemy import (Boolean, Column, ForeignKey, Index, MetaData, String,
                        Table, Text, UniqueConstraint)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP, UUID

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
    Column("allowed_viewers", ARRAY(Text), nullable=False),
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
    Column("config", JSONB, nullable=False),
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
    Column("config", JSONB, nullable=False),
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
    Column("is_shared", Boolean, nullable=False, default=False),
    Column("created_at", TIMESTAMP(timezone=True), nullable=False),
    Column("updated_at", TIMESTAMP(timezone=True), nullable=False),
    UniqueConstraint("tenant_id", "name", name="unique_query_name_per_tenant"),
    Index("idx_saved_queries_tenant", "tenant_id"),
)
