"""Database persistence layer for Prismiq."""

from prismiq.persistence.postgres_store import PostgresDashboardStore
from prismiq.persistence.saved_query_store import SavedQueryStore
from prismiq.persistence.setup import drop_tables, ensure_tables, table_exists
from prismiq.persistence.tables import (dashboards_table, metadata,
                                        saved_queries_table,
                                        schema_config_table, widgets_table)

__all__ = [
    "PostgresDashboardStore",
    "SavedQueryStore",
    "dashboards_table",
    "drop_tables",
    "ensure_tables",
    "metadata",
    "saved_queries_table",
    "schema_config_table",
    "table_exists",
    "widgets_table",
]
