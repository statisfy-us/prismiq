"""Tests for date/time utilities."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from prismiq.dates import (
    DatePreset,
    date_add,
    date_trunc,
    get_date_range_sql,
    resolve_date_preset,
)


class TestDatePreset:
    """Tests for DatePreset enum."""

    def test_all_presets_have_string_values(self) -> None:
        """Verify all presets are string enums."""
        for preset in DatePreset:
            assert isinstance(preset.value, str)

    def test_preset_count(self) -> None:
        """Verify the expected number of presets."""
        assert len(DatePreset) == 13


class TestResolveDatePreset:
    """Tests for resolve_date_preset function."""

    def test_today(self) -> None:
        """TODAY returns the reference date."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.TODAY, ref)
        assert start == end == ref

    def test_yesterday(self) -> None:
        """YESTERDAY returns the day before reference."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.YESTERDAY, ref)
        assert start == end == date(2024, 6, 14)

    def test_last_7_days(self) -> None:
        """LAST_7_DAYS returns 7-day range including reference."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.LAST_7_DAYS, ref)
        assert start == date(2024, 6, 9)
        assert end == ref
        assert (end - start).days == 6  # 7 days total

    def test_last_30_days(self) -> None:
        """LAST_30_DAYS returns 30-day range including reference."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.LAST_30_DAYS, ref)
        assert start == date(2024, 5, 17)
        assert end == ref
        assert (end - start).days == 29  # 30 days total

    def test_this_week_monday(self) -> None:
        """THIS_WEEK on Monday returns single day."""
        ref = date(2024, 6, 17)  # Monday
        start, end = resolve_date_preset(DatePreset.THIS_WEEK, ref)
        assert start == date(2024, 6, 17)
        assert end == ref

    def test_this_week_friday(self) -> None:
        """THIS_WEEK on Friday returns Mon-Fri range."""
        ref = date(2024, 6, 21)  # Friday
        start, end = resolve_date_preset(DatePreset.THIS_WEEK, ref)
        assert start == date(2024, 6, 17)  # Monday
        assert end == ref

    def test_last_week(self) -> None:
        """LAST_WEEK returns previous full week (Mon-Sun)."""
        ref = date(2024, 6, 20)  # Thursday
        start, end = resolve_date_preset(DatePreset.LAST_WEEK, ref)
        assert start == date(2024, 6, 10)  # Previous Monday
        assert end == date(2024, 6, 16)  # Previous Sunday
        assert (end - start).days == 6  # Full week

    def test_this_month_first_day(self) -> None:
        """THIS_MONTH on first day returns single day."""
        ref = date(2024, 6, 1)
        start, end = resolve_date_preset(DatePreset.THIS_MONTH, ref)
        assert start == date(2024, 6, 1)
        assert end == ref

    def test_this_month_mid_month(self) -> None:
        """THIS_MONTH mid-month returns month start to reference."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.THIS_MONTH, ref)
        assert start == date(2024, 6, 1)
        assert end == ref

    def test_last_month(self) -> None:
        """LAST_MONTH returns complete previous month."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.LAST_MONTH, ref)
        assert start == date(2024, 5, 1)
        assert end == date(2024, 5, 31)

    def test_last_month_january(self) -> None:
        """LAST_MONTH in January returns December of previous year."""
        ref = date(2024, 1, 15)
        start, end = resolve_date_preset(DatePreset.LAST_MONTH, ref)
        assert start == date(2023, 12, 1)
        assert end == date(2023, 12, 31)

    def test_last_month_february_leap_year(self) -> None:
        """LAST_MONTH handles February in leap year."""
        ref = date(2024, 3, 15)  # 2024 is a leap year
        start, end = resolve_date_preset(DatePreset.LAST_MONTH, ref)
        assert start == date(2024, 2, 1)
        assert end == date(2024, 2, 29)

    def test_this_quarter_q1(self) -> None:
        """THIS_QUARTER in Q1 starts from Jan 1."""
        ref = date(2024, 2, 15)
        start, end = resolve_date_preset(DatePreset.THIS_QUARTER, ref)
        assert start == date(2024, 1, 1)
        assert end == ref

    def test_this_quarter_q2(self) -> None:
        """THIS_QUARTER in Q2 starts from Apr 1."""
        ref = date(2024, 5, 15)
        start, end = resolve_date_preset(DatePreset.THIS_QUARTER, ref)
        assert start == date(2024, 4, 1)
        assert end == ref

    def test_this_quarter_q3(self) -> None:
        """THIS_QUARTER in Q3 starts from Jul 1."""
        ref = date(2024, 8, 15)
        start, end = resolve_date_preset(DatePreset.THIS_QUARTER, ref)
        assert start == date(2024, 7, 1)
        assert end == ref

    def test_this_quarter_q4(self) -> None:
        """THIS_QUARTER in Q4 starts from Oct 1."""
        ref = date(2024, 11, 15)
        start, end = resolve_date_preset(DatePreset.THIS_QUARTER, ref)
        assert start == date(2024, 10, 1)
        assert end == ref

    def test_last_quarter_from_q2(self) -> None:
        """LAST_QUARTER in Q2 returns complete Q1."""
        ref = date(2024, 5, 15)
        start, end = resolve_date_preset(DatePreset.LAST_QUARTER, ref)
        assert start == date(2024, 1, 1)
        assert end == date(2024, 3, 31)

    def test_last_quarter_from_q1(self) -> None:
        """LAST_QUARTER in Q1 returns Q4 of previous year."""
        ref = date(2024, 2, 15)
        start, end = resolve_date_preset(DatePreset.LAST_QUARTER, ref)
        assert start == date(2023, 10, 1)
        assert end == date(2023, 12, 31)

    def test_last_quarter_from_q3(self) -> None:
        """LAST_QUARTER in Q3 returns complete Q2."""
        ref = date(2024, 8, 15)
        start, end = resolve_date_preset(DatePreset.LAST_QUARTER, ref)
        assert start == date(2024, 4, 1)
        assert end == date(2024, 6, 30)

    def test_last_quarter_from_q4(self) -> None:
        """LAST_QUARTER in Q4 returns complete Q3."""
        ref = date(2024, 11, 15)
        start, end = resolve_date_preset(DatePreset.LAST_QUARTER, ref)
        assert start == date(2024, 7, 1)
        assert end == date(2024, 9, 30)

    def test_this_year(self) -> None:
        """THIS_YEAR starts from Jan 1 of current year."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.THIS_YEAR, ref)
        assert start == date(2024, 1, 1)
        assert end == ref

    def test_last_year(self) -> None:
        """LAST_YEAR returns complete previous year."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.LAST_YEAR, ref)
        assert start == date(2023, 1, 1)
        assert end == date(2023, 12, 31)

    def test_all_time(self) -> None:
        """ALL_TIME starts from 1970-01-01."""
        ref = date(2024, 6, 15)
        start, end = resolve_date_preset(DatePreset.ALL_TIME, ref)
        assert start == date(1970, 1, 1)
        assert end == ref

    def test_default_reference_is_today(self) -> None:
        """Without reference, uses today's date."""
        start, end = resolve_date_preset(DatePreset.TODAY)
        assert start == end == date.today()


