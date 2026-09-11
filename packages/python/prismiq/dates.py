"""Date/time utilities for Prismiq analytics.

This module provides utilities for handling relative date expressions
and date manipulation commonly used in dashboard filters.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from enum import Enum


class DatePreset(str, Enum):
    """Relative date presets for dashboard filters."""

    TODAY = "today"
    YESTERDAY = "yesterday"
    LAST_7_DAYS = "last_7_days"
    LAST_30_DAYS = "last_30_days"
    THIS_WEEK = "this_week"
    LAST_WEEK = "last_week"
    THIS_MONTH = "this_month"
    LAST_MONTH = "last_month"
    THIS_QUARTER = "this_quarter"
    LAST_QUARTER = "last_quarter"
    THIS_YEAR = "this_year"
    LAST_YEAR = "last_year"
    ALL_TIME = "all_time"


def resolve_date_preset(
    preset: DatePreset,
    reference: date | None = None,
    fiscal_year_start_month: int = 1,
) -> tuple[date, date]:
    """Convert a date preset to a concrete (start_date, end_date) tuple.

    Args:
        preset: The relative date preset to resolve.
        reference: Reference date for calculations. Defaults to today.
        fiscal_year_start_month: Month (1-12) when the fiscal year starts.
            Quarter and year presets resolve against the fiscal calendar;
            with the default of 1 they behave as calendar quarters/years.

    Returns:
        Tuple of (start_date, end_date) representing the date range.

    Example:
        >>> resolve_date_preset(DatePreset.LAST_7_DAYS, date(2024, 1, 15))
        (date(2024, 1, 9), date(2024, 1, 15))
    """
    ref = reference or date.today()
    fy_start = fiscal_year_start_month if 1 <= fiscal_year_start_month <= 12 else 1

    if preset == DatePreset.TODAY:
        return ref, ref

    if preset == DatePreset.YESTERDAY:
        yesterday = ref - timedelta(days=1)
        return yesterday, yesterday

    if preset == DatePreset.LAST_7_DAYS:
        start = ref - timedelta(days=6)
        return start, ref

    if preset == DatePreset.LAST_30_DAYS:
        start = ref - timedelta(days=29)
        return start, ref

    if preset == DatePreset.THIS_WEEK:
        # Week starts on Monday (weekday() = 0)
        start = ref - timedelta(days=ref.weekday())
        return start, ref

    if preset == DatePreset.LAST_WEEK:
        # Find start of this week, then go back 7 days
        this_week_start = ref - timedelta(days=ref.weekday())
        last_week_start = this_week_start - timedelta(days=7)
        last_week_end = this_week_start - timedelta(days=1)
        return last_week_start, last_week_end

    if preset == DatePreset.THIS_MONTH:
        start = ref.replace(day=1)
        return start, ref

    if preset == DatePreset.LAST_MONTH:
        # First day of this month
        this_month_start = ref.replace(day=1)
        # Last day of previous month
        last_month_end = this_month_start - timedelta(days=1)
        # First day of previous month
        last_month_start = last_month_end.replace(day=1)
        return last_month_start, last_month_end

    if preset == DatePreset.THIS_QUARTER:
        start = _fiscal_quarter_start(ref, fy_start)
        return start, _quarter_end(start)

    if preset == DatePreset.LAST_QUARTER:
        this_q_start = _fiscal_quarter_start(ref, fy_start)
        last_q_start = date_add(this_q_start, months=-3)
        return last_q_start, _quarter_end(last_q_start)

    if preset == DatePreset.THIS_YEAR:
        start = _fiscal_year_start(ref, fy_start)
        return start, date_add(start, years=1, days=-1)

    if preset == DatePreset.LAST_YEAR:
        this_fy_start = _fiscal_year_start(ref, fy_start)
        start = date_add(this_fy_start, years=-1)
        return start, this_fy_start - timedelta(days=1)

    if preset == DatePreset.ALL_TIME:
        # Use a very early date as start
        return date(1970, 1, 1), ref

    # Default fallback (should not reach here)
    return ref, ref


def _fiscal_year_start(ref: date, fy_start_month: int) -> date:
    """First day of the fiscal year containing *ref*."""
    year = ref.year if ref.month >= fy_start_month else ref.year - 1
    return date(year, fy_start_month, 1)


def _fiscal_quarter_start(ref: date, fy_start_month: int) -> date:
    """First day of the fiscal quarter containing *ref*."""
    months_into_fy = (ref.month - fy_start_month) % 12
    quarter_index = months_into_fy // 3
    return date_add(_fiscal_year_start(ref, fy_start_month), months=quarter_index * 3)


def _quarter_end(quarter_start: date) -> date:
    """Last day of the quarter beginning at *quarter_start*."""
    return date_add(quarter_start, months=3, days=-1)


def date_trunc(unit: str, dt: datetime) -> datetime:
    """Truncate datetime to the specified unit.

    Args:
        unit: Truncation unit - one of 'day', 'week', 'month', 'quarter', 'year'.
        dt: The datetime to truncate.

    Returns:
        Truncated datetime.

    Raises:
        ValueError: If an invalid unit is provided.

    Example:
        >>> date_trunc("month", datetime(2024, 3, 15, 10, 30, 45))
        datetime(2024, 3, 1, 0, 0, 0)
    """
    unit_lower = unit.lower()

    if unit_lower == "day":
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)

    if unit_lower == "week":
        # Week starts on Monday
        days_since_monday = dt.weekday()
        week_start = dt - timedelta(days=days_since_monday)
        return week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    if unit_lower == "month":
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if unit_lower == "quarter":
        quarter = (dt.month - 1) // 3
        quarter_start_month = quarter * 3 + 1
        return dt.replace(
            month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0
        )

    if unit_lower == "year":
        return dt.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    raise ValueError(
        f"Invalid truncation unit: {unit}. Must be one of: day, week, month, quarter, year"
    )


def date_add(dt: date, years: int = 0, months: int = 0, days: int = 0) -> date:
    """Add years, months, and days to a date.

    Handles edge cases like adding months that would result in invalid dates
    (e.g., Jan 31 + 1 month becomes Feb 28/29).

    Args:
        dt: The base date.
        years: Number of years to add (can be negative).
        months: Number of months to add (can be negative).
        days: Number of days to add (can be negative).

    Returns:
        New date with the additions applied.

    Example:
        >>> date_add(date(2024, 1, 31), months=1)
        date(2024, 2, 29)  # Leap year, clamps to valid day
    """
    # First add years and months
    new_year = dt.year + years
    new_month = dt.month + months

    # Handle month overflow/underflow
    while new_month > 12:
        new_month -= 12
        new_year += 1
    while new_month < 1:
        new_month += 12
        new_year -= 1

    # Clamp day to valid range for the new month
    max_day = calendar.monthrange(new_year, new_month)[1]
    new_day = min(dt.day, max_day)

    result = date(new_year, new_month, new_day)

    # Then add days
    if days != 0:
        result = result + timedelta(days=days)

    return result


def get_date_range_sql(preset: DatePreset, column: str) -> tuple[str, list[date]]:
    """Generate SQL WHERE clause for a date preset.

    Args:
        preset: The date preset to generate SQL for.
        column: The column name to filter on.

    Returns:
        Tuple of (sql_fragment, params) where params uses positional placeholders.
        The sql_fragment uses $1, $2 style placeholders.

    Example:
        >>> get_date_range_sql(DatePreset.LAST_7_DAYS, "order_date")
        ('"order_date" >= $1 AND "order_date" <= $2', [date(2024, 1, 9), date(2024, 1, 15)])
    """
    start_date, end_date = resolve_date_preset(preset)

    # Quote the column name to prevent SQL injection
    escaped_column = column.replace('"', '""')
    quoted_column = f'"{escaped_column}"'

    if preset == DatePreset.ALL_TIME:
        # For ALL_TIME, we only need the upper bound
        sql = f"{quoted_column} <= $1"
        return sql, [end_date]

    sql = f"{quoted_column} >= $1 AND {quoted_column} <= $2"
    return sql, [start_date, end_date]
