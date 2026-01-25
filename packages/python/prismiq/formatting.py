"""Number formatting utilities for Prismiq analytics.

This module provides utilities for formatting numbers in various styles
commonly used in dashboards and reports.
"""

from __future__ import annotations

import math
from decimal import Decimal
from enum import Enum


class NumberFormat(str, Enum):
    """Number formatting styles."""

    PLAIN = "plain"  # 1234567.89
    COMPACT = "compact"  # 1.2M
    CURRENCY = "currency"  # $1,234,567.89
    PERCENT = "percent"  # 12.34%
    FIXED = "fixed"  # 1234567.89 (with specified decimals)


def format_number(
    value: int | float | Decimal | None,
    format_type: NumberFormat = NumberFormat.PLAIN,
    decimals: int = 2,
    currency_symbol: str = "$",
    compact_threshold: int = 1000,
    locale: str = "en_US",
) -> str:
    """Format a number according to the specified style.

    Args:
        value: The number to format. None returns empty string.
        format_type: The formatting style to use.
        decimals: Number of decimal places (used by FIXED, CURRENCY, PERCENT).
        currency_symbol: Symbol for currency formatting.
        compact_threshold: Minimum value for compact notation.
        locale: Locale for number formatting (currently supports en_US).

    Returns:
        Formatted string representation.

    Example:
        >>> format_number(1234567.89, NumberFormat.CURRENCY)
        '$1,234,567.89'
        >>> format_number(1234567, NumberFormat.COMPACT)
        '1.2M'
    """
    if value is None:
        return ""

    # Convert Decimal to float for calculations
    num = float(value)

    # Handle NaN
    if math.isnan(num):
        return "N/A"

    # Handle infinity
    if math.isinf(num):
        return "Infinity" if num > 0 else "-Infinity"

    if format_type == NumberFormat.PLAIN:
        return _format_plain(num)

    if format_type == NumberFormat.COMPACT:
        if abs(num) < compact_threshold:
            return _format_with_separators(num, 0 if num == int(num) else decimals, locale)
        return format_compact(num, decimals=1)

    if format_type == NumberFormat.CURRENCY:
        return format_currency(num, symbol=currency_symbol, decimals=decimals, locale=locale)

    if format_type == NumberFormat.PERCENT:
        return format_percent(num, decimals=decimals)

    if format_type == NumberFormat.FIXED:
        return _format_with_separators(num, decimals, locale)

    # Fallback
    return str(num)


def format_compact(value: float, decimals: int = 1) -> str:
    """Format number in compact notation (K, M, B, T).

    Args:
        value: The number to format.
        decimals: Number of decimal places.

    Returns:
        Compact string representation (e.g., "1.2M").

    Example:
        >>> format_compact(1234567)
        '1.2M'
        >>> format_compact(-1500)
        '-1.5K'
    """
    if math.isnan(value):
        return "N/A"

    if math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"

    abs_value = abs(value)
    sign = "-" if value < 0 else ""

    if abs_value < 1000:
        if abs_value == int(abs_value):
            return f"{sign}{int(abs_value)}"
        return f"{sign}{abs_value:.{decimals}f}"

    if abs_value < 1_000_000:
        result = abs_value / 1000
        return f"{sign}{result:.{decimals}f}K"

    if abs_value < 1_000_000_000:
        result = abs_value / 1_000_000
        return f"{sign}{result:.{decimals}f}M"

    if abs_value < 1_000_000_000_000:
        result = abs_value / 1_000_000_000
        return f"{sign}{result:.{decimals}f}B"

    result = abs_value / 1_000_000_000_000
    return f"{sign}{result:.{decimals}f}T"


