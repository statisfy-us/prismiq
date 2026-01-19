"""SQL validation for custom SQL queries.

This module validates raw SQL queries to ensure they are safe to execute:
- Only SELECT statements allowed
- Only tables visible in the schema can be queried
"""

from __future__ import annotations

from dataclasses import dataclass

import sqlglot
import sqlglot.errors
from sqlglot import Expression, exp

from .types import DatabaseSchema, PrismiqError


class SQLValidationError(PrismiqError):
    """Raised when SQL validation fails."""

    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        super().__init__(message)
        self.errors = errors or []


@dataclass
class SQLValidationResult:
    """Result of SQL validation."""

    valid: bool
    """Whether the SQL is valid."""

    errors: list[str]
    """List of validation errors (empty if valid)."""

    tables: list[str]
    """List of tables referenced in the query."""

    sanitized_sql: str | None
    """The SQL if valid, None otherwise."""


class SQLValidator:
    """Validates raw SQL queries for safety and schema compliance."""

    ALLOWED_STATEMENT_TYPES = frozenset({"SELECT"})

    def __init__(self, schema: DatabaseSchema) -> None:
        """Initialize the validator.

        Args:
            schema: Database schema defining allowed tables.
        """
        self._schema = schema
        self._allowed_tables = frozenset(t.name.lower() for t in schema.tables)

    def validate(self, sql: str) -> SQLValidationResult:
        """Validate a raw SQL query.

        Args:
            sql: The SQL query to validate.

        Returns:
            SQLValidationResult with validation status and details.
        """
        errors: list[str] = []
        tables: list[str] = []

        # Parse the SQL
        try:
            statements = sqlglot.parse(sql, dialect="postgres")
        except sqlglot.errors.ParseError as e:
            return SQLValidationResult(
                valid=False,
                errors=[f"SQL parse error: {e}"],
                tables=[],
                sanitized_sql=None,
            )

        if not statements:
            return SQLValidationResult(
                valid=False,
                errors=["No SQL statement provided"],
                tables=[],
                sanitized_sql=None,
            )

        # Only allow single statements
        if len(statements) > 1:
            return SQLValidationResult(
                valid=False,
                errors=["Only single statements are allowed"],
                tables=[],
                sanitized_sql=None,
            )

        statement = statements[0]

        # Some parse results can be None for empty strings
        if statement is None:
            return SQLValidationResult(
                valid=False,
                errors=["Empty SQL statement"],
                tables=[],
                sanitized_sql=None,
            )

        # Check statement type
        statement_type = self._get_statement_type(statement)
        if statement_type not in self.ALLOWED_STATEMENT_TYPES:
            errors.append(
                f"Statement type '{statement_type}' is not allowed. Only SELECT statements are permitted."
            )

        # Extract and validate tables
        tables = self._extract_tables(statement)
        invalid_tables = self._check_table_access(tables)
        if invalid_tables:
            errors.append(
                f"Access denied to tables: {', '.join(sorted(invalid_tables))}. "
                f"Allowed tables: {', '.join(sorted(t.name for t in self._schema.tables))}"
            )

        # Check for dangerous operations even within SELECT
        dangerous = self._check_dangerous_operations(statement)
        if dangerous:
            errors.extend(dangerous)

        if errors:
            return SQLValidationResult(
                valid=False,
                errors=errors,
                tables=tables,
                sanitized_sql=None,
            )

        # Generate sanitized SQL
        sanitized = statement.sql(dialect="postgres")

        return SQLValidationResult(
            valid=True,
            errors=[],
            tables=tables,
            sanitized_sql=sanitized,
        )

    def _get_statement_type(self, statement: Expression) -> str:
        """Get the type of SQL statement."""
        if isinstance(statement, exp.Select):
            return "SELECT"
        if isinstance(statement, exp.Insert):
            return "INSERT"
        if isinstance(statement, exp.Update):
            return "UPDATE"
        if isinstance(statement, exp.Delete):
            return "DELETE"
        if isinstance(statement, exp.Create):
            return "CREATE"
        if isinstance(statement, exp.Drop):
            return "DROP"
        if isinstance(statement, exp.Alter):
            return "ALTER"
        if isinstance(statement, exp.Command):
            return statement.this.upper() if statement.this else "COMMAND"
        return type(statement).__name__.upper()

    def _extract_tables(self, statement: Expression) -> list[str]:
        """Extract all table names referenced in the statement."""
        tables: set[str] = set()

        # Find all Table expressions
        for table in statement.find_all(exp.Table):
            table_name = table.name
            if table_name:
                tables.add(table_name)

        return sorted(tables)

    def _check_table_access(self, tables: list[str]) -> set[str]:
        """Check if all tables are allowed.

        Returns set of invalid tables.
        """
        invalid: set[str] = set()
        for table in tables:
            if table.lower() not in self._allowed_tables:
                invalid.add(table)
        return invalid

    def _check_dangerous_operations(self, statement: Expression) -> list[str]:
        """Check for dangerous operations that could cause harm."""
        errors: list[str] = []

        # Check for INTO clause (SELECT INTO creates new table)
        if statement.find(exp.Into):
            errors.append("SELECT INTO is not allowed")

        # Check for subqueries with modifications
        for subquery in statement.find_all(exp.Subquery):
            inner = subquery.this
            if isinstance(inner, exp.Insert | exp.Update | exp.Delete):
                errors.append("Modification statements in subqueries are not allowed")

        return errors


def validate_sql(sql: str, schema: DatabaseSchema) -> SQLValidationResult:
    """Convenience function to validate SQL.

    Args:
        sql: The SQL query to validate.
        schema: Database schema defining allowed tables.

    Returns:
        SQLValidationResult with validation status and details.
    """
    validator = SQLValidator(schema)
    return validator.validate(sql)
