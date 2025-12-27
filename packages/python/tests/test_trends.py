"""Tests for trend calculation utilities."""

from __future__ import annotations

from datetime import date, datetime

import pytest

from prismiq.trends import (
    ComparisonPeriod,
    TrendDirection,
    TrendResult,
    add_trend_column,
    calculate_moving_average,
    calculate_period_comparison,
    calculate_trend,
    calculate_year_over_year,
)
from prismiq.types import QueryResult


def make_result(
    columns: list[str],
    rows: list[list],
    column_types: list[str] | None = None,
) -> QueryResult:
    """Helper to create QueryResult for tests."""
    if column_types is None:
        column_types = ["text"] * len(columns)
    return QueryResult(
        columns=columns,
        column_types=column_types,
        rows=rows,
        row_count=len(rows),
        truncated=False,
        execution_time_ms=0,
    )


# ============================================================================
# calculate_trend Tests
# ============================================================================


class TestCalculateTrend:
    """Tests for calculate_trend function."""

    def test_positive_trend(self) -> None:
        """Test upward trend calculation."""
        result = calculate_trend(150, 100)

        assert result.current_value == 150
        assert result.previous_value == 100
        assert result.absolute_change == 50
        assert result.percent_change == 50.0
        assert result.direction == TrendDirection.UP

    def test_negative_trend(self) -> None:
        """Test downward trend calculation."""
        result = calculate_trend(80, 100)

        assert result.current_value == 80
        assert result.previous_value == 100
        assert result.absolute_change == -20
        assert result.percent_change == -20.0
        assert result.direction == TrendDirection.DOWN

    def test_flat_trend(self) -> None:
        """Test flat trend (within threshold)."""
        result = calculate_trend(100.0001, 100, threshold=0.01)

        assert result.direction == TrendDirection.FLAT

    def test_no_previous_value(self) -> None:
        """Test when previous value is None."""
        result = calculate_trend(100, None)

        assert result.current_value == 100
        assert result.previous_value is None
        assert result.absolute_change is None
        assert result.percent_change is None
        assert result.direction == TrendDirection.FLAT

    def test_zero_previous_value(self) -> None:
        """Test when previous value is zero."""
        result = calculate_trend(100, 0)

        assert result.current_value == 100
        assert result.previous_value == 0
        assert result.absolute_change == 100
        assert result.percent_change == 100.0  # Treat as 100% increase

    def test_zero_current_value(self) -> None:
        """Test when current value is zero."""
        result = calculate_trend(0, 100)

        assert result.current_value == 0
        assert result.percent_change == -100.0
        assert result.direction == TrendDirection.DOWN

    def test_both_zero(self) -> None:
        """Test when both values are zero."""
        result = calculate_trend(0, 0)

        assert result.current_value == 0
        assert result.previous_value == 0
        assert result.percent_change == 0.0
        assert result.direction == TrendDirection.FLAT

    def test_none_current_treated_as_zero(self) -> None:
        """Test that None current is treated as zero."""
        result = calculate_trend(None, 100)

        assert result.current_value == 0
        assert result.direction == TrendDirection.DOWN


# ============================================================================
# TrendResult Model Tests
# ============================================================================


class TestTrendResult:
    """Tests for TrendResult model."""

    def test_create_trend_result(self) -> None:
        """Test creating a TrendResult."""
        result = TrendResult(
            current_value=150.0,
            previous_value=100.0,
            absolute_change=50.0,
            percent_change=50.0,
            direction=TrendDirection.UP,
        )
        assert result.current_value == 150.0
        assert result.direction == TrendDirection.UP

    def test_trend_result_with_nulls(self) -> None:
        """Test TrendResult with None values."""
        result = TrendResult(
            current_value=100.0,
            previous_value=None,
            absolute_change=None,
            percent_change=None,
            direction=TrendDirection.FLAT,
        )
        assert result.previous_value is None


# ============================================================================
# calculate_period_comparison Tests
# ============================================================================


