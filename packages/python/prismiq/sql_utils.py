"""SQL utilities for building safe parameterized queries.

This module provides generic SQL validation and formatting utilities
that can be used across different database drivers (asyncpg, SQLAlchemy,
etc.).
"""

from __future__ import annotations


def validate_identifier(identifier: str, field_name: str) -> None:
    """Validate SQL identifier to prevent injection via quote escaping.

    Args:
        identifier: The identifier to validate (table name, column name, alias)
        field_name: Name of the field for error messages (e.g., "table name")

    Raises:
        ValueError: If identifier contains dangerous characters

    Security:
        Even though identifiers are quoted with double quotes, this function
        prevents double-quote escaping and other dangerous patterns as a
        defense-in-depth measure.

    Example:
        >>> validate_identifier("users", "table name")  # OK
        >>> validate_identifier("user'; DROP TABLE users--", "table name")  # Raises
    """
    if not identifier:
        raise ValueError(f"Invalid {field_name}: cannot be empty")

    # Check for dangerous characters that could escape quoting
    dangerous_chars = ['"', "'", ";", "--", "/*", "*/", "\\"]
    for char in dangerous_chars:
        if char in identifier:
            raise ValueError(
                f"Invalid {field_name} '{identifier}': contains forbidden character '{char}'"
            )

    # Additional validation: only allow safe characters for PostgreSQL identifiers
    # - alphanumeric, underscore: standard identifier chars
    # - dot: for schema.table references
    # - space, parentheses, forward slash, hyphen, colon: common in PostgreSQL view column names
    # - non-breaking space (\xa0): sometimes used in data imported from Excel/Word
    allowed_special = ("_", ".", " ", "(", ")", "/", "-", ":", "\xa0")
    if not all(c.isalnum() or c in allowed_special for c in identifier):
        raise ValueError(f"Invalid {field_name} '{identifier}': contains invalid characters")


def quote_identifier(identifier: str) -> str:
    """Quote a SQL identifier with double quotes for PostgreSQL.

    Args:
        identifier: Identifier to quote (table, column, alias)

    Returns:
        Quoted identifier safe for SQL interpolation

    Example:
        >>> quote_identifier("users")
        '"users"'
        >>> quote_identifier("first_name")
        '"first_name"'
    """
    return f'"{identifier}"'


def convert_revealbi_date_format_to_postgres(revealbi_format: str) -> str:
    """Convert RevealBI date format to PostgreSQL TO_CHAR format.

    Args:
        revealbi_format: RevealBI date format using Java SimpleDateFormat
                         patterns (e.g., "MMM-yyyy", "MM/dd/yyyy")

    Returns:
        PostgreSQL TO_CHAR format string (e.g., "Mon-YYYY", "MM/DD/YYYY")

    Example:
        >>> convert_revealbi_date_format_to_postgres("MMM-yyyy")
        'Mon-YYYY'
        >>> convert_revealbi_date_format_to_postgres("MM/dd/yyyy")
        'MM/DD/YYYY'
    """
    # Map common RevealBI patterns (Java SimpleDateFormat) to PostgreSQL patterns
    format_map = {
        "yyyy": "YYYY",  # 4-digit year
        "yy": "YY",  # 2-digit year
        "MMMM": "Month",  # Full month name
        "MMM": "Mon",  # Abbreviated month name
        "MM": "MM",  # 2-digit month
        "M": "MM",  # 1-2 digit month (PostgreSQL doesn't have single digit, use MM)
        "dd": "DD",  # 2-digit day
        "d": "DD",  # 1-2 digit day (PostgreSQL doesn't have single digit, use DD)
        "EEEE": "Day",  # Full day name
        "EEE": "Dy",  # Abbreviated day name
        "HH": "HH24",  # 24-hour
        "hh": "HH12",  # 12-hour
        "mm": "MI",  # Minutes
        "ss": "SS",  # Seconds
    }

    # Use numeric placeholders to avoid substring matching issues
    # e.g., "MMM-yyyy" -> "<<0>>-yyyy" -> "<<0>>-<<1>>" -> "Mon-YYYY"
    placeholders: list[str] = []
    result = revealbi_format

    # Replace patterns with numeric placeholders (longest first to avoid partial matches)
    for reveal_pattern, pg_pattern in sorted(format_map.items(), key=lambda x: -len(x[0])):
        while reveal_pattern in result:
            placeholder_id = len(placeholders)
            placeholders.append(pg_pattern)
            # Use double angle brackets to avoid conflicts with format strings
            result = result.replace(reveal_pattern, f"<<{placeholder_id}>>", 1)

    # Replace numeric placeholders with actual PostgreSQL patterns
    for i, pg_pattern in enumerate(placeholders):
        result = result.replace(f"<<{i}>>", pg_pattern)

    return result


# Constants for validation
ALLOWED_JOIN_TYPES = frozenset({"INNER", "LEFT", "RIGHT", "FULL"})
ALLOWED_OPERATORS = frozenset(
    {
        "eq",
        "ne",
        "gt",
        "gte",
        "lt",
        "lte",
        "in",
        "in_",  # Alias for "in" (React types use in_)
        "in_or_null",
        "in_subquery",
        "like",
        "not_like",
    }
)
ALLOWED_AGGREGATIONS = frozenset({"none", "sum", "avg", "count", "count_distinct", "min", "max"})
ALLOWED_DATE_TRUNCS = frozenset(
    {"year", "quarter", "month", "week", "day", "hour", "minute", "second"}
)
ALLOWED_ORDER_DIRECTIONS = frozenset({"ASC", "DESC"})
