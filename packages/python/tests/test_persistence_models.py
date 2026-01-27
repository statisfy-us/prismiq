"""Tests for Prismiq SQLAlchemy declarative models."""

from __future__ import annotations

from sqlalchemy import inspect

from prismiq import (
    PrismiqBase,
    PrismiqDashboard,
    PrismiqPinnedDashboard,
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
        """Metadata should contain all 4 prismiq tables."""
        table_names = list(PrismiqBase.metadata.tables.keys())
        assert "prismiq_dashboards" in table_names
        assert "prismiq_widgets" in table_names
        assert "prismiq_saved_queries" in table_names
        assert "prismiq_pinned_dashboards" in table_names
        assert len(table_names) == 4


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


class TestPrismiqPinnedDashboard:
    """Test PrismiqPinnedDashboard model definition."""

    def test_table_name(self) -> None:
        """PinnedDashboard should have correct table name."""
        assert PrismiqPinnedDashboard.__tablename__ == "prismiq_pinned_dashboards"

    def test_has_required_columns(self) -> None:
        """PinnedDashboard should have all required columns."""
        mapper = inspect(PrismiqPinnedDashboard)
        column_names = [c.key for c in mapper.columns]
        required = [
            "id",
            "tenant_id",
            "user_id",
            "dashboard_id",
            "context",
            "position",
            "pinned_at",
        ]
        for col in required:
            assert col in column_names, f"Missing column: {col}"

    def test_has_foreign_key(self) -> None:
        """PinnedDashboard should have foreign key to dashboards."""
        table = PrismiqBase.metadata.tables["prismiq_pinned_dashboards"]
        fk_columns = [fk.parent.name for fk in table.foreign_keys]
        assert "dashboard_id" in fk_columns

    def test_has_indexes(self) -> None:
        """PinnedDashboard should have required indexes."""
        table = PrismiqBase.metadata.tables["prismiq_pinned_dashboards"]
        index_names = [idx.name for idx in table.indexes]
        assert "idx_pinned_tenant_user_context" in index_names
        assert "idx_pinned_dashboard" in index_names

    def test_has_unique_constraint(self) -> None:
        """PinnedDashboard should have unique constraint on (tenant_id, user_id, dashboard_id, context)."""
        table = PrismiqBase.metadata.tables["prismiq_pinned_dashboards"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name") and c.name]
        assert "unique_pin_per_context" in constraint_names


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


class TestTableCreationError:
    """Test TableCreationError exception."""

    def test_exception_exists(self) -> None:
        """TableCreationError should be importable from prismiq."""
        from prismiq import TableCreationError

        assert issubclass(TableCreationError, Exception)

    def test_exception_can_be_raised(self) -> None:
        """TableCreationError should be raisable with a message."""
        import pytest

        from prismiq import TableCreationError

        with pytest.raises(TableCreationError, match="test error"):
            raise TableCreationError("test error")


class TestSchemaNameValidation:
    """Test schema name validation in ensure_tables_sync."""

    def test_empty_schema_name_rejected(self) -> None:
        """Empty schema name should raise ValueError."""
        import pytest

        from prismiq.persistence.setup import _validate_schema_name

        with pytest.raises(ValueError, match="cannot be empty"):
            _validate_schema_name("")

    def test_invalid_characters_rejected(self) -> None:
        """Schema names with special characters should raise ValueError."""
        import pytest

        from prismiq.persistence.setup import _validate_schema_name

        invalid_names = ["my-schema", "my.schema", "my schema", "123_schema", "@schema"]
        for name in invalid_names:
            with pytest.raises(ValueError, match="Invalid schema name"):
                _validate_schema_name(name)

    def test_reserved_schemas_rejected(self) -> None:
        """Reserved schema names should raise ValueError."""
        import pytest

        from prismiq.persistence.setup import _validate_schema_name

        reserved = ["public", "information_schema", "pg_catalog", "pg_toast"]
        for name in reserved:
            with pytest.raises(ValueError, match="reserved schema"):
                _validate_schema_name(name)

    def test_valid_schema_names_accepted(self) -> None:
        """Valid schema names should not raise."""
        from prismiq.persistence.setup import _validate_schema_name

        valid_names = [
            "tenant_123",
            "org_abc",
            "_private",
            "MySchema",
            "UPPERCASE",
            "a",
            "tenant_1_2_3",
        ]
        for name in valid_names:
            _validate_schema_name(name)  # Should not raise


class TestUniqueConstraints:
    """Test unique constraints on models."""

    def test_dashboard_unique_constraint_exists(self) -> None:
        """Dashboard should have unique constraint on (tenant_id, name)."""
        table = PrismiqBase.metadata.tables["prismiq_dashboards"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name") and c.name]
        assert "unique_dashboard_name_per_tenant" in constraint_names

    def test_saved_query_unique_constraint_exists(self) -> None:
        """SavedQuery should have unique constraint on (tenant_id, name)."""
        table = PrismiqBase.metadata.tables["prismiq_saved_queries"]
        constraint_names = [c.name for c in table.constraints if hasattr(c, "name") and c.name]
        assert "unique_query_name_per_tenant" in constraint_names


class TestForeignKeyBehavior:
    """Test foreign key configuration."""

    def test_widget_foreign_key_has_cascade_delete(self) -> None:
        """Widget foreign key should have ON DELETE CASCADE."""
        table = PrismiqBase.metadata.tables["prismiq_widgets"]
        fk = next(iter(table.foreign_keys))
        assert fk.ondelete == "CASCADE"
