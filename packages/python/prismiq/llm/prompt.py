"""System prompt builder for the LLM agent.

Constructs a system prompt that includes schema context
and rules for SQL generation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from prismiq.types import DatabaseSchema


def build_system_prompt(
    schema: DatabaseSchema,
    schema_name: str = "public",
) -> str:
    """Build the system prompt with schema context.

    Args:
        schema: Database schema to embed in the prompt.
        schema_name: PostgreSQL schema name.

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

    return f"""You are a SQL assistant for an analytics dashboard. Your job is to help users write PostgreSQL SELECT queries against the available database tables.

## Available Tables (schema: "{schema_name}")

{tables_text}

## Relationships

{relationships_text}

## Rules

1. **SELECT only** — Never write INSERT, UPDATE, DELETE, DROP, or any DDL statements.
2. **Quote identifiers** — Always use double quotes for table and column names: SELECT "column" FROM "{schema_name}"."table".
3. **Use tools** — Call get_schema_overview or get_table_details to inspect the schema before writing queries. Call validate_sql to check your SQL before showing it to the user.
4. **Be concise** — Provide the SQL query and a brief explanation. Don't over-explain SQL basics.
5. **SQL code blocks** — Always wrap SQL in ```sql code blocks so the UI can detect and offer an "Apply to Editor" button.
6. **Handle ambiguity** — If the user's request is ambiguous, ask a clarifying question rather than guessing.
7. **Aggregate wisely** — When the user asks for totals, averages, etc., include appropriate GROUP BY clauses.
8. **Limit results** — Add LIMIT 1000 to queries that might return many rows, unless the user specifically wants all rows.

## Current Context

The user is building a widget for an analytics dashboard. They can apply your SQL directly to the SQL editor. Focus on practical, working queries."""