class TestDateTrunc:
    """Tests for date_trunc function."""

    def test_trunc_day(self) -> None:
        """Truncate to day removes time component."""
        dt = datetime(2024, 6, 15, 10, 30, 45, 123456)
        result = date_trunc("day", dt)
        assert result == datetime(2024, 6, 15, 0, 0, 0, 0)

    def test_trunc_week_wednesday(self) -> None:
        """Truncate to week returns previous Monday."""
        dt = datetime(2024, 6, 19, 10, 30, 45)  # Wednesday
        result = date_trunc("week", dt)
        assert result == datetime(2024, 6, 17, 0, 0, 0)  # Monday

    def test_trunc_week_monday(self) -> None:
        """Truncate to week on Monday returns same day at midnight."""
        dt = datetime(2024, 6, 17, 10, 30, 45)  # Monday
        result = date_trunc("week", dt)
        assert result == datetime(2024, 6, 17, 0, 0, 0)

    def test_trunc_week_sunday(self) -> None:
        """Truncate to week on Sunday returns previous Monday."""
        dt = datetime(2024, 6, 23, 10, 30, 45)  # Sunday
        result = date_trunc("week", dt)
        assert result == datetime(2024, 6, 17, 0, 0, 0)  # Monday

    def test_trunc_month(self) -> None:
        """Truncate to month returns first of month."""
        dt = datetime(2024, 6, 15, 10, 30, 45)
        result = date_trunc("month", dt)
        assert result == datetime(2024, 6, 1, 0, 0, 0)

    def test_trunc_quarter_q1(self) -> None:
        """Truncate to quarter in Q1 returns Jan 1."""
        dt = datetime(2024, 2, 15, 10, 30, 45)
        result = date_trunc("quarter", dt)
        assert result == datetime(2024, 1, 1, 0, 0, 0)

    def test_trunc_quarter_q2(self) -> None:
        """Truncate to quarter in Q2 returns Apr 1."""
        dt = datetime(2024, 5, 15, 10, 30, 45)
        result = date_trunc("quarter", dt)
        assert result == datetime(2024, 4, 1, 0, 0, 0)

    def test_trunc_quarter_q3(self) -> None:
        """Truncate to quarter in Q3 returns Jul 1."""
        dt = datetime(2024, 8, 15, 10, 30, 45)
        result = date_trunc("quarter", dt)
        assert result == datetime(2024, 7, 1, 0, 0, 0)

    def test_trunc_quarter_q4(self) -> None:
        """Truncate to quarter in Q4 returns Oct 1."""
        dt = datetime(2024, 11, 15, 10, 30, 45)
        result = date_trunc("quarter", dt)
        assert result == datetime(2024, 10, 1, 0, 0, 0)

    def test_trunc_year(self) -> None:
        """Truncate to year returns Jan 1."""
        dt = datetime(2024, 6, 15, 10, 30, 45)
        result = date_trunc("year", dt)
        assert result == datetime(2024, 1, 1, 0, 0, 0)

    def test_trunc_case_insensitive(self) -> None:
        """Truncation unit is case insensitive."""
        dt = datetime(2024, 6, 15, 10, 30, 45)
        assert date_trunc("DAY", dt) == date_trunc("day", dt)
        assert date_trunc("Month", dt) == date_trunc("month", dt)
        assert date_trunc("YEAR", dt) == date_trunc("year", dt)

    def test_trunc_invalid_unit(self) -> None:
        """Invalid unit raises ValueError."""
        dt = datetime(2024, 6, 15, 10, 30, 45)
        with pytest.raises(ValueError, match="Invalid truncation unit"):
            date_trunc("hour", dt)