def format_currency(
    value: float,
    symbol: str = "$",
    decimals: int = 2,
    locale: str = "en_US",
) -> str:
    """Format as currency with thousands separators.

    Args:
        value: The number to format.
        symbol: Currency symbol (e.g., "$", "EUR").
        decimals: Number of decimal places.
        locale: Locale for number formatting.

    Returns:
        Currency formatted string (e.g., "$1,234.56").

    Example:
        >>> format_currency(1234.56)
        '$1,234.56'
        >>> format_currency(-1234.56, symbol="EUR")
        '-EUR1,234.56'
    """
    if math.isnan(value):
        return "N/A"

    if math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"

    sign = "-" if value < 0 else ""
    formatted = _format_with_separators(abs(value), decimals, locale)
    return f"{sign}{symbol}{formatted}"


def format_percent(value: float, decimals: int = 2) -> str:
    """Format as percentage.

    The value is expected to be a ratio (e.g., 0.1234 for 12.34%).

    Args:
        value: The ratio to format (0.1234 becomes 12.34%).
        decimals: Number of decimal places.

    Returns:
        Percentage string (e.g., "12.34%").

    Example:
        >>> format_percent(0.1234)
        '12.34%'
        >>> format_percent(1.5)
        '150.00%'
    """
    if math.isnan(value):
        return "N/A"

    if math.isinf(value):
        return "Infinity%" if value > 0 else "-Infinity%"

    percent = value * 100
    return f"{percent:.{decimals}f}%"


def parse_number(value: str) -> float | None:
    """Parse a formatted number string back to float.

    Handles common formats including currency symbols, percentage signs,
    thousands separators, and compact notation.

    Args:
        value: The formatted string to parse.

    Returns:
        The numeric value, or None if parsing fails.

    Example:
        >>> parse_number("$1,234.56")
        1234.56
        >>> parse_number("1.5M")
        1500000.0
        >>> parse_number("12.34%")
        0.1234
    """
    if not value or value.strip() == "":
        return None

    original = value.strip()

    # Handle special values
    if original.lower() in ("n/a", "nan"):
        return float("nan")
    if original.lower() == "infinity":
        return float("inf")
    if original.lower() == "-infinity":
        return float("-inf")

    # Check for negative
    is_negative = original.startswith("-")
    if is_negative:
        original = original[1:]

    # Handle percentage
    if original.endswith("%"):
        try:
            num = float(original[:-1].replace(",", ""))
            result = num / 100
            return -result if is_negative else result
        except ValueError:
            return None

    # Remove currency symbols (common ones)
    currency_symbols = ["$", "EUR", "GBP", "JPY", "CNY"]
    for sym in currency_symbols:
        if original.startswith(sym):
            original = original[len(sym) :]
            break
        # Handle symbol at end (some locales)
        if original.endswith(sym):
            original = original[: -len(sym)]
            break

    original = original.strip()

    # Handle compact notation
    compact_suffixes = {
        "K": 1_000,
        "M": 1_000_000,
        "B": 1_000_000_000,
        "T": 1_000_000_000_000,
    }

    for suffix, multiplier in compact_suffixes.items():
        if original.upper().endswith(suffix):
            try:
                num = float(original[:-1].replace(",", "")) * multiplier
                return -num if is_negative else num
            except ValueError:
                return None

    # Remove thousands separators and parse
    try:
        clean = original.replace(",", "")
        num = float(clean)
        return -num if is_negative else num
    except ValueError:
        return None


def _format_plain(value: float) -> str:
    """Format as plain number without separators."""
    if value == int(value):
        return str(int(value))
    return str(value)


def _format_with_separators(value: float, decimals: int, locale: str) -> str:
    """Format number with thousands separators."""
    # For en_US locale (and default), use comma as thousands separator
    if locale in ("en_US", "en_GB", "en"):
        if decimals == 0:
            return f"{value:,.0f}"
        return f"{value:,.{decimals}f}"

    # For other locales, use simple formatting
    # (Full locale support would require the locale module)
    if decimals == 0:
        return f"{value:,.0f}"
    return f"{value:,.{decimals}f}"
