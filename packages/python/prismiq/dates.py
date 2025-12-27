"""
Date/time utilities for Prismiq analytics.

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


def resolve_date_preset(preset: DatePreset, reference: date | None = None) -> tuple[date, date]:
    """
    Convert a date preset to a concrete (start_date, end_date) tuple.

    Args:
        preset: The relative date preset to resolve.
        reference: Reference date for calculations. Defaults to today.

    Returns:
        Tuple of (start_date, end_date) representing the date range.

    Example:
        >>> resolve_date_preset(DatePreset.LAST_7_DAYS, date(2024, 1, 15))
        (date(2024, 1, 9), date(2024, 1, 15))
    """
    ref = reference or date.today()

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
        quarter = (ref.month - 1) // 3
        start_month = quarter * 3 + 1
        start = ref.replace(month=start_month, day=1)
        return start, ref

    if preset == DatePreset.LAST_QUARTER:
        # Find start of current quarter
        current_quarter = (ref.month - 1) // 3
        current_quarter_start_month = current_quarter * 3 + 1

        # Go to previous quarter
        if current_quarter == 0:
            # Q1 -> Q4 of previous year
            last_quarter_start = ref.replace(year=ref.year - 1, month=10, day=1)
            last_quarter_end = ref.replace(year=ref.year - 1, month=12, day=31)
        else:
            last_quarter_start_month = current_quarter_start_month - 3
            last_quarter_end_month = current_quarter_start_month - 1
            last_quarter_start = ref.replace(month=last_quarter_start_month, day=1)
            last_day = calendar.monthrange(ref.year, last_quarter_end_month)[1]
            last_quarter_end = ref.replace(month=last_quarter_end_month, day=last_day)

        return last_quarter_start, last_quarter_end

    if preset == DatePreset.THIS_YEAR:
        start = ref.replace(month=1, day=1)
        return start, ref

    if preset == DatePreset.LAST_YEAR:
        start = ref.replace(year=ref.year - 1, month=1, day=1)
        end = ref.replace(year=ref.year - 1, month=12, day=31)
        return start, end

    if preset == DatePreset.ALL_TIME:
        # Use a very early date as start
        return date(1970, 1, 1), ref

    # Default fallback (should not reach here)
    return ref, ref


def date_trunc(unit: str, dt: datetime) -> datetime:
    """
    Truncate datetime to the specified unit.

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
    """
    Add years, months, and days to a date.

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
    """
    Generate SQL WHERE clause for a date preset.

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
