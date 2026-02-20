"""Tests for LLM system prompt builder."""

from __future__ import annotations

from prismiq.llm.prompt import build_system_prompt
from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
    Relationship,
    TableSchema,
)

# ============================================================================
# Tests
# ============================================================================


class TestBuildSystemPrompt:
    """Tests for build_system_prompt function."""

    def _make_schema(
        self,
        tables: list[TableSchema] | None = None,
        relationships: list[Relationship] | None = None,
    ) -> DatabaseSchema:
        """Helper to create a schema."""
        if tables is None:
            tables = [
                TableSchema(
                    name="users",
                    schema_name="public",
                    columns=[
                        ColumnSchema(name="id", data_type="integer", is_nullable=False),
                        ColumnSchema(name="name", data_type="text", is_nullable=False),
                    ],
                ),
            ]
        return DatabaseSchema(
            tables=tables,
            relationships=relationships or [],
        )

    def test_includes_table_names(self) -> None:
        """Test that prompt includes table names."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert "users" in prompt

    def test_includes_column_info(self) -> None:
        """Test that prompt includes column names and types."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert "id (integer)" in prompt
        assert "name (text)" in prompt

    def test_includes_schema_name(self) -> None:
        """Test that schema name appears in the prompt."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema, schema_name="analytics")
        assert '"analytics"' in prompt

    def test_default_schema_name(self) -> None:
        """Test default schema name is 'public'."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert '"public"' in prompt

    def test_includes_relationships(self) -> None:
        """Test that relationships are included."""
        schema = self._make_schema(
            tables=[
                TableSchema(
                    name="users",
                    schema_name="public",
                    columns=[ColumnSchema(name="id", data_type="integer", is_nullable=False)],
                ),
                TableSchema(
                    name="orders",
                    schema_name="public",
                    columns=[
                        ColumnSchema(name="id", data_type="integer", is_nullable=False),
                        ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ],
                ),
            ],
            relationships=[
                Relationship(
                    from_table="orders",
                    from_column="user_id",
                    to_table="users",
                    to_column="id",
                ),
            ],
        )
        prompt = build_system_prompt(schema)
        assert "orders.user_id" in prompt
        assert "users.id" in prompt

    def test_no_relationships(self) -> None:
        """Test prompt when no relationships exist."""
        schema = self._make_schema(relationships=[])
        prompt = build_system_prompt(schema)
        assert "(none detected)" in prompt

    def test_includes_rules(self) -> None:
        """Test that key rules are included."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert "SELECT only" in prompt
        assert "Quote identifiers" in prompt
        assert "LIMIT 1000" in prompt

    def test_multiple_tables(self) -> None:
        """Test prompt with multiple tables."""
        schema = self._make_schema(
            tables=[
                TableSchema(
                    name="users",
                    schema_name="public",
                    columns=[ColumnSchema(name="id", data_type="integer", is_nullable=False)],
                ),
                TableSchema(
                    name="orders",
                    schema_name="public",
                    columns=[ColumnSchema(name="id", data_type="integer", is_nullable=False)],
                ),
                TableSchema(
                    name="products",
                    schema_name="public",
                    columns=[ColumnSchema(name="id", data_type="integer", is_nullable=False)],
                ),
            ],
        )
        prompt = build_system_prompt(schema)
        assert "users" in prompt
        assert "orders" in prompt
        assert "products" in prompt

    def test_empty_schema(self) -> None:
        """Test prompt with empty schema."""
        schema = DatabaseSchema(tables=[], relationships=[])
        prompt = build_system_prompt(schema)
        # Should still produce a valid prompt
        assert "SQL assistant" in prompt
        assert "(none detected)" in prompt
