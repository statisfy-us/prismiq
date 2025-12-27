"""Tests for schema customization."""

from __future__ import annotations

import json

import pytest

from prismiq.schema_config import (
    ColumnConfig,
    EnhancedColumnSchema,
    EnhancedDatabaseSchema,
    EnhancedTableSchema,
    SchemaConfig,
    SchemaConfigManager,
    TableConfig,
)
from prismiq.types import ColumnSchema, DatabaseSchema, Relationship, TableSchema


class TestColumnConfig:
    """Tests for ColumnConfig model."""

    def test_default_values(self) -> None:
        """Default values are set correctly."""
        config = ColumnConfig()
        assert config.display_name is None
        assert config.description is None
        assert config.hidden is False
        assert config.format is None
        assert config.date_format is None

    def test_all_fields(self) -> None:
        """All fields can be set."""
        config = ColumnConfig(
            display_name="User ID",
            description="Unique user identifier",
            hidden=True,
            format="plain",
            date_format="%Y-%m-%d",
        )
        assert config.display_name == "User ID"
        assert config.description == "Unique user identifier"
        assert config.hidden is True
        assert config.format == "plain"
        assert config.date_format == "%Y-%m-%d"


class TestTableConfig:
    """Tests for TableConfig model."""

    def test_default_values(self) -> None:
        """Default values are set correctly."""
        config = TableConfig()
        assert config.display_name is None
        assert config.description is None
        assert config.hidden is False
        assert config.columns == {}

    def test_with_columns(self) -> None:
        """Columns can be configured."""
        config = TableConfig(
            display_name="Users",
            columns={
                "id": ColumnConfig(display_name="User ID"),
                "email": ColumnConfig(hidden=True),
            },
        )
        assert config.display_name == "Users"
        assert "id" in config.columns
        assert config.columns["id"].display_name == "User ID"
        assert config.columns["email"].hidden is True


class TestSchemaConfig:
    """Tests for SchemaConfig model."""

    def test_default_values(self) -> None:
        """Default values are set correctly."""
        config = SchemaConfig()
        assert config.tables == {}

    def test_get_table_config_existing(self) -> None:
        """Get existing table config."""
        config = SchemaConfig(tables={"users": TableConfig(display_name="Users")})
        table_config = config.get_table_config("users")
        assert table_config.display_name == "Users"

    def test_get_table_config_missing(self) -> None:
        """Get missing table returns empty config."""
        config = SchemaConfig()
        table_config = config.get_table_config("users")
        assert table_config.display_name is None
        assert table_config.hidden is False

    def test_get_column_config_existing(self) -> None:
        """Get existing column config."""
        config = SchemaConfig(
            tables={"users": TableConfig(columns={"id": ColumnConfig(display_name="User ID")})}
        )
        column_config = config.get_column_config("users", "id")
        assert column_config.display_name == "User ID"

    def test_get_column_config_missing(self) -> None:
        """Get missing column returns empty config."""
        config = SchemaConfig()
        column_config = config.get_column_config("users", "id")
        assert column_config.display_name is None

    def test_get_display_name_table(self) -> None:
        """Get display name for table."""
        config = SchemaConfig(tables={"users": TableConfig(display_name="All Users")})
        assert config.get_display_name("users") == "All Users"

    def test_get_display_name_table_fallback(self) -> None:
        """Get display name falls back to table name."""
        config = SchemaConfig()
        assert config.get_display_name("users") == "users"

    def test_get_display_name_column(self) -> None:
        """Get display name for column."""
        config = SchemaConfig(
            tables={"users": TableConfig(columns={"id": ColumnConfig(display_name="User ID")})}
        )
        assert config.get_display_name("users", "id") == "User ID"

    def test_get_display_name_column_fallback(self) -> None:
        """Get display name falls back to column name."""
        config = SchemaConfig()
        assert config.get_display_name("users", "id") == "id"

    def test_is_table_hidden(self) -> None:
        """Check if table is hidden."""
        config = SchemaConfig(tables={"internal": TableConfig(hidden=True)})
        assert config.is_table_hidden("internal") is True
        assert config.is_table_hidden("users") is False

    def test_is_column_hidden(self) -> None:
        """Check if column is hidden."""
        config = SchemaConfig(
            tables={"users": TableConfig(columns={"password_hash": ColumnConfig(hidden=True)})}
        )
        assert config.is_column_hidden("users", "password_hash") is True
        assert config.is_column_hidden("users", "email") is False


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="email", data_type="varchar", is_nullable=False),
                    ColumnSchema(name="password_hash", data_type="varchar", is_nullable=False),
                ],
            ),
            TableSchema(
                name="orders",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="total", data_type="numeric", is_nullable=False),
                ],
            ),
            TableSchema(
                name="internal_logs",
                columns=[
                    ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="message", data_type="text", is_nullable=True),
                ],
            ),
        ],
        relationships=[
            Relationship(
                from_table="orders", from_column="user_id", to_table="users", to_column="id"
            ),
        ],
    )