class TestCalculatePeriodComparison:
    """Tests for calculate_period_comparison function."""

    def test_previous_period_comparison(self) -> None:
        """Test comparison with previous period."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                [date(2024, 1, 1), 100],
                [date(2024, 1, 2), 150],
                [date(2023, 12, 30), 80],  # Previous period
                [date(2023, 12, 31), 70],  # Previous period
            ],
        )

        trend = calculate_period_comparison(
            result,
            "date",
            "sales",
            ComparisonPeriod.PREVIOUS_PERIOD,
            date(2024, 1, 1),
            date(2024, 1, 2),
        )

        assert trend.current_value == 250  # 100 + 150
        assert trend.previous_value == 150  # 80 + 70
        assert trend.direction == TrendDirection.UP

    def test_previous_year_comparison(self) -> None:
        """Test year-over-year comparison."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                [date(2024, 1, 15), 200],
                [date(2023, 1, 15), 150],  # Same day last year
            ],
        )

        trend = calculate_period_comparison(
            result,
            "date",
            "sales",
            ComparisonPeriod.PREVIOUS_YEAR,
            date(2024, 1, 15),
            date(2024, 1, 15),
        )

        assert trend.current_value == 200
        assert trend.previous_value == 150

    def test_empty_result(self) -> None:
        """Test with empty result."""
        result = make_result(columns=["date", "sales"], rows=[])

        trend = calculate_period_comparison(
            result,
            "date",
            "sales",
            ComparisonPeriod.PREVIOUS_PERIOD,
            date(2024, 1, 1),
            date(2024, 1, 2),
        )

        assert trend.current_value == 0
        assert trend.direction == TrendDirection.FLAT

    def test_with_datetime_column(self) -> None:
        """Test with datetime column."""
        result = make_result(
            columns=["timestamp", "value"],
            rows=[
                [datetime(2024, 1, 1, 10, 0), 100],
                [datetime(2023, 12, 31, 10, 0), 80],
            ],
        )

        trend = calculate_period_comparison(
            result,
            "timestamp",
            "value",
            ComparisonPeriod.PREVIOUS_PERIOD,
            date(2024, 1, 1),
            date(2024, 1, 1),
        )

        assert trend.current_value == 100


# ============================================================================
# add_trend_column Tests
# ============================================================================


