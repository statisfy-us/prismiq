"""Database persistence layer for Prismiq."""

from __future__ import annotations

from prismiq.persistence.models import (
    PrismiqBase,
    PrismiqDashboard,
    PrismiqPinnedDashboard,
    PrismiqSavedQuery,
    PrismiqWidget,
)
from prismiq.persistence.postgres_store import PostgresDashboardStore
from prismiq.persistence.saved_query_store import SavedQueryStore
from prismiq.persistence.setup import (
    TableCreationError,
    drop_tables,
    ensure_tables,
    ensure_tables_sync,
    table_exists,
)
from prismiq.persistence.tables import (
    dashboards_table,
    metadata,
    saved_queries_table,
    widgets_table,
)

__all__ = [
    "PostgresDashboardStore",
    "PrismiqBase",
    "PrismiqDashboard",
    "PrismiqPinnedDashboard",
    "PrismiqSavedQuery",
    "PrismiqWidget",
    "SavedQueryStore",
    "TableCreationError",
    "dashboards_table",
    "drop_tables",
    "ensure_tables",
    "ensure_tables_sync",
    "metadata",
    "saved_queries_table",
    "table_exists",
    "widgets_table",
]