class TestDateAdd:
    """Tests for date_add function."""

    def test_add_days(self) -> None:
        """Add positive days."""
        result = date_add(date(2024, 6, 15), days=5)
        assert result == date(2024, 6, 20)

    def test_subtract_days(self) -> None:
        """Subtract days with negative value."""
        result = date_add(date(2024, 6, 15), days=-5)
        assert result == date(2024, 6, 10)

    def test_add_months(self) -> None:
        """Add positive months."""
        result = date_add(date(2024, 6, 15), months=2)
        assert result == date(2024, 8, 15)

    def test_subtract_months(self) -> None:
        """Subtract months with negative value."""
        result = date_add(date(2024, 6, 15), months=-2)
        assert result == date(2024, 4, 15)

    def test_add_months_year_rollover(self) -> None:
        """Adding months past December rolls to next year."""
        result = date_add(date(2024, 11, 15), months=3)
        assert result == date(2025, 2, 15)

    def test_subtract_months_year_rollover(self) -> None:
        """Subtracting months past January rolls to previous year."""
        result = date_add(date(2024, 2, 15), months=-3)
        assert result == date(2023, 11, 15)

    def test_add_months_clamps_day(self) -> None:
        """Adding months clamps day to valid range."""
        result = date_add(date(2024, 1, 31), months=1)
        assert result == date(2024, 2, 29)  # 2024 is leap year

    def test_add_months_clamps_day_non_leap_year(self) -> None:
        """Adding months clamps day in non-leap year."""
        result = date_add(date(2023, 1, 31), months=1)
        assert result == date(2023, 2, 28)

    def test_add_years(self) -> None:
        """Add positive years."""
        result = date_add(date(2024, 6, 15), years=2)
        assert result == date(2026, 6, 15)

    def test_subtract_years(self) -> None:
        """Subtract years with negative value."""
        result = date_add(date(2024, 6, 15), years=-2)
        assert result == date(2022, 6, 15)

    def test_add_years_leap_year_edge_case(self) -> None:
        """Feb 29 + 1 year clamps to Feb 28."""
        result = date_add(date(2024, 2, 29), years=1)
        assert result == date(2025, 2, 28)

    def test_combined_add(self) -> None:
        """Add years, months, and days together."""
        result = date_add(date(2024, 1, 15), years=1, months=2, days=3)
        assert result == date(2025, 3, 18)

    def test_combined_subtract(self) -> None:
        """Subtract years, months, and days together."""
        result = date_add(date(2024, 6, 15), years=-1, months=-2, days=-5)
        assert result == date(2023, 4, 10)

    def test_no_change(self) -> None:
        """No arguments returns same date."""
        result = date_add(date(2024, 6, 15))
        assert result == date(2024, 6, 15)


class TestGetDateRangeSql:
    """Tests for get_date_range_sql function."""

    def test_simple_column(self) -> None:
        """Generate SQL for simple column name."""
        sql, params = get_date_range_sql(DatePreset.LAST_7_DAYS, "order_date")
        assert sql == '"order_date" >= $1 AND "order_date" <= $2'
        assert len(params) == 2
        assert isinstance(params[0], date)
        assert isinstance(params[1], date)

    def test_all_time_single_param(self) -> None:
        """ALL_TIME generates SQL with only upper bound."""
        sql, params = get_date_range_sql(DatePreset.ALL_TIME, "created_at")
        assert sql == '"created_at" <= $1'
        assert len(params) == 1

    def test_column_with_quotes(self) -> None:
        """Column names with quotes are escaped."""
        sql, _params = get_date_range_sql(DatePreset.TODAY, 'my"column')
        assert sql == '"my""column" >= $1 AND "my""column" <= $2'

    def test_today_same_dates(self) -> None:
        """TODAY produces same start and end date."""
        _sql, params = get_date_range_sql(DatePreset.TODAY, "date_col")
        assert params[0] == params[1]

    def test_various_presets_return_dates(self) -> None:
        """All presets return date objects."""
        for preset in DatePreset:
            _sql, params = get_date_range_sql(preset, "test_col")
            for param in params:
                assert isinstance(param, date)
