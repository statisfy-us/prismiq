"""Tests for LLM agent tools."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from prismiq.llm.tools import (
    ALL_TOOLS,
    TOOL_EXECUTE_SQL,
    TOOL_GET_COLUMN_VALUES,
    TOOL_GET_TABLE_DETAILS,
    TOOL_VALIDATE_SQL,
    _truncate_value,
    execute_tool,
    validate_widget_compatibility,
)
from prismiq.llm.types import WidgetContext
from prismiq.sql_validator import SQLValidationResult
from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
    QueryResult,
    Relationship,
    TableSchema,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_engine() -> MagicMock:
    """Create a mock PrismiqEngine."""
    engine = MagicMock()

    # Mock schema
    schema = DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="name", data_type="text", is_nullable=False),
                    ColumnSchema(name="email", data_type="text", is_nullable=True),
                ],
                row_count=100,
            ),
            TableSchema(
                name="orders",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="total", data_type="numeric", is_nullable=False),
                ],
                row_count=500,
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

    engine.get_schema = AsyncMock(return_value=schema)
    engine.get_table = AsyncMock(
        side_effect=lambda name, **kw: next((t for t in schema.tables if t.name == name), None)
    )
    engine.validate_sql = AsyncMock(
        return_value=SQLValidationResult(
            valid=True,
            errors=[],
            tables=["users"],
            sanitized_sql='SELECT * FROM "users"',
        )
    )

    return engine


# ============================================================================
# Tool Definition Tests
# ============================================================================


class TestToolDefinitions:
    """Tests for tool definitions."""

    def test_all_tools_has_six(self) -> None:
        """Test that ALL_TOOLS contains the expected tools."""
        assert len(ALL_TOOLS) == 6

    @pytest.mark.parametrize(
        "expected_name",
        [
            "get_schema_overview",
            "get_table_details",
            "get_relationships",
            "validate_sql",
            "execute_sql",
            "get_column_values",
        ],
    )
    def test_tool_name_present(self, expected_name: str) -> None:
        """Test that expected tool names are present in ALL_TOOLS."""
        names = {t.name for t in ALL_TOOLS}
        assert expected_name in names

    @pytest.mark.parametrize(
        "tool,required_param",
        [
            (TOOL_GET_TABLE_DETAILS, "table_name"),
            (TOOL_VALIDATE_SQL, "sql"),
            (TOOL_EXECUTE_SQL, "sql"),
            (TOOL_GET_COLUMN_VALUES, "table_name"),
            (TOOL_GET_COLUMN_VALUES, "column_name"),
        ],
    )
    def test_tool_has_required_param(self, tool: object, required_param: str) -> None:
        """Test that tools declare their required parameters."""
        params = tool.parameters  # type: ignore[attr-defined]
        assert "required" in params
        assert required_param in params["required"]


# ============================================================================
# Tool Execution Tests
# ============================================================================


class TestExecuteTool:
    """Tests for execute_tool function."""

    @pytest.mark.asyncio
    async def test_get_schema_overview(self, mock_engine: MagicMock) -> None:
        """Test schema overview returns all tables."""
        result = await execute_tool("get_schema_overview", {}, mock_engine)
        data = json.loads(result)

        assert len(data) == 2
        assert data[0]["table"] == "users"
        assert data[1]["table"] == "orders"
        assert data[0]["row_count"] == 100

    @pytest.mark.asyncio
    async def test_get_table_details(self, mock_engine: MagicMock) -> None:
        """Test table details returns column info."""
        result = await execute_tool(
            "get_table_details",
            {"table_name": "users"},
            mock_engine,
        )
        data = json.loads(result)

        assert data["table"] == "users"
        assert len(data["columns"]) == 3
        assert data["columns"][0]["name"] == "id"
        assert data["columns"][0]["primary_key"] is True

    @pytest.mark.asyncio
    async def test_get_table_details_not_found(self, mock_engine: MagicMock) -> None:
        """Test table details for non-existent table."""
        mock_engine.get_table = AsyncMock(side_effect=Exception("Table not found: foo"))
        result = await execute_tool(
            "get_table_details",
            {"table_name": "foo"},
            mock_engine,
        )
        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_get_relationships(self, mock_engine: MagicMock) -> None:
        """Test relationships returns FK info."""
        result = await execute_tool("get_relationships", {}, mock_engine)
        data = json.loads(result)

        assert len(data) == 1
        assert data[0]["from"] == "orders.user_id"
        assert data[0]["to"] == "users.id"

    @pytest.mark.asyncio
    async def test_get_relationships_none(self, mock_engine: MagicMock) -> None:
        """Test relationships when none exist."""
        schema_no_rels = DatabaseSchema(
            tables=[
                TableSchema(
                    name="users",
                    schema_name="public",
                    columns=[ColumnSchema(name="id", data_type="integer", is_nullable=False)],
                ),
            ],
            relationships=[],
        )
        mock_engine.get_schema = AsyncMock(return_value=schema_no_rels)

        result = await execute_tool("get_relationships", {}, mock_engine)
        data = json.loads(result)
        assert "message" in data

    @pytest.mark.asyncio
    async def test_validate_sql_valid(self, mock_engine: MagicMock) -> None:
        """Test SQL validation for a valid query."""
        result = await execute_tool(
            "validate_sql",
            {"sql": 'SELECT * FROM "users"'},
            mock_engine,
        )
        data = json.loads(result)

        assert data["valid"] is True
        assert data["errors"] == []
        assert "users" in data["tables"]

    @pytest.mark.asyncio
    async def test_validate_sql_invalid(self, mock_engine: MagicMock) -> None:
        """Test SQL validation for an invalid query."""
        mock_engine.validate_sql = AsyncMock(
            return_value=SQLValidationResult(
                valid=False,
                errors=["Table 'nonexistent' not found"],
                tables=[],
                sanitized_sql=None,
            )
        )
        result = await execute_tool(
            "validate_sql",
            {"sql": 'SELECT * FROM "nonexistent"'},
            mock_engine,
        )
        data = json.loads(result)

        assert data["valid"] is False
        assert len(data["errors"]) == 1

    @pytest.mark.asyncio
    async def test_unknown_tool(self, mock_engine: MagicMock) -> None:
        """Test executing an unknown tool."""
        result = await execute_tool("unknown_tool", {}, mock_engine)
        data = json.loads(result)
        assert "error" in data
        assert "Unknown tool" in data["error"]

    @pytest.mark.asyncio
    async def test_schema_name_passed(self, mock_engine: MagicMock) -> None:
        """Test that schema_name is passed to engine methods."""
        await execute_tool(
            "get_schema_overview",
            {},
            mock_engine,
            schema_name="tenant_abc",
        )
        mock_engine.get_schema.assert_called_once_with(schema_name="tenant_abc")

    @pytest.mark.asyncio
    async def test_execute_sql_success(self, mock_engine: MagicMock) -> None:
        """Test execute_sql returns truncated results."""
        mock_engine.execute_raw_sql = AsyncMock(
            return_value=QueryResult(
                columns=["name", "total"],
                column_types=["text", "numeric"],
                rows=[
                    ["Alice", 100],
                    ["Bob", 200],
                    ["Charlie", 300],
                    ["Diana", 400],
                    ["Eve", 500],
                    ["Frank", 600],
                    ["Grace", 700],
                ],
                row_count=7,
                truncated=False,
                execution_time_ms=12.5,
            )
        )
        result = await execute_tool(
            "execute_sql",
            {"sql": 'SELECT "name", "total" FROM "users"'},
            mock_engine,
        )
        data = json.loads(result)

        assert data["row_count"] == 7
        assert len(data["preview_rows"]) == 5  # Truncated to 5
        assert data["columns"] == ["name", "total"]
        assert data["column_types"] == ["text", "numeric"]
        assert "execution_time_ms" in data
        assert "widget_compatibility" not in data

    @pytest.mark.asyncio
    async def test_execute_sql_failure(self, mock_engine: MagicMock) -> None:
        """Test execute_sql returns error on failure."""
        mock_engine.execute_raw_sql = AsyncMock(
            side_effect=Exception('relation "foo" does not exist')
        )
        result = await execute_tool(
            "execute_sql",
            {"sql": 'SELECT * FROM "foo"'},
            mock_engine,
        )
        data = json.loads(result)
        assert "error" in data
        assert "foo" in data["error"]

    @pytest.mark.asyncio
    async def test_execute_sql_with_widget_compat_pass(self, mock_engine: MagicMock) -> None:
        """Test execute_sql with compatible pie_chart widget."""
        mock_engine.execute_raw_sql = AsyncMock(
            return_value=QueryResult(
                columns=["region", "revenue"],
                column_types=["text", "numeric"],
                rows=[["US", 1000], ["EU", 2000]],
                row_count=2,
                truncated=False,
                execution_time_ms=5.0,
            )
        )
        ctx = WidgetContext(widget_type="pie_chart")
        result = await execute_tool(
            "execute_sql",
            {"sql": 'SELECT "region", SUM("revenue") FROM "sales" GROUP BY "region"'},
            mock_engine,
            widget_context=ctx,
        )
        data = json.loads(result)
        assert data["widget_compatibility"]["compatible"] is True
        assert data["widget_compatibility"]["warnings"] == []

    @pytest.mark.asyncio
    async def test_execute_sql_with_widget_compat_fail(self, mock_engine: MagicMock) -> None:
        """Test execute_sql with incompatible pie_chart widget (5 cols)."""
        mock_engine.execute_raw_sql = AsyncMock(
            return_value=QueryResult(
                columns=["a", "b", "c", "d", "e"],
                column_types=["text", "text", "text", "text", "numeric"],
                rows=[["x", "y", "z", "w", 100]],
                row_count=1,
                truncated=False,
                execution_time_ms=5.0,
            )
        )
        ctx = WidgetContext(widget_type="pie_chart")
        result = await execute_tool(
            "execute_sql",
            {"sql": 'SELECT "a", "b", "c", "d", "e" FROM "public"."wide_table"'},
            mock_engine,
            widget_context=ctx,
        )
        data = json.loads(result)
        assert data["widget_compatibility"]["compatible"] is False
        assert len(data["widget_compatibility"]["warnings"]) == 1
        assert "exactly 2 columns" in data["widget_compatibility"]["warnings"][0]

    @pytest.mark.asyncio
    async def test_get_column_values_success(self, mock_engine: MagicMock) -> None:
        """Test get_column_values returns sample values."""
        mock_engine.sample_column_values = AsyncMock(return_value=["active", "inactive", "pending"])
        result = await execute_tool(
            "get_column_values",
            {"table_name": "users", "column_name": "status"},
            mock_engine,
        )
        data = json.loads(result)
        assert data["table"] == "users"
        assert data["column"] == "status"
        assert data["values"] == ["active", "inactive", "pending"]

    @pytest.mark.asyncio
    async def test_get_column_values_invalid_table(self, mock_engine: MagicMock) -> None:
        """Test get_column_values with invalid table."""
        mock_engine.sample_column_values = AsyncMock(
            side_effect=ValueError("Table 'foo' not found")
        )
        result = await execute_tool(
            "get_column_values",
            {"table_name": "foo", "column_name": "bar"},
            mock_engine,
        )
        data = json.loads(result)
        assert "error" in data


# ============================================================================
# Truncate Value Tests
# ============================================================================


class TestTruncateValue:
    """Tests for _truncate_value helper."""

    def test_short_string_unchanged(self) -> None:
        """Test short strings pass through unchanged."""
        assert _truncate_value("hello") == "hello"

    def test_string_at_boundary_unchanged(self) -> None:
        """Test string exactly at max_len is not truncated."""
        s = "a" * 100
        assert _truncate_value(s) == s

    def test_string_above_boundary_truncated(self) -> None:
        """Test string above max_len is truncated with '...'."""
        s = "a" * 101
        result = _truncate_value(s)
        assert result == "a" * 100 + "..."
        assert len(result) == 103

    def test_empty_string_unchanged(self) -> None:
        """Test empty string passes through unchanged."""
        assert _truncate_value("") == ""

    def test_non_string_types_unchanged(self) -> None:
        """Test non-string types pass through unchanged."""
        assert _truncate_value(42) == 42
        assert _truncate_value(3.14) == 3.14
        assert _truncate_value(None) is None
        assert _truncate_value(True) is True

    def test_custom_max_len(self) -> None:
        """Test custom max_len parameter."""
        assert _truncate_value("abcdef", max_len=3) == "abc..."


# ============================================================================
# Widget Compatibility Validation Tests
# ============================================================================


class TestValidateWidgetCompatibility:
    """Tests for validate_widget_compatibility function."""

    def test_metric_pass(self) -> None:
        """Test metric: 1 row, 1 numeric col -> pass."""
        result = validate_widget_compatibility("metric", ["count"], ["bigint"], row_count=1)
        assert result["compatible"] is True

    def test_metric_zero_rows(self) -> None:
        """Test metric: 0 rows -> fail."""
        result = validate_widget_compatibility("metric", ["count"], ["bigint"], row_count=0)
        assert result["compatible"] is False
        assert any("0 rows" in w for w in result["warnings"])

    def test_metric_no_numeric(self) -> None:
        """Test metric: no numeric columns -> fail."""
        result = validate_widget_compatibility("metric", ["name"], ["text"], row_count=1)
        assert result["compatible"] is False
        assert any("numeric" in w for w in result["warnings"])

    def test_pie_pass(self) -> None:
        """Test pie: 2 cols (str + num) -> pass."""
        result = validate_widget_compatibility(
            "pie_chart", ["label", "value"], ["text", "integer"], row_count=5
        )
        assert result["compatible"] is True

    def test_pie_too_many_cols(self) -> None:
        """Test pie: 3 cols -> fail."""
        result = validate_widget_compatibility(
            "pie_chart", ["a", "b", "c"], ["text", "integer", "integer"], row_count=5
        )
        assert result["compatible"] is False
        assert any("exactly 2" in w for w in result["warnings"])

    def test_pie_one_col(self) -> None:
        """Test pie: 1 col -> fail."""
        result = validate_widget_compatibility("pie_chart", ["value"], ["integer"], row_count=5)
        assert result["compatible"] is False

    def test_pie_wrong_order(self) -> None:
        """Test pie: numeric first, text second -> warning."""
        result = validate_widget_compatibility(
            "pie_chart", ["count", "label"], ["integer", "text"], row_count=5
        )
        assert result["compatible"] is False
        assert any("1st column" in w for w in result["warnings"])

    def test_bar_pass(self) -> None:
        """Test bar: 2+ cols with numeric -> pass."""
        result = validate_widget_compatibility(
            "bar_chart", ["category", "amount"], ["text", "numeric"], row_count=10
        )
        assert result["compatible"] is True

    def test_bar_one_col(self) -> None:
        """Test bar: 1 col -> fail."""
        result = validate_widget_compatibility("bar_chart", ["value"], ["integer"], row_count=10)
        assert result["compatible"] is False

    def test_bar_no_numeric(self) -> None:
        """Test bar: all string cols -> fail."""
        result = validate_widget_compatibility(
            "bar_chart", ["a", "b"], ["text", "text"], row_count=10
        )
        assert result["compatible"] is False
        assert any("numeric" in w.lower() for w in result["warnings"])

    def test_line_chart_pass(self) -> None:
        """Test line_chart: 2 cols with numeric -> pass."""
        result = validate_widget_compatibility(
            "line_chart", ["date", "value"], ["date", "integer"], row_count=10
        )
        assert result["compatible"] is True

    def test_area_chart_pass(self) -> None:
        """Test area_chart: 2 cols with numeric -> pass."""
        result = validate_widget_compatibility(
            "area_chart", ["date", "value"], ["date", "numeric"], row_count=10
        )
        assert result["compatible"] is True

    def test_scatter_pass(self) -> None:
        """Test scatter: 2 numeric cols -> pass."""
        result = validate_widget_compatibility(
            "scatter_chart", ["x", "y"], ["double precision", "real"], row_count=10
        )
        assert result["compatible"] is True

    def test_scatter_one_numeric(self) -> None:
        """Test scatter: 1 numeric -> fail."""
        result = validate_widget_compatibility(
            "scatter_chart", ["name", "value"], ["text", "integer"], row_count=10
        )
        assert result["compatible"] is False
        assert any("2 numeric" in w for w in result["warnings"])

    def test_table_always_compatible(self) -> None:
        """Test table: any columns -> always pass."""
        result = validate_widget_compatibility(
            "table", ["a", "b", "c"], ["text", "text", "text"], row_count=0
        )
        assert result["compatible"] is True

    def test_empty_columns(self) -> None:
        """Test validation with empty column lists."""
        result = validate_widget_compatibility("pie_chart", [], [], row_count=0)
        assert result["compatible"] is False

    def test_unknown_widget_type(self) -> None:
        """Test that unknown widget types produce a warning."""
        result = validate_widget_compatibility(
            "heatmap", ["x", "y", "value"], ["text", "text", "numeric"], row_count=10
        )
        assert result["compatible"] is False
        assert any("Unknown widget type" in w for w in result["warnings"])

    def test_numeric_type_detection(self) -> None:
        """Test various numeric type names are detected."""
        numeric_types = [
            "integer",
            "bigint",
            "smallint",
            "numeric",
            "decimal",
            "real",
            "double precision",
            "money",
            "int4",
            "float8",
            "serial",
        ]
        for t in numeric_types:
            result = validate_widget_compatibility("metric", ["val"], [t], row_count=1)
            assert result["compatible"] is True, f"Type '{t}' should be numeric"
