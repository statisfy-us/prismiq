"""System prompt builder for the LLM agent.

Constructs a system prompt that includes schema context,
widget-specific SQL rules, and tool usage instructions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from prismiq.llm.types import WidgetContext
    from prismiq.types import DatabaseSchema

# Widget type -> SQL column structure rules
WIDGET_SQL_RULES: dict[str, str] = {
    "metric": (
        "Return exactly one row with one numeric column. "
        "Example: SELECT COUNT(*) AS value FROM table."
    ),
    "bar_chart": (
        "Return at least 2 columns: a category column (x-axis) and one or more numeric columns (y-axis). "
        "The first column is used as the x-axis category."
    ),
    "line_chart": (
        "Return at least 2 columns: an x-axis column (date or sequential value) and one or more numeric y-axis columns. "
        "Always include ORDER BY on the x-axis column."
    ),
    "area_chart": (
        "Return at least 2 columns: an x-axis column (date or sequential value) and one or more numeric y-axis columns. "
        "Always include ORDER BY on the x-axis column."
    ),
    "pie_chart": (
        "Return exactly 2 columns: a label column (string/text) and a value column (numeric). "
        "Do NOT return more or fewer columns."
    ),
    "scatter_chart": (
        "Return at least 2 numeric columns: x and y. "
        "Optionally include a label column for point identification."
    ),
    "table": ("Any columns are acceptable. Add ORDER BY for consistent sorting."),
    "text": ("No query needed — text widgets display static content."),
}


def _build_widget_section(widget_context: WidgetContext) -> str:
    """Build the widget-specific section of the system prompt."""
    lines: list[str] = ["## Target Widget"]
    lines.append(f"\nWidget type: **{widget_context.widget_type.value}**")

    # Widget-specific SQL rules
    rule = WIDGET_SQL_RULES.get(widget_context.widget_type)
    if rule:
        lines.append(f"Column requirements: {rule}")

    # User column mappings
    mappings: list[str] = []
    if widget_context.x_axis:
        mappings.append(f"x-axis = `{widget_context.x_axis}`")
    if widget_context.y_axis:
        mappings.append(f"y-axis = {', '.join(f'`{y}`' for y in widget_context.y_axis)}")
    if widget_context.series_column:
        mappings.append(f"series column = `{widget_context.series_column}`")
    if mappings:
        lines.append(f"Configured columns: {'; '.join(mappings)}")

    # Last error for self-correction
    if widget_context.last_error:
        lines.append(f"\n**Previous error**: {widget_context.last_error}")
        lines.append("Fix the issue above in your next query.")

    return "\n".join(lines)


def build_system_prompt(
    schema: DatabaseSchema,
    widget_context: WidgetContext | None = None,
) -> str:
    """Build the system prompt with schema context.

    Args:
        schema: Database schema to embed in the prompt.
        widget_context: Optional widget context for targeted SQL generation.

    Returns:
        System prompt string for the LLM.
    """
    # Build table summary
    table_summaries = []
    for table in schema.tables:
        cols = ", ".join(f"{col.name} ({col.data_type})" for col in table.columns)
        table_summaries.append(f"  - {table.name}: {cols}")

    tables_text = "\n".join(table_summaries)

    # Build relationship summary
    rel_lines = []
    for rel in schema.relationships:
        rel_lines.append(
            f"  - {rel.from_table}.{rel.from_column} -> {rel.to_table}.{rel.to_column}"
        )
    relationships_text = "\n".join(rel_lines) if rel_lines else "  (none detected)"

    # Widget section
    widget_section = ""
    if widget_context:
        widget_section = "\n\n" + _build_widget_section(widget_context)

    return f"""You are a SQL assistant for an analytics dashboard. Your job is to help users write PostgreSQL SELECT queries against the available database tables.

## Available Tables

{tables_text}

## Relationships

{relationships_text}

## Rules

1. **SELECT only** — Never write INSERT, UPDATE, DELETE, DROP, or any DDL statements.
2. **Quote identifiers** — Always use double quotes for table and column names: SELECT "column" FROM "table".
3. **No schema prefix** — Never include the schema name in queries. Write FROM "table", not FROM "schema"."table". The schema is set automatically at execution time.
4. **Use tools** — Call get_schema_overview or get_table_details to inspect the schema. Call get_column_values to look up actual values for WHERE clauses. Call validate_sql to check syntax, then execute_sql to run the query — it will automatically check if the result columns are compatible with the target widget and warn you if not. If execute_sql reports widget compatibility warnings, fix the query before presenting to the user.
5. **Be concise** — Provide the SQL query and a brief explanation. Don't over-explain SQL basics.
6. **SQL code blocks** — Always wrap SQL in ```sql code blocks so the UI can detect and offer an "Apply to Editor" button.
7. **Handle ambiguity** — If the user's request is ambiguous, ask a clarifying question rather than guessing.
8. **Aggregate wisely** — When the user asks for totals, averages, etc., include appropriate GROUP BY clauses.
9. **Limit results** — Add LIMIT 1000 to queries that might return many rows, unless the user specifically wants all rows.
{widget_section}

## Current Context

The user is building a widget for an analytics dashboard. They can apply your SQL directly to the SQL editor. Focus on practical, working queries."""