class TestSchemaConfigManager:
    """Tests for SchemaConfigManager."""

    def test_init_empty(self) -> None:
        """Initialize with empty config."""
        manager = SchemaConfigManager()
        config = manager.get_config()
        assert config.tables == {}

    def test_init_with_config(self) -> None:
        """Initialize with existing config."""
        config = SchemaConfig(tables={"users": TableConfig(display_name="Users")})
        manager = SchemaConfigManager(config)
        assert manager.get_config().tables["users"].display_name == "Users"

    def test_update_table_config(self) -> None:
        """Update table configuration."""
        manager = SchemaConfigManager()
        manager.update_table_config("users", TableConfig(display_name="All Users"))

        config = manager.get_config()
        assert config.tables["users"].display_name == "All Users"

    def test_update_table_config_immutable(self) -> None:
        """Update creates new config (immutable)."""
        original_config = SchemaConfig()
        manager = SchemaConfigManager(original_config)
        manager.update_table_config("users", TableConfig(display_name="Users"))

        # Original config should be unchanged
        assert original_config.tables == {}
        # Manager config should be updated
        assert manager.get_config().tables["users"].display_name == "Users"

    def test_update_column_config(self) -> None:
        """Update column configuration."""
        manager = SchemaConfigManager()
        manager.update_column_config("users", "email", ColumnConfig(display_name="Email Address"))

        config = manager.get_config()
        assert config.tables["users"].columns["email"].display_name == "Email Address"

    def test_update_column_config_preserves_table(self) -> None:
        """Update column preserves existing table config."""
        manager = SchemaConfigManager()
        manager.update_table_config(
            "users", TableConfig(display_name="Users", description="User accounts")
        )
        manager.update_column_config("users", "email", ColumnConfig(display_name="Email"))

        config = manager.get_config()
        assert config.tables["users"].display_name == "Users"
        assert config.tables["users"].description == "User accounts"
        assert config.tables["users"].columns["email"].display_name == "Email"

    def test_apply_to_schema_basic(self, sample_schema: DatabaseSchema) -> None:
        """Apply basic configuration to schema."""
        manager = SchemaConfigManager()
        enhanced = manager.apply_to_schema(sample_schema)

        assert len(enhanced.tables) == 3
        assert enhanced.table_names() == ["users", "orders", "internal_logs"]

    def test_apply_to_schema_display_names(self, sample_schema: DatabaseSchema) -> None:
        """Apply display names to schema."""
        manager = SchemaConfigManager()
        manager.update_table_config("users", TableConfig(display_name="All Users"))
        manager.update_column_config("users", "id", ColumnConfig(display_name="User ID"))

        enhanced = manager.apply_to_schema(sample_schema)
        users_table = enhanced.get_table("users")
        assert users_table is not None
        assert users_table.display_name == "All Users"
        id_col = users_table.get_column("id")
        assert id_col is not None
        assert id_col.display_name == "User ID"

    def test_apply_to_schema_hidden_table(self, sample_schema: DatabaseSchema) -> None:
        """Hidden tables are excluded from schema."""
        manager = SchemaConfigManager()
        manager.update_table_config("internal_logs", TableConfig(hidden=True))

        enhanced = manager.apply_to_schema(sample_schema)
        assert len(enhanced.tables) == 2
        assert enhanced.get_table("internal_logs") is None

    def test_apply_to_schema_hidden_column(self, sample_schema: DatabaseSchema) -> None:
        """Hidden columns are excluded from schema."""
        manager = SchemaConfigManager()
        manager.update_column_config("users", "password_hash", ColumnConfig(hidden=True))

        enhanced = manager.apply_to_schema(sample_schema)
        users_table = enhanced.get_table("users")
        assert users_table is not None
        assert len(users_table.columns) == 2
        assert users_table.get_column("password_hash") is None
        assert users_table.get_column("id") is not None
        assert users_table.get_column("email") is not None

    def test_apply_to_schema_filters_relationships(self, sample_schema: DatabaseSchema) -> None:
        """Relationships to hidden tables are excluded."""
        manager = SchemaConfigManager()
        manager.update_table_config("users", TableConfig(hidden=True))

        enhanced = manager.apply_to_schema(sample_schema)
        assert len(enhanced.relationships) == 0

    def test_apply_to_schema_preserves_column_metadata(self, sample_schema: DatabaseSchema) -> None:
        """Column metadata is preserved in enhanced schema."""
        manager = SchemaConfigManager()
        enhanced = manager.apply_to_schema(sample_schema)

        users_table = enhanced.get_table("users")
        assert users_table is not None
        id_col = users_table.get_column("id")
        assert id_col is not None
        assert id_col.data_type == "integer"
        assert id_col.is_nullable is False
        assert id_col.is_primary_key is True

    def test_apply_to_schema_format_config(self, sample_schema: DatabaseSchema) -> None:
        """Format configuration is included in enhanced columns."""
        manager = SchemaConfigManager()
        manager.update_column_config("orders", "total", ColumnConfig(format="currency"))

        enhanced = manager.apply_to_schema(sample_schema)
        orders_table = enhanced.get_table("orders")
        assert orders_table is not None
        total_col = orders_table.get_column("total")
        assert total_col is not None
        assert total_col.format == "currency"


