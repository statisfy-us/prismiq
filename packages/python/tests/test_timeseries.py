"""Tests for time series bucketing utilities."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from prismiq.timeseries import (
    TimeBucket,
    TimeInterval,
    fill_missing_buckets,
    generate_time_buckets,
    get_date_trunc_sql,
    get_interval_format,
)

# ============================================================================
# get_date_trunc_sql Tests
# ============================================================================


class TestGetDateTruncSql:
    """Tests for get_date_trunc_sql function."""

    def test_day_interval(self) -> None:
        """Test date_trunc SQL for day interval."""
        result = get_date_trunc_sql(TimeInterval.DAY, "order_date")
        assert result == "date_trunc('day', \"order_date\")"

    def test_month_interval(self) -> None:
        """Test date_trunc SQL for month interval."""
        result = get_date_trunc_sql(TimeInterval.MONTH, "created_at")
        assert result == "date_trunc('month', \"created_at\")"

    def test_year_interval(self) -> None:
        """Test date_trunc SQL for year interval."""
        result = get_date_trunc_sql(TimeInterval.YEAR, "timestamp")
        assert result == "date_trunc('year', \"timestamp\")"

    def test_hour_interval(self) -> None:
        """Test date_trunc SQL for hour interval."""
        result = get_date_trunc_sql(TimeInterval.HOUR, "event_time")
        assert result == "date_trunc('hour', \"event_time\")"

    def test_minute_interval(self) -> None:
        """Test date_trunc SQL for minute interval."""
        result = get_date_trunc_sql(TimeInterval.MINUTE, "timestamp")
        assert result == "date_trunc('minute', \"timestamp\")"

    def test_week_interval(self) -> None:
        """Test date_trunc SQL for week interval."""
        result = get_date_trunc_sql(TimeInterval.WEEK, "date")
        assert result == "date_trunc('week', \"date\")"

    def test_quarter_interval(self) -> None:
        """Test date_trunc SQL for quarter interval."""
        result = get_date_trunc_sql(TimeInterval.QUARTER, "fiscal_date")
        assert result == "date_trunc('quarter', \"fiscal_date\")"

    def test_column_with_quotes_escaped(self) -> None:
        """Test that column names with quotes are properly escaped."""
        result = get_date_trunc_sql(TimeInterval.DAY, 'weird"column')
        assert result == 'date_trunc(\'day\', "weird""column")'


# ============================================================================
# get_interval_format Tests
# ============================================================================


class TestGetIntervalFormat:
    """Tests for get_interval_format function."""

    def test_minute_format(self) -> None:
        """Test format string for minute interval."""
        assert get_interval_format(TimeInterval.MINUTE) == "%Y-%m-%d %H:%M"

    def test_hour_format(self) -> None:
        """Test format string for hour interval."""
        assert get_interval_format(TimeInterval.HOUR) == "%Y-%m-%d %H:00"

    def test_day_format(self) -> None:
        """Test format string for day interval."""
        assert get_interval_format(TimeInterval.DAY) == "%Y-%m-%d"

    def test_week_format(self) -> None:
        """Test format string for week interval."""
        assert get_interval_format(TimeInterval.WEEK) == "%Y-W%W"

    def test_month_format(self) -> None:
        """Test format string for month interval."""
        assert get_interval_format(TimeInterval.MONTH) == "%Y-%m"

    def test_quarter_format(self) -> None:
        """Test format string for quarter interval (special marker)."""
        assert get_interval_format(TimeInterval.QUARTER) == "%Y-Q%q"

    def test_year_format(self) -> None:
        """Test format string for year interval."""
        assert get_interval_format(TimeInterval.YEAR) == "%Y"


# ============================================================================
# generate_time_buckets Tests
# ============================================================================


class TestGenerateTimeBuckets:
    """Tests for generate_time_buckets function."""

    def test_daily_buckets(self) -> None:
        """Test generating daily buckets."""
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 5)
        buckets = generate_time_buckets(start, end, TimeInterval.DAY)

        assert len(buckets) == 5
        assert buckets[0].start == datetime(2024, 1, 1)
        assert buckets[0].label == "Jan 01"
        assert buckets[4].start == datetime(2024, 1, 5)
        assert buckets[4].label == "Jan 05"

    def test_monthly_buckets(self) -> None:
        """Test generating monthly buckets."""
        start = datetime(2024, 1, 15)
        end = datetime(2024, 4, 20)
        buckets = generate_time_buckets(start, end, TimeInterval.MONTH)

        assert len(buckets) == 4  # Jan, Feb, Mar, Apr
        assert buckets[0].start == datetime(2024, 1, 1)
        assert buckets[0].label == "Jan 2024"
        assert buckets[3].start == datetime(2024, 4, 1)
        assert buckets[3].label == "Apr 2024"

    def test_yearly_buckets(self) -> None:
        """Test generating yearly buckets."""
        start = datetime(2020, 6, 15)
        end = datetime(2024, 3, 10)
        buckets = generate_time_buckets(start, end, TimeInterval.YEAR)

        assert len(buckets) == 5  # 2020, 2021, 2022, 2023, 2024
        assert buckets[0].start == datetime(2020, 1, 1)
        assert buckets[0].label == "2020"
        assert buckets[4].start == datetime(2024, 1, 1)
        assert buckets[4].label == "2024"

    def test_hourly_buckets(self) -> None:
        """Test generating hourly buckets."""
        start = datetime(2024, 1, 1, 10, 30)
        end = datetime(2024, 1, 1, 14, 15)
        buckets = generate_time_buckets(start, end, TimeInterval.HOUR)

        assert len(buckets) == 5  # 10:00, 11:00, 12:00, 13:00, 14:00
        assert buckets[0].start == datetime(2024, 1, 1, 10, 0)
        assert buckets[0].label == "Jan 01, 10:00"
        assert buckets[4].start == datetime(2024, 1, 1, 14, 0)

    def test_minute_buckets(self) -> None:
        """Test generating minute buckets."""
        start = datetime(2024, 1, 1, 10, 0)
        end = datetime(2024, 1, 1, 10, 4)
        buckets = generate_time_buckets(start, end, TimeInterval.MINUTE)

        assert len(buckets) == 5  # 10:00, 10:01, 10:02, 10:03, 10:04
        assert buckets[0].start == datetime(2024, 1, 1, 10, 0)
        assert buckets[4].start == datetime(2024, 1, 1, 10, 4)

    def test_weekly_buckets(self) -> None:
        """Test generating weekly buckets."""
        # Start on a Wednesday
        start = datetime(2024, 1, 3)
        end = datetime(2024, 1, 20)
        buckets = generate_time_buckets(start, end, TimeInterval.WEEK)

        assert len(buckets) == 3  # Week starting Jan 1, Jan 8, Jan 15
        assert buckets[0].start == datetime(2024, 1, 1)  # Monday of week 1
        assert "Week" in buckets[0].label

    def test_quarterly_buckets(self) -> None:
        """Test generating quarterly buckets."""
        start = datetime(2024, 2, 15)
        end = datetime(2024, 10, 1)
        buckets = generate_time_buckets(start, end, TimeInterval.QUARTER)

        assert len(buckets) == 4  # Q1, Q2, Q3, Q4
        assert buckets[0].start == datetime(2024, 1, 1)
        assert buckets[0].label == "Q1 2024"
        assert buckets[1].start == datetime(2024, 4, 1)
        assert buckets[1].label == "Q2 2024"
        assert buckets[2].start == datetime(2024, 7, 1)
        assert buckets[2].label == "Q3 2024"
        assert buckets[3].start == datetime(2024, 10, 1)
        assert buckets[3].label == "Q4 2024"

    def test_single_bucket(self) -> None:
        """Test when start and end are in same bucket."""
        start = datetime(2024, 1, 15)
        end = datetime(2024, 1, 20)
        buckets = generate_time_buckets(start, end, TimeInterval.MONTH)

        assert len(buckets) == 1
        assert buckets[0].start == datetime(2024, 1, 1)

    def test_bucket_end_calculation(self) -> None:
        """Test that bucket end is correctly calculated."""
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 1)
        buckets = generate_time_buckets(start, end, TimeInterval.DAY)

        assert len(buckets) == 1
        # End should be just before midnight of next day
        expected_end = datetime(2024, 1, 2) - timedelta(microseconds=1)
        assert buckets[0].end == expected_end

    def test_timezone_aware_datetimes(self) -> None:
        """Test that timezone-aware datetimes are handled."""
        utc = timezone.utc
        start = datetime(2024, 1, 1, tzinfo=utc)
        end = datetime(2024, 1, 3, tzinfo=utc)
        buckets = generate_time_buckets(start, end, TimeInterval.DAY)

        assert len(buckets) == 3
        # Should be converted to naive
        assert buckets[0].start.tzinfo is None

    def test_cross_month_boundary(self) -> None:
        """Test buckets crossing month boundary."""
        start = datetime(2024, 1, 30)
        end = datetime(2024, 2, 2)
        buckets = generate_time_buckets(start, end, TimeInterval.DAY)

        assert len(buckets) == 4  # Jan 30, 31, Feb 1, 2
        assert buckets[0].start == datetime(2024, 1, 30)
        assert buckets[2].start == datetime(2024, 2, 1)

    def test_cross_year_boundary(self) -> None:
        """Test buckets crossing year boundary."""
        start = datetime(2023, 12, 1)
        end = datetime(2024, 2, 1)
        buckets = generate_time_buckets(start, end, TimeInterval.MONTH)

        assert len(buckets) == 3  # Dec 2023, Jan 2024, Feb 2024
        assert buckets[0].start == datetime(2023, 12, 1)
        assert buckets[1].start == datetime(2024, 1, 1)
        assert buckets[2].start == datetime(2024, 2, 1)


# ============================================================================
# fill_missing_buckets Tests
# ============================================================================


class TestFillMissingBuckets:
    """Tests for fill_missing_buckets function."""

    def test_fill_missing_days(self) -> None:
        """Test filling missing days in data."""
        data = [
            {"date": datetime(2024, 1, 1), "sales": 100},
            {"date": datetime(2024, 1, 3), "sales": 150},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 3), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets)

        assert len(filled) == 3
        # Check that Jan 2 was filled
        jan2_rows = [r for r in filled if r["date"] == datetime(2024, 1, 2)]
        assert len(jan2_rows) == 1
        assert jan2_rows[0]["sales"] == 0  # Default fill value

    def test_fill_with_custom_value(self) -> None:
        """Test filling with custom fill value."""
        data = [
            {"date": datetime(2024, 1, 1), "value": 100},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 2), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets, fill_value=-1)

        assert len(filled) == 2
        jan2_row = next(r for r in filled if r["date"] == datetime(2024, 1, 2))
        assert jan2_row["value"] == -1

    def test_no_data_creates_empty_rows(self) -> None:
        """Test that empty data creates rows for all buckets."""
        data: list[dict[str, datetime | int]] = []
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 3), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets)

        assert len(filled) == 3
        assert all("date" in r for r in filled)

    def test_all_buckets_present(self) -> None:
        """Test that no extra rows are added when all data present."""
        data = [
            {"date": datetime(2024, 1, 1), "sales": 100},
            {"date": datetime(2024, 1, 2), "sales": 200},
            {"date": datetime(2024, 1, 3), "sales": 300},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 3), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets)

        assert len(filled) == 3
        assert filled[0]["sales"] == 100
        assert filled[1]["sales"] == 200
        assert filled[2]["sales"] == 300

    def test_multiple_columns(self) -> None:
        """Test filling preserves multiple columns."""
        data = [
            {"date": datetime(2024, 1, 1), "sales": 100, "region": "East", "count": 10},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 2), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets)

        assert len(filled) == 2
        # Original row preserved
        assert filled[0]["sales"] == 100
        assert filled[0]["region"] == "East"
        assert filled[0]["count"] == 10
        # Filled row
        assert filled[1]["sales"] == 0
        assert filled[1]["region"] is None  # Non-numeric gets None
        assert filled[1]["count"] == 0

    def test_empty_buckets_list(self) -> None:
        """Test handling of empty buckets list."""
        data = [
            {"date": datetime(2024, 1, 1), "sales": 100},
        ]
        filled = fill_missing_buckets(data, "date", [])

        assert filled == data

    def test_monthly_fill(self) -> None:
        """Test filling missing months."""
        data = [
            {"month": datetime(2024, 1, 1), "revenue": 1000},
            {"month": datetime(2024, 4, 1), "revenue": 4000},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 4, 1), TimeInterval.MONTH
        )
        filled = fill_missing_buckets(data, "month", buckets)

        assert len(filled) == 4  # Jan, Feb, Mar, Apr
        # Check Feb and Mar were filled
        feb_row = next(r for r in filled if r["month"] == datetime(2024, 2, 1))
        mar_row = next(r for r in filled if r["month"] == datetime(2024, 3, 1))
        assert feb_row["revenue"] == 0
        assert mar_row["revenue"] == 0

    def test_handles_none_date_values(self) -> None:
        """Test that rows with None date are skipped."""
        data = [
            {"date": datetime(2024, 1, 1), "sales": 100},
            {"date": None, "sales": 999},  # Should be ignored
            {"date": datetime(2024, 1, 2), "sales": 200},
        ]
        buckets = generate_time_buckets(
            datetime(2024, 1, 1), datetime(2024, 1, 2), TimeInterval.DAY
        )
        filled = fill_missing_buckets(data, "date", buckets)

        # Only 2 buckets, None row ignored
        assert len(filled) == 2


# ============================================================================
# TimeBucket Model Tests
# ============================================================================


class TestTimeBucket:
    """Tests for TimeBucket model."""

    def test_create_bucket(self) -> None:
        """Test creating a TimeBucket."""
        bucket = TimeBucket(
            start=datetime(2024, 1, 1),
            end=datetime(2024, 1, 1, 23, 59, 59),
            label="Jan 01",
        )
        assert bucket.start == datetime(2024, 1, 1)
        assert bucket.label == "Jan 01"

    def test_bucket_strict_mode(self) -> None:
        """Test that TimeBucket enforces strict mode."""
        with pytest.raises(ValidationError):
            TimeBucket(
                start="2024-01-01",  # type: ignore[arg-type]
                end=datetime(2024, 1, 2),
                label="Jan 01",
            )


# ============================================================================
# TimeInterval Enum Tests
# ============================================================================


class TestTimeInterval:
    """Tests for TimeInterval enum."""

    def test_all_intervals(self) -> None:
        """Test that all expected intervals exist."""
        intervals = [
            TimeInterval.MINUTE,
            TimeInterval.HOUR,
            TimeInterval.DAY,
            TimeInterval.WEEK,
            TimeInterval.MONTH,
            TimeInterval.QUARTER,
            TimeInterval.YEAR,
        ]
        assert len(intervals) == 7

    def test_interval_values(self) -> None:
        """Test interval string values."""
        assert TimeInterval.DAY.value == "day"
        assert TimeInterval.MONTH.value == "month"
        assert TimeInterval.QUARTER.value == "quarter"
