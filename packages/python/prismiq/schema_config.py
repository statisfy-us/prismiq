"""Schema customization for Prismiq analytics.

This module provides configuration models and a manager for customizing
how database schema is presented to users, including friendly names,
hidden columns, and formatting hints.
"""

from __future__ import annotations

import json
from typing import Any

from prismiq.types import DatabaseSchema
from pydantic import BaseModel, ConfigDict


class ColumnConfig(BaseModel):
    """Configuration for a single column."""

    model_config = ConfigDict(strict=True)

    display_name: str | None = None
    """Friendly name for UI display."""

    description: str | None = None
    """Tooltip/help text for the column."""

    hidden: bool = False
    """Whether to hide this column from the schema explorer."""

    format: str | None = None
    """Number format: plain, currency, percent, compact."""

    date_format: str | None = None
    """Date format string for date/timestamp columns."""


class TableConfig(BaseModel):
    """Configuration for a single table."""

    model_config = ConfigDict(strict=True)

    display_name: str | None = None
    """Friendly name for UI display."""

    description: str | None = None
    """Tooltip/help text for the table."""

    hidden: bool = False
    """Whether to hide this table from the schema explorer."""

    columns: dict[str, ColumnConfig] = {}
    """Column-specific configurations."""


class SchemaConfig(BaseModel):
    """Complete schema customization configuration."""

    model_config = ConfigDict(strict=True)

    tables: dict[str, TableConfig] = {}
    """Table-specific configurations."""

    def get_table_config(self, table_name: str) -> TableConfig:
        """Get config for a table, with defaults if not configured.

        Args:
            table_name: The table name to get configuration for.

        Returns:
            TableConfig for the table (may be default/empty).
        """
        return self.tables.get(table_name, TableConfig())

    def get_column_config(self, table_name: str, column_name: str) -> ColumnConfig:
        """Get config for a column, with defaults if not configured.

        Args:
            table_name: The table containing the column.
            column_name: The column name to get configuration for.

        Returns:
            ColumnConfig for the column (may be default/empty).
        """
        table_config = self.get_table_config(table_name)
        return table_config.columns.get(column_name, ColumnConfig())

    def get_display_name(self, table_name: str, column_name: str | None = None) -> str:
        """Get display name for table or column, falling back to actual name.

        Args:
            table_name: The table name.
            column_name: Optional column name. If None, returns table display name.

        Returns:
            The display name, or the actual name if no display name is configured.
        """
        if column_name is None:
            table_config = self.get_table_config(table_name)
            return table_config.display_name or table_name
        else:
            column_config = self.get_column_config(table_name, column_name)
            return column_config.display_name or column_name

    def is_table_hidden(self, table_name: str) -> bool:
        """Check if a table is hidden."""
        return self.get_table_config(table_name).hidden

    def is_column_hidden(self, table_name: str, column_name: str) -> bool:
        """Check if a column is hidden."""
        return self.get_column_config(table_name, column_name).hidden


class EnhancedColumnSchema(BaseModel):
    """Column schema with configuration-based enhancements."""

    model_config = ConfigDict(strict=True)

    name: str
    """Column name in the database."""

    data_type: str
    """PostgreSQL data type."""

    is_nullable: bool
    """Whether the column allows NULL values."""

    is_primary_key: bool = False
    """Whether this column is part of the primary key."""

    default_value: str | None = None
    """Default value expression, if any."""

    display_name: str | None = None
    """Friendly display name from configuration."""

    description: str | None = None
    """Description from configuration."""

    format: str | None = None
    """Number format from configuration."""

    date_format: str | None = None
    """Date format from configuration."""


class EnhancedTableSchema(BaseModel):
    """Table schema with configuration-based enhancements."""

    model_config = ConfigDict(strict=True)

    name: str
    """Table name in the database."""

    schema_name: str = "public"
    """Database schema (namespace)."""

    columns: list[EnhancedColumnSchema]
    """Enhanced column schemas."""

    display_name: str | None = None
    """Friendly display name from configuration."""

    description: str | None = None
    """Description from configuration."""

    def get_column(self, column_name: str) -> EnhancedColumnSchema | None:
        """Get a column by name, or None if not found."""
        for col in self.columns:
            if col.name == column_name:
                return col
        return None

    def has_column(self, column_name: str) -> bool:
        """Check if the table has a column with the given name."""
        return self.get_column(column_name) is not None


