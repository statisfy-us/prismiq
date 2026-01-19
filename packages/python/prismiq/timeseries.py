"""Time series bucketing utilities for Prismiq analytics.

This module provides utilities for grouping data by time intervals,
generating time buckets, and filling missing data points.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict


class TimeInterval(str, Enum):
    """Time intervals for bucketing."""

    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class TimeBucket(BaseModel):
    """A time bucket with start and end times."""

    model_config = ConfigDict(strict=True)

    start: datetime
    """Start of the time bucket (inclusive)."""

    end: datetime
    """End of the time bucket (exclusive for next bucket)."""

    label: str
    """Human-readable label like 'Jan 2024'."""


def get_date_trunc_sql(interval: TimeInterval, column: str) -> str:
    """Generate PostgreSQL date_trunc expression.

    Args:
        interval: Time interval for truncation.
        column: Column name to truncate.

    Returns:
        SQL expression like: date_trunc('day', "order_date")

    Example:
        >>> get_date_trunc_sql(TimeInterval.DAY, "order_date")
        'date_trunc(\\'day\\', "order_date")'
    """
    # Quote the column name to prevent SQL injection
    escaped_column = column.replace('"', '""')
    quoted_column = f'"{escaped_column}"'

    return f"date_trunc('{interval.value}', {quoted_column})"


def get_interval_format(interval: TimeInterval) -> str:
    """Get the appropriate date format string for the interval.

    Args:
        interval: Time interval.

    Returns:
        Format string suitable for datetime.strftime().
        Note: Quarter format returns a special marker that needs post-processing.

    Example:
        >>> get_interval_format(TimeInterval.DAY)
        '%Y-%m-%d'
    """
    format_map = {
        TimeInterval.MINUTE: "%Y-%m-%d %H:%M",
        TimeInterval.HOUR: "%Y-%m-%d %H:00",
        TimeInterval.DAY: "%Y-%m-%d",
        TimeInterval.WEEK: "%Y-W%W",
        TimeInterval.MONTH: "%Y-%m",
        TimeInterval.QUARTER: "%Y-Q%q",  # Special marker, needs post-processing
        TimeInterval.YEAR: "%Y",
    }
    return format_map[interval]


def _format_bucket_label(dt: datetime, interval: TimeInterval) -> str:
    """Format a datetime as a human-readable bucket label.

    Args:
        dt: Datetime to format.
        interval: Time interval for context.

    Returns:
        Human-readable label.
    """
    if interval == TimeInterval.MINUTE:
        return dt.strftime("%b %d, %H:%M")

    if interval == TimeInterval.HOUR:
        return dt.strftime("%b %d, %H:00")

    if interval == TimeInterval.DAY:
        return dt.strftime("%b %d")

    if interval == TimeInterval.WEEK:
        # ISO week number
        week_num = dt.isocalendar()[1]
        return f"Week {week_num}, {dt.year}"

    if interval == TimeInterval.MONTH:
        return dt.strftime("%b %Y")

    if interval == TimeInterval.QUARTER:
        quarter = (dt.month - 1) // 3 + 1
        return f"Q{quarter} {dt.year}"

    if interval == TimeInterval.YEAR:
        return str(dt.year)

    # Fallback
    return dt.isoformat()


def _truncate_datetime(dt: datetime, interval: TimeInterval) -> datetime:
    """Truncate datetime to the start of the given interval.

    Args:
        dt: Datetime to truncate.
        interval: Interval to truncate to.

    Returns:
        Truncated datetime.
    """
    # Remove timezone info for consistent handling
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)

    if interval == TimeInterval.MINUTE:
        return dt.replace(second=0, microsecond=0)

    if interval == TimeInterval.HOUR:
        return dt.replace(minute=0, second=0, microsecond=0)

    if interval == TimeInterval.DAY:
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)

    if interval == TimeInterval.WEEK:
        # Week starts on Monday
        days_since_monday = dt.weekday()
        week_start = dt - timedelta(days=days_since_monday)
        return week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    if interval == TimeInterval.MONTH:
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if interval == TimeInterval.QUARTER:
        quarter = (dt.month - 1) // 3
        quarter_start_month = quarter * 3 + 1
        return dt.replace(
            month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0
        )

    if interval == TimeInterval.YEAR:
        return dt.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    return dt


def _get_next_bucket_start(dt: datetime, interval: TimeInterval) -> datetime:
    """Get the start of the next bucket after the given datetime.

    Args:
        dt: Current bucket start.
        interval: Time interval.

    Returns:
        Start of the next bucket.
    """
    if interval == TimeInterval.MINUTE:
        return dt + timedelta(minutes=1)

    if interval == TimeInterval.HOUR:
        return dt + timedelta(hours=1)

    if interval == TimeInterval.DAY:
        return dt + timedelta(days=1)

    if interval == TimeInterval.WEEK:
        return dt + timedelta(weeks=1)

    if interval == TimeInterval.MONTH:
        # Move to next month
        if dt.month == 12:
            return dt.replace(year=dt.year + 1, month=1)
        return dt.replace(month=dt.month + 1)

    if interval == TimeInterval.QUARTER:
        # Move to next quarter (3 months)
        new_month = dt.month + 3
        if new_month > 12:
            return dt.replace(year=dt.year + 1, month=new_month - 12)
        return dt.replace(month=new_month)

    if interval == TimeInterval.YEAR:
        return dt.replace(year=dt.year + 1)

    return dt + timedelta(days=1)


def _get_bucket_end(bucket_start: datetime, interval: TimeInterval) -> datetime:
    """Get the end datetime for a bucket (last moment before next bucket).

    Args:
        bucket_start: Start of the bucket.
        interval: Time interval.

    Returns:
        End of the bucket (last microsecond before next bucket).
    """
    next_start = _get_next_bucket_start(bucket_start, interval)
    # End is one microsecond before the next bucket starts
    return next_start - timedelta(microseconds=1)


def generate_time_buckets(
    start: datetime,
    end: datetime,
    interval: TimeInterval,
) -> list[TimeBucket]:
    """Generate all time buckets between start and end.

    Args:
        start: Start datetime (inclusive).
        end: End datetime (inclusive).
        interval: Time interval for bucketing.

    Returns:
        List of TimeBucket objects covering the range.

    Example:
        >>> from datetime import datetime
        >>> start = datetime(2024, 1, 1)
        >>> end = datetime(2024, 1, 3)
        >>> buckets = generate_time_buckets(start, end, TimeInterval.DAY)
        >>> len(buckets)
        3
    """
    # Handle timezone-aware datetimes by converting to naive
    if start.tzinfo is not None:
        start = start.replace(tzinfo=None)
    if end.tzinfo is not None:
        end = end.replace(tzinfo=None)

    # Truncate start to the beginning of its interval
    current = _truncate_datetime(start, interval)

    buckets: list[TimeBucket] = []

    while current <= end:
        bucket_end = _get_bucket_end(current, interval)
        label = _format_bucket_label(current, interval)

        buckets.append(
            TimeBucket(
                start=current,
                end=bucket_end,
                label=label,
            )
        )

        current = _get_next_bucket_start(current, interval)

    return buckets


def fill_missing_buckets(
    data: list[dict[str, Any]],
    date_column: str,
    buckets: list[TimeBucket],
    fill_value: Any = 0,
) -> list[dict[str, Any]]:
    """Fill missing time buckets with default values.

    Takes query result data and fills in missing time periods with
    default values for numeric columns.

    Args:
        data: List of row dictionaries from query result.
        date_column: Name of the date/datetime column.
        buckets: List of time buckets to ensure coverage.
        fill_value: Value to use for missing numeric data (default: 0).

    Returns:
        List of row dictionaries with missing buckets filled.

    Example:
        >>> data = [
        ...     {"date": datetime(2024, 1, 1), "sales": 100},
        ...     {"date": datetime(2024, 1, 3), "sales": 150},
        ... ]
        >>> buckets = generate_time_buckets(
        ...     datetime(2024, 1, 1), datetime(2024, 1, 3), TimeInterval.DAY
        ... )
        >>> filled = fill_missing_buckets(data, "date", buckets)
        >>> len(filled)  # Now includes Jan 2
        3
    """
    if not buckets:
        return data

    if not data:
        # No data, create empty rows for all buckets
        return [{date_column: bucket.start} for bucket in buckets]

    # Build a map of bucket start -> existing data rows
    bucket_data: dict[datetime, list[dict[str, Any]]] = {}

    # Get all columns from first data row for template
    template_row = data[0]
    all_columns = list(template_row.keys())

    # Determine which interval we're using based on bucket size
    # (we need this to truncate data dates properly)
    if len(buckets) >= 2:
        diff = buckets[1].start - buckets[0].start
        if diff <= timedelta(minutes=1):
            interval = TimeInterval.MINUTE
        elif diff <= timedelta(hours=1):
            interval = TimeInterval.HOUR
        elif diff <= timedelta(days=1):
            interval = TimeInterval.DAY
        elif diff <= timedelta(weeks=1):
            interval = TimeInterval.WEEK
        elif diff <= timedelta(days=32):
            interval = TimeInterval.MONTH
        elif diff <= timedelta(days=100):
            interval = TimeInterval.QUARTER
        else:
            interval = TimeInterval.YEAR
    else:
        # Single bucket, guess from bucket duration
        diff = buckets[0].end - buckets[0].start
        if diff <= timedelta(minutes=1):
            interval = TimeInterval.MINUTE
        elif diff <= timedelta(hours=1):
            interval = TimeInterval.HOUR
        elif diff <= timedelta(days=1):
            interval = TimeInterval.DAY
        elif diff <= timedelta(weeks=1):
            interval = TimeInterval.WEEK
        elif diff <= timedelta(days=32):
            interval = TimeInterval.MONTH
        elif diff <= timedelta(days=100):
            interval = TimeInterval.QUARTER
        else:
            interval = TimeInterval.YEAR

    # Map existing data to buckets
    for row in data:
        date_val = row.get(date_column)
        if date_val is None:
            continue

        # Convert to datetime if it's a date
        if hasattr(date_val, "hour"):
            dt = date_val
        else:
            # It's a date, convert to datetime
            dt = datetime.combine(date_val, datetime.min.time())

        # Handle timezone
        if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)

        # Truncate to bucket start
        bucket_start = _truncate_datetime(dt, interval)

        if bucket_start not in bucket_data:
            bucket_data[bucket_start] = []
        bucket_data[bucket_start].append(row)

    # Build result with all buckets
    result: list[dict[str, Any]] = []

    for bucket in buckets:
        existing_rows = bucket_data.get(bucket.start, [])

        if existing_rows:
            # Use existing data
            result.extend(existing_rows)
        else:
            # Create a filled row
            filled_row: dict[str, Any] = {}
            for col in all_columns:
                if col == date_column:
                    filled_row[col] = bucket.start
                else:
                    # Check if original column was numeric
                    sample_value = template_row.get(col)
                    if isinstance(sample_value, int | float):
                        filled_row[col] = fill_value
                    else:
                        filled_row[col] = None
            result.append(filled_row)

    return result
