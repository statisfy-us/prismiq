"""Tests for Prismiq SQLAlchemy declarative models."""

from __future__ import annotations

from sqlalchemy import inspect

from prismiq import (
    PrismiqBase,
    PrismiqDashboard,
    PrismiqSavedQuery,
    PrismiqWidget,
)


class TestPrismiqModels:
    """Test that declarative models are correctly defined."""

    def test_prismiq_base_has_metadata(self) -> None:
        """PrismiqBase should have a metadata object."""
        assert hasattr(PrismiqBase, "metadata")
        assert PrismiqBase.metadata is not None

    def test_metadata_contains_all_tables(self) -> None:
        """Metadata should contain all 3 prismiq tables."""
        table_names = list(PrismiqBase.metadata.tables.keys())
        assert "prismiq_dashboards" in table_names
        assert "prismiq_widgets" in table_names
        assert "prismiq_saved_queries" in table_names
        assert len(table_names) == 3


class TestPrismiqDashboard:
    """Test PrismiqDashboard model definition."""

    def test_table_name(self) -> None:
        """Dashboard should have correct table name."""
        assert PrismiqDashboard.__tablename__ == "prismiq_dashboards"

    def test_has_required_columns(self) -> None:
        """Dashboard should have all required columns."""
        mapper = inspect(PrismiqDashboard)
        column_names = [c.key for c in mapper.columns]
        required = [
            "id",
            "tenant_id",
            "name",
            "description",
            "layout",
            "filters",
            "owner_id",
            "is_public",
            "allowed_viewers",
            "created_at",
            "updated_at",
        ]
        for col in required:
            assert col in column_names, f"Missing column: {col}"

    def test_has_indexes(self) -> None:
        """Dashboard should have tenant_id and owner_id indexes."""
        table = PrismiqBase.metadata.tables["prismiq_dashboards"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_dashboards_tenant_id" in index_names
        assert "idx_dashboards_owner_id" in index_names


class TestPrismiqWidget:
    """Test PrismiqWidget model definition."""

    def test_table_name(self) -> None:
        """Widget should have correct table name."""
        assert PrismiqWidget.__tablename__ == "prismiq_widgets"

    def test_has_required_columns(self) -> None:
        """Widget should have all required columns."""
        mapper = inspect(PrismiqWidget)
        column_names = [c.key for c in mapper.columns]
        required = [
            "id",
            "dashboard_id",
            "type",
            "title",
            "query",
            "position",
            "config",
            "created_at",
            "updated_at",
        ]
        for col in required:
            assert col in column_names, f"Missing column: {col}"

    def test_has_foreign_key(self) -> None:
        """Widget should have foreign key to dashboards."""
        table = PrismiqBase.metadata.tables["prismiq_widgets"]
        fk_columns = [fk.parent.name for fk in table.foreign_keys]
        assert "dashboard_id" in fk_columns

    def test_has_indexes(self) -> None:
        """Widget should have dashboard_id index."""
        table = PrismiqBase.metadata.tables["prismiq_widgets"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_widgets_dashboard_id" in index_names


class TestPrismiqSavedQuery:
    """Test PrismiqSavedQuery model definition."""

    def test_table_name(self) -> None:
        """SavedQuery should have correct table name."""
        assert PrismiqSavedQuery.__tablename__ == "prismiq_saved_queries"

    def test_has_required_columns(self) -> None:
        """SavedQuery should have all required columns."""
        mapper = inspect(PrismiqSavedQuery)
        column_names = [c.key for c in mapper.columns]
        required = [
            "id",
            "tenant_id",
            "name",
            "description",
            "query",
            "owner_id",
            "is_shared",
            "created_at",
            "updated_at",
        ]
        for col in required:
            assert col in column_names, f"Missing column: {col}"

    def test_has_indexes(self) -> None:
        """SavedQuery should have tenant index."""
        table = PrismiqBase.metadata.tables["prismiq_saved_queries"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_saved_queries_tenant" in index_names


class TestEnsureTablesSync:
    """Test ensure_tables_sync function."""

    def test_function_exists(self) -> None:
        """ensure_tables_sync should be importable from prismiq."""
        from prismiq import ensure_tables_sync

        assert callable(ensure_tables_sync)

    def test_function_signature(self) -> None:
        """ensure_tables_sync should accept connection and schema_name."""
        from inspect import signature

        from prismiq import ensure_tables_sync

        sig = signature(ensure_tables_sync)
        params = list(sig.parameters.keys())
        assert "connection" in params
        assert "schema_name" in params