class TestAddTrendColumn:
    """Tests for add_trend_column function."""

    def test_basic_trend_columns(self) -> None:
        """Test adding trend columns."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                ["2024-01-01", 100],
                ["2024-01-02", 150],
                ["2024-01-03", 120],
            ],
        )

        with_trend = add_trend_column(result, "sales", "date")

        assert "sales_prev" in with_trend.columns
        assert "sales_change" in with_trend.columns
        assert "sales_pct_change" in with_trend.columns

        # First row has no previous
        assert with_trend.rows[0][-3] is None
        assert with_trend.rows[0][-2] is None
        assert with_trend.rows[0][-1] is None

        # Second row: 150 - 100 = 50 (50%)
        assert with_trend.rows[1][-3] == 100
        assert with_trend.rows[1][-2] == 50
        assert with_trend.rows[1][-1] == 50.0

        # Third row: 120 - 150 = -30 (-20%)
        assert with_trend.rows[2][-3] == 150
        assert with_trend.rows[2][-2] == -30
        assert with_trend.rows[2][-1] == -20.0

    def test_trend_with_groups(self) -> None:
        """Test trend calculation within groups."""
        result = make_result(
            columns=["region", "date", "sales"],
            rows=[
                ["East", "2024-01-01", 100],
                ["East", "2024-01-02", 150],
                ["West", "2024-01-01", 200],
                ["West", "2024-01-02", 180],
            ],
        )

        with_trend = add_trend_column(result, "sales", "date", group_column="region")

        # East: 150 - 100 = 50
        east_rows = [r for r in with_trend.rows if r[0] == "East"]
        assert east_rows[1][-2] == 50

        # West: 180 - 200 = -20
        west_rows = [r for r in with_trend.rows if r[0] == "West"]
        assert west_rows[1][-2] == -20

    def test_empty_result(self) -> None:
        """Test with empty result."""
        result = make_result(columns=["date", "sales"], rows=[])

        with_trend = add_trend_column(result, "sales", "date")

        assert len(with_trend.columns) == 5  # date, sales, prev, change, pct
        assert with_trend.rows == []

    def test_invalid_column(self) -> None:
        """Test with invalid column name."""
        result = make_result(columns=["date", "sales"], rows=[["2024-01-01", 100]])

        with pytest.raises(ValueError, match="Column not found"):
            add_trend_column(result, "invalid", "date")


# ============================================================================
# calculate_moving_average Tests
# ============================================================================


class TestCalculateMovingAverage:
    """Tests for calculate_moving_average function."""

    def test_basic_moving_average(self) -> None:
        """Test basic moving average calculation."""
        result = make_result(
            columns=["date", "value"],
            rows=[
                ["2024-01-01", 10],
                ["2024-01-02", 20],
                ["2024-01-03", 30],
                ["2024-01-04", 40],
                ["2024-01-05", 50],
            ],
        )

        with_ma = calculate_moving_average(result, "value", window=3)

        assert with_ma.columns[-1] == "value_ma3"

        # First value: just 10
        assert with_ma.rows[0][-1] == 10.0

        # Second value: (10 + 20) / 2 = 15
        assert with_ma.rows[1][-1] == 15.0

        # Third value: (10 + 20 + 30) / 3 = 20
        assert with_ma.rows[2][-1] == 20.0

        # Fourth value: (20 + 30 + 40) / 3 = 30
        assert with_ma.rows[3][-1] == 30.0

        # Fifth value: (30 + 40 + 50) / 3 = 40
        assert with_ma.rows[4][-1] == 40.0

    def test_moving_average_with_order(self) -> None:
        """Test moving average with explicit order column."""
        result = make_result(
            columns=["date", "value"],
            rows=[
                ["2024-01-03", 30],  # Out of order
                ["2024-01-01", 10],
                ["2024-01-02", 20],
            ],
        )

        with_ma = calculate_moving_average(result, "value", window=2, order_column="date")

        # Should be calculated in order: 10, 20, 30
        # Values should appear in original row order but calculated correctly
        # Verify the column was added
        assert "value_ma2" in with_ma.columns
        assert len(with_ma.rows) == 3

    def test_moving_average_window_7(self) -> None:
        """Test 7-day moving average (default)."""
        result = make_result(
            columns=["value"],
            rows=[[10], [20], [30], [40], [50], [60], [70], [80]],
        )

        with_ma = calculate_moving_average(result, "value")

        assert with_ma.columns[-1] == "value_ma7"

        # 7th value: (10+20+30+40+50+60+70)/7 = 40
        assert with_ma.rows[6][-1] == 40.0

        # 8th value: (20+30+40+50+60+70+80)/7 = 50
        assert with_ma.rows[7][-1] == 50.0

    def test_moving_average_empty_result(self) -> None:
        """Test with empty result."""
        result = make_result(columns=["value"], rows=[])

        with_ma = calculate_moving_average(result, "value", window=3)

        assert with_ma.columns == ["value", "value_ma3"]
        assert with_ma.rows == []

    def test_moving_average_invalid_column(self) -> None:
        """Test with invalid column."""
        result = make_result(columns=["value"], rows=[[10]])

        with pytest.raises(ValueError, match="Column 'invalid' not found"):
            calculate_moving_average(result, "invalid")


# ============================================================================
# calculate_year_over_year Tests
# ============================================================================


class TestCalculateYearOverYear:
    """Tests for calculate_year_over_year function."""

    def test_basic_yoy(self) -> None:
        """Test basic year-over-year calculation."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                [date(2024, 1, 15), 150],
                [date(2023, 1, 15), 100],  # Same day last year
                [date(2024, 6, 1), 200],
                [date(2023, 6, 1), 180],  # Same day last year
            ],
        )

        with_yoy = calculate_year_over_year(result, "date", "sales")

        assert "sales_prev_year" in with_yoy.columns
        assert "sales_yoy_change" in with_yoy.columns
        assert "sales_yoy_pct" in with_yoy.columns

        # Row for 2024-01-15: prev_year = 100, change = 50, pct = 50%
        jan_row = next(r for r in with_yoy.rows if r[0] == date(2024, 1, 15))
        assert jan_row[-3] == 100  # prev_year
        assert jan_row[-2] == 50  # yoy_change
        assert jan_row[-1] == 50.0  # yoy_pct

    def test_yoy_no_previous_year_data(self) -> None:
        """Test when no previous year data exists."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                [date(2024, 1, 15), 150],
                # No 2023-01-15 data
            ],
        )

        with_yoy = calculate_year_over_year(result, "date", "sales")

        assert with_yoy.rows[0][-3] is None  # No prev year
        assert with_yoy.rows[0][-2] is None
        assert with_yoy.rows[0][-1] is None

    def test_yoy_with_datetime(self) -> None:
        """Test YoY with datetime column."""
        result = make_result(
            columns=["timestamp", "value"],
            rows=[
                [datetime(2024, 3, 1, 10, 0), 200],
                [datetime(2023, 3, 1, 14, 0), 150],  # Different time, same day
            ],
        )

        with_yoy = calculate_year_over_year(result, "timestamp", "value")

        # Should match by month and day only
        row_2024 = next(r for r in with_yoy.rows if r[0] == datetime(2024, 3, 1, 10, 0))
        assert row_2024[-3] == 150  # Found prev year

    def test_yoy_empty_result(self) -> None:
        """Test with empty result."""
        result = make_result(columns=["date", "sales"], rows=[])

        with_yoy = calculate_year_over_year(result, "date", "sales")

        assert len(with_yoy.columns) == 5
        assert with_yoy.rows == []


# ============================================================================
# ComparisonPeriod Enum Tests
# ============================================================================


class TestComparisonPeriod:
    """Tests for ComparisonPeriod enum."""

    def test_all_periods(self) -> None:
        """Test that all comparison periods exist."""
        periods = [
            ComparisonPeriod.PREVIOUS_PERIOD,
            ComparisonPeriod.PREVIOUS_YEAR,
            ComparisonPeriod.PREVIOUS_MONTH,
            ComparisonPeriod.PREVIOUS_WEEK,
        ]
        assert len(periods) == 4

    def test_period_values(self) -> None:
        """Test period string values."""
        assert ComparisonPeriod.PREVIOUS_PERIOD.value == "previous_period"
        assert ComparisonPeriod.PREVIOUS_YEAR.value == "previous_year"
