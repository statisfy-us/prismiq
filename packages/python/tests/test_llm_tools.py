"""Tests for LLM agent tools."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from prismiq.llm.tools import (
    ALL_TOOLS,
    TOOL_GET_TABLE_DETAILS,
    TOOL_VALIDATE_SQL,
    execute_tool,
)
from prismiq.sql_validator import SQLValidationResult
from prismiq.types import (
    ColumnSchema,
    DatabaseSchema,
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

    def test_all_tools_has_four(self) -> None:
        """Test that ALL_TOOLS contains the expected tools."""
        assert len(ALL_TOOLS) == 4

    @pytest.mark.parametrize(
        "expected_name",
        [
            "get_schema_overview",
            "get_table_details",
            "get_relationships",
            "validate_sql",
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