class TestSchemaConfigManagerSerialization:
    """Tests for SchemaConfigManager serialization."""

    def test_to_json_empty(self) -> None:
        """Serialize empty config to JSON."""
        manager = SchemaConfigManager()
        json_str = manager.to_json()
        data = json.loads(json_str)
        assert data == {"tables": {}}

    def test_to_json_with_data(self) -> None:
        """Serialize config with data to JSON."""
        manager = SchemaConfigManager()
        manager.update_table_config(
            "users",
            TableConfig(
                display_name="Users",
                description="User accounts",
                columns={"id": ColumnConfig(display_name="User ID")},
            ),
        )

        json_str = manager.to_json()
        data = json.loads(json_str)

        assert "users" in data["tables"]
        assert data["tables"]["users"]["display_name"] == "Users"
        assert data["tables"]["users"]["columns"]["id"]["display_name"] == "User ID"

    def test_from_json_empty(self) -> None:
        """Deserialize empty config from JSON."""
        json_str = '{"tables": {}}'
        manager = SchemaConfigManager.from_json(json_str)
        assert manager.get_config().tables == {}

    def test_from_json_with_data(self) -> None:
        """Deserialize config with data from JSON."""
        json_str = """
        {
            "tables": {
                "users": {
                    "display_name": "Users",
                    "hidden": false,
                    "columns": {
                        "id": {"display_name": "User ID", "hidden": false}
                    }
                }
            }
        }
        """
        manager = SchemaConfigManager.from_json(json_str)
        config = manager.get_config()

        assert config.tables["users"].display_name == "Users"
        assert config.tables["users"].columns["id"].display_name == "User ID"

    def test_roundtrip(self) -> None:
        """Serialize and deserialize preserves data."""
        original = SchemaConfigManager()
        original.update_table_config(
            "users",
            TableConfig(
                display_name="Users",
                description="User accounts",
                hidden=False,
                columns={
                    "id": ColumnConfig(display_name="User ID", format="plain"),
                    "email": ColumnConfig(hidden=True),
                },
            ),
        )

        json_str = original.to_json()
        restored = SchemaConfigManager.from_json(json_str)

        assert restored.get_config().tables["users"].display_name == "Users"
        assert restored.get_config().tables["users"].columns["id"].display_name == "User ID"
        assert restored.get_config().tables["users"].columns["email"].hidden is True


class TestEnhancedSchemaModels:
    """Tests for enhanced schema models."""

    def test_enhanced_column_schema(self) -> None:
        """EnhancedColumnSchema includes all fields."""
        col = EnhancedColumnSchema(
            name="total",
            data_type="numeric",
            is_nullable=False,
            is_primary_key=False,
            display_name="Order Total",
            format="currency",
        )
        assert col.name == "total"
        assert col.display_name == "Order Total"
        assert col.format == "currency"

    def test_enhanced_table_schema_get_column(self) -> None:
        """EnhancedTableSchema.get_column works correctly."""
        table = EnhancedTableSchema(
            name="users",
            columns=[
                EnhancedColumnSchema(name="id", data_type="integer", is_nullable=False),
                EnhancedColumnSchema(name="email", data_type="varchar", is_nullable=False),
            ],
        )
        assert table.get_column("id") is not None
        assert table.get_column("nonexistent") is None
        assert table.has_column("email") is True
        assert table.has_column("missing") is False

    def test_enhanced_database_schema_get_table(self) -> None:
        """EnhancedDatabaseSchema.get_table works correctly."""
        schema = EnhancedDatabaseSchema(
            tables=[
                EnhancedTableSchema(name="users", columns=[]),
                EnhancedTableSchema(name="orders", columns=[]),
            ],
            relationships=[],
        )
        assert schema.get_table("users") is not None
        assert schema.get_table("nonexistent") is None
        assert schema.has_table("orders") is True
        assert schema.has_table("missing") is False
        assert schema.table_names() == ["users", "orders"]
