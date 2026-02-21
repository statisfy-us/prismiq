"""Tests for LLM system prompt builder."""

from __future__ import annotations

from prismiq.llm.prompt import build_system_prompt
from prismiq.llm.types import WidgetContext
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

    def test_no_schema_prefix_rule(self) -> None:
        """Test that prompt instructs LLM not to use schema prefixes."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert "No schema prefix" in prompt

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

    def test_no_widget_context(self) -> None:
        """Test that no widget section when context is None."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema, widget_context=None)
        assert "Target Widget" not in prompt

    def test_widget_context_metric(self) -> None:
        """Test metric widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="metric")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "Target Widget" in prompt
        assert "metric" in prompt
        assert "one row" in prompt
        assert "one numeric column" in prompt

    def test_widget_context_pie_chart(self) -> None:
        """Test pie chart widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="pie_chart")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "pie_chart" in prompt
        assert "exactly 2 columns" in prompt

    def test_widget_context_bar_chart(self) -> None:
        """Test bar chart widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="bar_chart")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "bar_chart" in prompt
        assert "category" in prompt

    def test_widget_context_line_chart(self) -> None:
        """Test line chart widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="line_chart")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "line_chart" in prompt
        assert "ORDER BY" in prompt

    def test_widget_context_scatter_chart(self) -> None:
        """Test scatter chart widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="scatter_chart")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "scatter_chart" in prompt
        assert "2 numeric columns" in prompt

    def test_widget_context_table(self) -> None:
        """Test table widget rules in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(widget_type="table")
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "table" in prompt
        assert "ORDER BY" in prompt

    def test_widget_context_with_column_mappings(self) -> None:
        """Test that column mappings appear in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(
            widget_type="bar_chart",
            x_axis="region",
            y_axis=["revenue", "profit"],
            series_column="category",
        )
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "x-axis = `region`" in prompt
        assert "`revenue`" in prompt
        assert "`profit`" in prompt
        assert "series column = `category`" in prompt

    def test_widget_context_with_last_error(self) -> None:
        """Test that error context appears in prompt."""
        schema = self._make_schema()
        ctx = WidgetContext(
            widget_type="pie_chart",
            last_error="Query returns 5 columns, pie_chart needs exactly 2",
        )
        prompt = build_system_prompt(schema, widget_context=ctx)
        assert "Previous error" in prompt
        assert "5 columns" in prompt
        assert "Fix the issue" in prompt

    def test_updated_tool_instructions(self) -> None:
        """Test that updated tool instructions include new tools."""
        schema = self._make_schema()
        prompt = build_system_prompt(schema)
        assert "get_column_values" in prompt
        assert "execute_sql" in prompt
