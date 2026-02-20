"""Tool definitions and execution for the LLM agent.

The agent can use these tools to inspect the database schema
and validate SQL queries before suggesting them to the user.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from prismiq.llm.types import ToolDefinition

if TYPE_CHECKING:
    from prismiq.engine import PrismiqEngine

# ============================================================================
# Tool Definitions
# ============================================================================

TOOL_GET_SCHEMA_OVERVIEW = ToolDefinition(
    name="get_schema_overview",
    description=(
        "Get an overview of all available database tables and their columns. "
        "Returns table names with column names and types. "
        "Use this first to understand the database structure."
    ),
    parameters={
        "type": "object",
        "properties": {},
    },
)

TOOL_GET_TABLE_DETAILS = ToolDefinition(
    name="get_table_details",
    description=(
        "Get detailed information about a specific table including all columns, "
        "their data types, nullable status, and primary keys. "
        "Use this when you need to know exact column types or constraints."
    ),
    parameters={
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Name of the table to inspect.",
            },
        },
        "required": ["table_name"],
    },
)

TOOL_GET_RELATIONSHIPS = ToolDefinition(
    name="get_relationships",
    description=(
        "Get all foreign key relationships between tables. "
        "Shows which columns link tables together for JOINs."
    ),
    parameters={
        "type": "object",
        "properties": {},
    },
)

TOOL_VALIDATE_SQL = ToolDefinition(
    name="validate_sql",
    description=(
        "Validate a SQL query without executing it. "
        "Checks syntax, table/column existence, and SELECT-only restriction. "
        "Use this before suggesting SQL to the user."
    ),
    parameters={
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "SQL query to validate.",
            },
        },
        "required": ["sql"],
    },
)

ALL_TOOLS = [
    TOOL_GET_SCHEMA_OVERVIEW,
    TOOL_GET_TABLE_DETAILS,
    TOOL_GET_RELATIONSHIPS,
    TOOL_VALIDATE_SQL,
]


# ============================================================================
# Tool Execution
# ============================================================================


async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
    engine: PrismiqEngine,
    schema_name: str | None = None,
) -> str:
    """Execute a tool and return the result as a string.

    Args:
        tool_name: Name of the tool to execute.
        arguments: Arguments for the tool.
        engine: PrismiqEngine instance for database access.
        schema_name: Optional schema name for multi-tenant queries.

    Returns:
        JSON string with the tool result.
    """
    match tool_name:
        case "get_schema_overview":
            return await _get_schema_overview(engine, schema_name)
        case "get_table_details":
            table_name = arguments.get("table_name", "")
            return await _get_table_details(engine, table_name, schema_name)
        case "get_relationships":
            return await _get_relationships(engine, schema_name)
        case "validate_sql":
            sql = arguments.get("sql", "")
            return await _validate_sql(engine, sql, schema_name)
        case _:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})


async def _get_schema_overview(engine: PrismiqEngine, schema_name: str | None) -> str:
    """Get a summary of all tables and columns."""
    schema = await engine.get_schema(schema_name=schema_name)

    tables_info = []
    for table in schema.tables:
        columns = [
            f"{col.name} ({col.data_type}{'*' if col.is_primary_key else ''})"
            for col in table.columns
        ]
        tables_info.append(
            {
                "table": table.name,
                "columns": columns,
                "row_count": table.row_count,
            }
        )

    return json.dumps(tables_info, indent=2)


async def _get_table_details(
    engine: PrismiqEngine, table_name: str, schema_name: str | None
) -> str:
    """Get detailed info about a specific table."""
    try:
        table = await engine.get_table(table_name, schema_name=schema_name)
    except Exception as e:
        return json.dumps({"error": str(e)})

    columns = []
    for col in table.columns:
        columns.append(
            {
                "name": col.name,
                "type": col.data_type,
                "nullable": col.is_nullable,
                "primary_key": col.is_primary_key,
                "default": col.default_value,
            }
        )

    return json.dumps(
        {
            "table": table.name,
            "schema": table.schema_name,
            "row_count": table.row_count,
            "columns": columns,
        },
        indent=2,
    )


async def _get_relationships(engine: PrismiqEngine, schema_name: str | None) -> str:
    """Get all foreign key relationships."""
    schema = await engine.get_schema(schema_name=schema_name)

    relationships = [
        {
            "from": f"{r.from_table}.{r.from_column}",
            "to": f"{r.to_table}.{r.to_column}",
        }
        for r in schema.relationships
    ]

    if not relationships:
        return json.dumps({"message": "No foreign key relationships detected."})

    return json.dumps(relationships, indent=2)


async def _validate_sql(engine: PrismiqEngine, sql: str, schema_name: str | None) -> str:
    """Validate a SQL query."""
    result = await engine.validate_sql(sql, schema_name=schema_name)

    return json.dumps(
        {
            "valid": result.valid,
            "errors": result.errors,
            "tables": result.tables,
        }
    )