class EnhancedDatabaseSchema(BaseModel):
    """Database schema with configuration-based enhancements."""

    model_config = ConfigDict(strict=True)

    tables: list[EnhancedTableSchema]
    """Enhanced table schemas."""

    relationships: list[Any]  # Using Any to avoid circular import
    """Foreign key relationships."""

    def get_table(self, table_name: str) -> EnhancedTableSchema | None:
        """Get a table by name, or None if not found."""
        for table in self.tables:
            if table.name == table_name:
                return table
        return None

    def has_table(self, table_name: str) -> bool:
        """Check if the schema contains a table with the given name."""
        return self.get_table(table_name) is not None

    def table_names(self) -> list[str]:
        """Get list of all table names."""
        return [t.name for t in self.tables]


class SchemaConfigManager:
    """Manages schema configuration persistence and application.

    Provides methods for updating configuration and applying it to
    database schemas.
    """

    def __init__(self, config: SchemaConfig | None = None) -> None:
        """Initialize the schema config manager.

        Args:
            config: Initial configuration. If None, an empty config is used.
        """
        self._config = config or SchemaConfig()

    def get_config(self) -> SchemaConfig:
        """Get current configuration.

        Returns:
            The current SchemaConfig.
        """
        return self._config

    def update_table_config(self, table_name: str, config: TableConfig) -> None:
        """Update configuration for a table.

        Creates a new config with the updated table (immutable operation).

        Args:
            table_name: Name of the table to configure.
            config: New configuration for the table.
        """
        new_tables = dict(self._config.tables)
        new_tables[table_name] = config
        self._config = SchemaConfig(tables=new_tables)

    def update_column_config(
        self, table_name: str, column_name: str, config: ColumnConfig
    ) -> None:
        """Update configuration for a column.

        Creates a new config with the updated column (immutable operation).

        Args:
            table_name: Name of the table containing the column.
            column_name: Name of the column to configure.
            config: New configuration for the column.
        """
        # Get existing table config or create new one
        table_config = self._config.get_table_config(table_name)
        new_columns = dict(table_config.columns)
        new_columns[column_name] = config

        # Create new table config with updated columns
        new_table_config = TableConfig(
            display_name=table_config.display_name,
            description=table_config.description,
            hidden=table_config.hidden,
            columns=new_columns,
        )

        # Update via table config
        self.update_table_config(table_name, new_table_config)

    def apply_to_schema(self, schema: DatabaseSchema) -> EnhancedDatabaseSchema:
        """Apply configuration to a schema.

        Adds display names, descriptions, and formats from configuration.
        Filters out hidden tables and columns.

        Args:
            schema: The database schema to enhance.

        Returns:
            Enhanced schema with configuration applied and hidden items removed.
        """
        enhanced_tables: list[EnhancedTableSchema] = []

        for table in schema.tables:
            # Skip hidden tables
            if self._config.is_table_hidden(table.name):
                continue

            table_config = self._config.get_table_config(table.name)
            enhanced_columns: list[EnhancedColumnSchema] = []

            for column in table.columns:
                # Skip hidden columns
                if self._config.is_column_hidden(table.name, column.name):
                    continue

                column_config = self._config.get_column_config(table.name, column.name)
                enhanced_columns.append(
                    EnhancedColumnSchema(
                        name=column.name,
                        data_type=column.data_type,
                        is_nullable=column.is_nullable,
                        is_primary_key=column.is_primary_key,
                        default_value=column.default_value,
                        display_name=column_config.display_name,
                        description=column_config.description,
                        format=column_config.format,
                        date_format=column_config.date_format,
                    )
                )

            enhanced_tables.append(
                EnhancedTableSchema(
                    name=table.name,
                    schema_name=table.schema_name,
                    columns=enhanced_columns,
                    display_name=table_config.display_name,
                    description=table_config.description,
                )
            )

        # Filter relationships to only include visible tables
        visible_table_names = {t.name for t in enhanced_tables}
        visible_relationships = [
            rel
            for rel in schema.relationships
            if rel.from_table in visible_table_names
            and rel.to_table in visible_table_names
        ]

        return EnhancedDatabaseSchema(
            tables=enhanced_tables,
            relationships=visible_relationships,
        )

    def to_json(self) -> str:
        """Serialize configuration to JSON.

        Returns:
            JSON string representation of the configuration.
        """
        return self._config.model_dump_json(indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> SchemaConfigManager:
        """Deserialize configuration from JSON.

        Args:
            json_str: JSON string to parse.

        Returns:
            New SchemaConfigManager with the parsed configuration.
        """
        data = json.loads(json_str)
        config = SchemaConfig.model_validate(data)
        return cls(config)
