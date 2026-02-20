"""Tool definitions and execution for the LLM agent.

The agent can use these tools to inspect the database schema,
validate SQL queries, execute queries, and look up column values.
"""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any

from prismiq.llm.types import ToolDefinition, WidgetContext

if TYPE_CHECKING:
    from prismiq.engine import PrismiqEngine

_logger = logging.getLogger(__name__)

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

TOOL_EXECUTE_SQL = ToolDefinition(
    name="execute_sql",
    description=(
        "Execute a SQL query and return results. Use this to verify that your "
        "generated SQL runs successfully and returns the expected column structure "
        "for the target widget. Returns columns, types, sample rows, row count, "
        "and widget compatibility warnings if applicable."
    ),
    parameters={
        "type": "object",
        "properties": {
            "sql": {
                "type": "string",
                "description": "SQL SELECT query to execute.",
            },
        },
        "required": ["sql"],
    },
)

TOOL_GET_COLUMN_VALUES = ToolDefinition(
    name="get_column_values",
    description=(
        "Get distinct sample values from a specific column. Use this when you need "
        "to write WHERE clauses with accurate filter values, or to understand "
        "what values exist in a column (e.g., status values, categories, regions)."
    ),
    parameters={
        "type": "object",
        "properties": {
            "table_name": {
                "type": "string",
                "description": "Name of the table.",
            },
            "column_name": {
                "type": "string",
                "description": "Name of the column.",
            },
        },
        "required": ["table_name", "column_name"],
    },
)

ALL_TOOLS = [
    TOOL_GET_SCHEMA_OVERVIEW,
    TOOL_GET_TABLE_DETAILS,
    TOOL_GET_RELATIONSHIPS,
    TOOL_VALIDATE_SQL,
    TOOL_EXECUTE_SQL,
    TOOL_GET_COLUMN_VALUES,
]


# ============================================================================
# Tool Execution
# ============================================================================


async def execute_tool(
    tool_name: str,
    arguments: dict[str, Any],
    engine: PrismiqEngine,
    schema_name: str | None = None,
    widget_context: WidgetContext | None = None,
) -> str:
    """Execute a tool and return the result as a string.

    Args:
        tool_name: Name of the tool to execute.
        arguments: Arguments for the tool.
        engine: PrismiqEngine instance for database access.
        schema_name: Optional schema name for multi-tenant queries.
        widget_context: Optional widget context for compatibility validation.

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
        case "execute_sql":
            sql = arguments.get("sql", "")
            return await _execute_sql(engine, sql, schema_name, widget_context)
        case "get_column_values":
            table_name = arguments.get("table_name", "")
            column_name = arguments.get("column_name", "")
            return await _get_column_values(engine, table_name, column_name, schema_name)
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


async def _execute_sql(
    engine: PrismiqEngine,
    sql: str,
    schema_name: str | None,
    widget_context: WidgetContext | None,
) -> str:
    """Execute a SQL query and return results with optional widget compatibility check."""
    try:
        start = time.monotonic()
        result = await engine.execute_raw_sql(sql, schema_name=schema_name)
        elapsed_ms = (time.monotonic() - start) * 1000
    except Exception as e:
        _logger.warning("execute_sql tool: query failed: %s", e)
        return json.dumps({"error": str(e)}, default=str)

    # Post-processing outside try/except so bugs are not silently swallowed
    preview_rows = [[_truncate_value(v) for v in row] for row in result.rows[:5]]

    output: dict[str, Any] = {
        "columns": result.columns,
        "column_types": result.column_types,
        "row_count": result.row_count,
        "preview_rows": preview_rows,
        "execution_time_ms": round(elapsed_ms, 1),
    }

    # Widget compatibility check
    if widget_context:
        compat = validate_widget_compatibility(
            widget_context.widget_type,
            result.columns,
            result.column_types,
            result.row_count,
        )
        output["widget_compatibility"] = compat

    return json.dumps(output, default=str)


async def _get_column_values(
    engine: PrismiqEngine,
    table_name: str,
    column_name: str,
    schema_name: str | None,
) -> str:
    """Get distinct sample values from a column."""
    try:
        values = await engine.sample_column_values(
            table_name, column_name, limit=50, schema_name=schema_name
        )
    except Exception as e:
        _logger.warning("get_column_values tool failed: %s", e)
        return json.dumps({"error": str(e)}, default=str)

    return json.dumps({"table": table_name, "column": column_name, "values": values}, default=str)


def _truncate_value(value: Any, max_len: int = 100) -> Any:
    """Truncate long string values to save LLM context tokens."""
    if isinstance(value, str) and len(value) > max_len:
        return value[:max_len] + "..."
    return value


# ============================================================================
# Widget Compatibility Validation
# ============================================================================

_NUMERIC_TYPES = frozenset(
    {
        "integer",
        "bigint",
        "smallint",
        "numeric",
        "decimal",
        "real",
        "double precision",
        "money",
    }
)

_NUMERIC_PREFIXES = ("int", "float", "serial")


def _is_numeric_type(pg_type: str) -> bool:
    """Check if a PostgreSQL type is numeric."""
    normalized = pg_type.lower().strip()
    if normalized in _NUMERIC_TYPES:
        return True
    return any(normalized.startswith(p) for p in _NUMERIC_PREFIXES)


def validate_widget_compatibility(
    widget_type: str,
    columns: list[str],
    column_types: list[str],
    row_count: int,
) -> dict[str, Any]:
    """Check if query result columns are compatible with the widget type.

    Returns a dict with 'compatible' (bool) and 'warnings' (list of strings).
    """
    warnings: list[str] = []
    num_cols = len(columns)
    numeric_flags = [_is_numeric_type(t) for t in column_types]
    numeric_count = sum(numeric_flags)

    match widget_type:
        case "metric":
            if row_count == 0:
                warnings.append("Query returns 0 rows; metric needs at least 1 row.")
            if numeric_count == 0:
                warnings.append("No numeric columns found; metric needs at least 1 numeric column.")

        case "pie_chart":
            if num_cols != 2:
                warnings.append(
                    f"pie_chart requires exactly 2 columns (label + value) but query returns {num_cols}."
                )
            elif numeric_flags[0]:
                warnings.append(
                    "pie_chart expects the 1st column to be a label (non-numeric), but it appears numeric."
                )
            elif not numeric_flags[1]:
                warnings.append(
                    "pie_chart expects the 2nd column to be numeric (value), but it appears non-numeric."
                )

        case "bar_chart":
            if num_cols < 2:
                warnings.append(
                    f"bar_chart needs at least 2 columns (category + value) but query returns {num_cols}."
                )
            elif numeric_count == 0:
                warnings.append("No numeric columns found for y-axis values.")

        case "line_chart" | "area_chart":
            if num_cols < 2:
                warnings.append(
                    f"{widget_type} needs at least 2 columns (x-axis + y-axis) but query returns {num_cols}."
                )
            elif numeric_count == 0:
                warnings.append("No numeric columns found for y-axis values.")

        case "scatter_chart":
            if numeric_count < 2:
                warnings.append(
                    f"scatter_chart needs at least 2 numeric columns but only found {numeric_count}."
                )

        case "table" | "text":
            pass  # Always compatible

        case _:
            warnings.append(
                f"Unknown widget type '{widget_type}'; cannot validate column compatibility."
            )

    return {
        "compatible": len(warnings) == 0,
        "warnings": warnings,
    }
