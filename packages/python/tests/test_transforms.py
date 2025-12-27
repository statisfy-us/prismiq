"""Tests for data transformation utilities."""

from __future__ import annotations

import pytest

from prismiq.transforms import (
    calculate_percent_of_total,
    calculate_running_total,
    fill_nulls,
    limit_result,
    pivot_data,
    sort_result,
    transpose_data,
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
# pivot_data Tests
# ============================================================================


class TestPivotData:
    """Tests for pivot_data function."""

    def test_basic_pivot(self) -> None:
        """Test basic pivot operation."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Feb", 150],
                ["West", "Jan", 200],
                ["West", "Feb", 250],
            ],
            column_types=["text", "text", "numeric"],
        )

        pivoted = pivot_data(result, "region", "month", "sales")

        assert pivoted.columns == ["region", "Jan", "Feb"]
        assert len(pivoted.rows) == 2

        # Find East and West rows
        east_row = next(r for r in pivoted.rows if r[0] == "East")
        west_row = next(r for r in pivoted.rows if r[0] == "West")

        assert east_row == ["East", 100.0, 150.0]
        assert west_row == ["West", 200.0, 250.0]

    def test_pivot_with_missing_values(self) -> None:
        """Test pivot with missing combinations."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Feb", 150],
                ["West", "Jan", 200],
                # West-Feb is missing
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales")

        west_row = next(r for r in pivoted.rows if r[0] == "West")
        # Feb should be None for West
        assert west_row[2] is None

    def test_pivot_with_aggregation_sum(self) -> None:
        """Test pivot with sum aggregation (default)."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Jan", 50],  # Duplicate
                ["East", "Feb", 150],
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales", aggregation="sum")

        east_row = next(r for r in pivoted.rows if r[0] == "East")
        assert east_row[1] == 150.0  # 100 + 50

    def test_pivot_with_aggregation_avg(self) -> None:
        """Test pivot with average aggregation."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Jan", 200],
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales", aggregation="avg")

        east_row = pivoted.rows[0]
        assert east_row[1] == 150.0  # (100 + 200) / 2

    def test_pivot_with_aggregation_min(self) -> None:
        """Test pivot with min aggregation."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Jan", 200],
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales", aggregation="min")

        east_row = pivoted.rows[0]
        assert east_row[1] == 100.0

    def test_pivot_with_aggregation_max(self) -> None:
        """Test pivot with max aggregation."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Jan", 200],
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales", aggregation="max")

        east_row = pivoted.rows[0]
        assert east_row[1] == 200.0

    def test_pivot_with_aggregation_count(self) -> None:
        """Test pivot with count aggregation."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[
                ["East", "Jan", 100],
                ["East", "Jan", 200],
                ["East", "Jan", 300],
            ],
        )

        pivoted = pivot_data(result, "region", "month", "sales", aggregation="count")

        east_row = pivoted.rows[0]
        assert east_row[1] == 3.0

    def test_pivot_empty_result(self) -> None:
        """Test pivot with empty result."""
        result = make_result(columns=["region", "month", "sales"], rows=[])

        pivoted = pivot_data(result, "region", "month", "sales")

        assert pivoted.columns == ["region"]
        assert pivoted.rows == []

    def test_pivot_invalid_column(self) -> None:
        """Test pivot with invalid column name."""
        result = make_result(
            columns=["region", "month", "sales"],
            rows=[["East", "Jan", 100]],
        )

        with pytest.raises(ValueError, match="Column not found"):
            pivot_data(result, "invalid", "month", "sales")


# ============================================================================
# transpose_data Tests
# ============================================================================


class TestTransposeData:
    """Tests for transpose_data function."""

    def test_basic_transpose(self) -> None:
        """Test basic transpose operation."""
        result = make_result(
            columns=["name", "age", "score"],
            rows=[
                ["Alice", 25, 95],
                ["Bob", 30, 88],
            ],
        )

        transposed = transpose_data(result)

        assert transposed.columns == ["Column", "Row 1", "Row 2"]
        assert len(transposed.rows) == 3
        assert transposed.rows[0] == ["name", "Alice", "Bob"]
        assert transposed.rows[1] == ["age", 25, 30]
        assert transposed.rows[2] == ["score", 95, 88]

    def test_transpose_empty_result(self) -> None:
        """Test transpose with empty rows."""
        result = make_result(columns=["a", "b", "c"], rows=[])

        transposed = transpose_data(result)

        assert transposed.columns == ["Column"]
        assert transposed.rows == [["a"], ["b"], ["c"]]

    def test_transpose_single_row(self) -> None:
        """Test transpose with single row."""
        result = make_result(
            columns=["x", "y"],
            rows=[[1, 2]],
        )

        transposed = transpose_data(result)

        assert transposed.columns == ["Column", "Row 1"]
        assert transposed.rows == [["x", 1], ["y", 2]]


# ============================================================================
# fill_nulls Tests
# ============================================================================


class TestFillNulls:
    """Tests for fill_nulls function."""

    def test_fill_with_static_value(self) -> None:
        """Test filling nulls with static value."""
        result = make_result(
            columns=["a", "b"],
            rows=[
                [1, None],
                [2, 20],
                [None, None],
            ],
        )

        filled = fill_nulls(result, value=0)

        assert filled.rows[0] == [1, 0]
        assert filled.rows[1] == [2, 20]
        assert filled.rows[2] == [0, 0]

    def test_fill_specific_column(self) -> None:
        """Test filling nulls in specific column."""
        result = make_result(
            columns=["a", "b"],
            rows=[
                [None, None],
                [2, 20],
            ],
        )

        filled = fill_nulls(result, column="a", value=99)

        assert filled.rows[0] == [99, None]  # Only 'a' filled
        assert filled.rows[1] == [2, 20]

    def test_forward_fill(self) -> None:
        """Test forward fill method."""
        result = make_result(
            columns=["value"],
            rows=[
                [10],
                [None],
                [None],
                [20],
                [None],
            ],
        )

        filled = fill_nulls(result, method="ffill")

        assert filled.rows[0] == [10]
        assert filled.rows[1] == [10]  # Forward filled
        assert filled.rows[2] == [10]  # Forward filled
        assert filled.rows[3] == [20]
        assert filled.rows[4] == [20]  # Forward filled

    def test_backward_fill(self) -> None:
        """Test backward fill method."""
        result = make_result(
            columns=["value"],
            rows=[
                [None],
                [None],
                [10],
                [None],
                [20],
            ],
        )

        filled = fill_nulls(result, method="bfill")

        assert filled.rows[0] == [10]  # Backward filled
        assert filled.rows[1] == [10]  # Backward filled
        assert filled.rows[2] == [10]
        assert filled.rows[3] == [20]  # Backward filled
        assert filled.rows[4] == [20]

    def test_fill_nulls_empty_result(self) -> None:
        """Test fill_nulls with empty result."""
        result = make_result(columns=["a"], rows=[])

        filled = fill_nulls(result)

        assert filled.rows == []

    def test_fill_nulls_invalid_column(self) -> None:
        """Test fill_nulls with invalid column."""
        result = make_result(columns=["a"], rows=[[1]])

        with pytest.raises(ValueError, match="Column 'b' not found"):
            fill_nulls(result, column="b")


# ============================================================================
# calculate_running_total Tests
# ============================================================================


class TestCalculateRunningTotal:
    """Tests for calculate_running_total function."""

    def test_basic_running_total(self) -> None:
        """Test basic running total calculation."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                ["2024-01-01", 100],
                ["2024-01-02", 150],
                ["2024-01-03", 200],
            ],
        )

        with_totals = calculate_running_total(result, "sales")

        assert with_totals.columns[-1] == "sales_running_total"
        assert with_totals.rows[0][-1] == 100
        assert with_totals.rows[1][-1] == 250  # 100 + 150
        assert with_totals.rows[2][-1] == 450  # 100 + 150 + 200

    def test_running_total_with_groups(self) -> None:
        """Test running total within groups."""
        result = make_result(
            columns=["region", "date", "sales"],
            rows=[
                ["East", "2024-01-01", 100],
                ["East", "2024-01-02", 150],
                ["West", "2024-01-01", 200],
                ["West", "2024-01-02", 250],
            ],
        )

        with_totals = calculate_running_total(result, "sales", group_column="region")

        # East running totals
        east_rows = [r for r in with_totals.rows if r[0] == "East"]
        assert east_rows[0][-1] == 100
        assert east_rows[1][-1] == 250  # 100 + 150

        # West running totals
        west_rows = [r for r in with_totals.rows if r[0] == "West"]
        assert west_rows[0][-1] == 200
        assert west_rows[1][-1] == 450  # 200 + 250

    def test_running_total_with_null_values(self) -> None:
        """Test running total with null values."""
        result = make_result(
            columns=["date", "sales"],
            rows=[
                ["2024-01-01", 100],
                ["2024-01-02", None],
                ["2024-01-03", 200],
            ],
        )

        with_totals = calculate_running_total(result, "sales")

        assert with_totals.rows[0][-1] == 100
        assert with_totals.rows[1][-1] == 100  # Null skipped
        assert with_totals.rows[2][-1] == 300

    def test_running_total_empty_result(self) -> None:
        """Test running total with empty result."""
        result = make_result(columns=["sales"], rows=[])

        with_totals = calculate_running_total(result, "sales")

        assert with_totals.columns == ["sales", "sales_running_total"]
        assert with_totals.rows == []

    def test_running_total_invalid_column(self) -> None:
        """Test running total with invalid column."""
        result = make_result(columns=["a"], rows=[[1]])

        with pytest.raises(ValueError, match="Column 'b' not found"):
            calculate_running_total(result, "b")


# ============================================================================
# calculate_percent_of_total Tests
# ============================================================================


class TestCalculatePercentOfTotal:
    """Tests for calculate_percent_of_total function."""

    def test_basic_percent_of_total(self) -> None:
        """Test basic percentage calculation."""
        result = make_result(
            columns=["category", "value"],
            rows=[
                ["A", 25],
                ["B", 50],
                ["C", 25],
            ],
        )

        with_pct = calculate_percent_of_total(result, "value")

        assert with_pct.columns[-1] == "value_pct"
        assert with_pct.rows[0][-1] == 25.0  # 25/100 * 100
        assert with_pct.rows[1][-1] == 50.0  # 50/100 * 100
        assert with_pct.rows[2][-1] == 25.0

    def test_percent_of_total_with_groups(self) -> None:
        """Test percentage within groups."""
        result = make_result(
            columns=["region", "category", "value"],
            rows=[
                ["East", "A", 20],
                ["East", "B", 30],
                ["West", "A", 40],
                ["West", "B", 60],
            ],
        )

        with_pct = calculate_percent_of_total(result, "value", group_column="region")

        # East percentages (total 50)
        east_a = next(r for r in with_pct.rows if r[0] == "East" and r[1] == "A")
        east_b = next(r for r in with_pct.rows if r[0] == "East" and r[1] == "B")
        assert east_a[-1] == 40.0  # 20/50 * 100
        assert east_b[-1] == 60.0  # 30/50 * 100

        # West percentages (total 100)
        west_a = next(r for r in with_pct.rows if r[0] == "West" and r[1] == "A")
        west_b = next(r for r in with_pct.rows if r[0] == "West" and r[1] == "B")
        assert west_a[-1] == 40.0  # 40/100 * 100
        assert west_b[-1] == 60.0  # 60/100 * 100

    def test_percent_of_total_with_null_values(self) -> None:
        """Test percentage with null values."""
        result = make_result(
            columns=["value"],
            rows=[
                [100],
                [None],
                [100],
            ],
        )

        with_pct = calculate_percent_of_total(result, "value")

        assert with_pct.rows[0][-1] == 50.0
        assert with_pct.rows[1][-1] is None  # Null value
        assert with_pct.rows[2][-1] == 50.0

    def test_percent_of_total_zero_total(self) -> None:
        """Test percentage when total is zero."""
        result = make_result(
            columns=["value"],
            rows=[
                [0],
                [0],
            ],
        )

        with_pct = calculate_percent_of_total(result, "value")

        # Should handle zero division gracefully
        assert with_pct.rows[0][-1] is None
        assert with_pct.rows[1][-1] is None

    def test_percent_of_total_empty_result(self) -> None:
        """Test percentage with empty result."""
        result = make_result(columns=["value"], rows=[])

        with_pct = calculate_percent_of_total(result, "value")

        assert with_pct.columns == ["value", "value_pct"]
        assert with_pct.rows == []


# ============================================================================
# sort_result Tests
# ============================================================================


class TestSortResult:
    """Tests for sort_result function."""

    def test_sort_ascending(self) -> None:
        """Test ascending sort."""
        result = make_result(
            columns=["name", "score"],
            rows=[
                ["Bob", 88],
                ["Alice", 95],
                ["Charlie", 72],
            ],
        )

        sorted_result = sort_result(result, "score")

        assert sorted_result.rows[0][1] == 72
        assert sorted_result.rows[1][1] == 88
        assert sorted_result.rows[2][1] == 95

    def test_sort_descending(self) -> None:
        """Test descending sort."""
        result = make_result(
            columns=["name", "score"],
            rows=[
                ["Bob", 88],
                ["Alice", 95],
                ["Charlie", 72],
            ],
        )

        sorted_result = sort_result(result, "score", descending=True)

        assert sorted_result.rows[0][1] == 95
        assert sorted_result.rows[1][1] == 88
        assert sorted_result.rows[2][1] == 72

    def test_sort_with_nulls(self) -> None:
        """Test sort with null values."""
        result = make_result(
            columns=["value"],
            rows=[
                [10],
                [None],
                [5],
                [None],
                [15],
            ],
        )

        sorted_result = sort_result(result, "value")

        # Nulls should be last
        assert sorted_result.rows[0][0] == 5
        assert sorted_result.rows[1][0] == 10
        assert sorted_result.rows[2][0] == 15
        assert sorted_result.rows[3][0] is None
        assert sorted_result.rows[4][0] is None

    def test_sort_empty_result(self) -> None:
        """Test sort with empty result."""
        result = make_result(columns=["a"], rows=[])

        sorted_result = sort_result(result, "a")

        assert sorted_result.rows == []

    def test_sort_invalid_column(self) -> None:
        """Test sort with invalid column."""
        result = make_result(columns=["a"], rows=[[1]])

        with pytest.raises(ValueError, match="Column 'b' not found"):
            sort_result(result, "b")


# ============================================================================
# limit_result Tests
# ============================================================================


class TestLimitResult:
    """Tests for limit_result function."""

    def test_basic_limit(self) -> None:
        """Test basic limit."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3], [4], [5]],
        )

        limited = limit_result(result, limit=3)

        assert limited.row_count == 3
        assert limited.rows == [[1], [2], [3]]
        assert limited.truncated is True

    def test_limit_with_offset(self) -> None:
        """Test limit with offset."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3], [4], [5]],
        )

        limited = limit_result(result, limit=2, offset=2)

        assert limited.row_count == 2
        assert limited.rows == [[3], [4]]

    def test_limit_larger_than_data(self) -> None:
        """Test limit larger than available rows."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3]],
        )

        limited = limit_result(result, limit=10)

        assert limited.row_count == 3
        assert limited.truncated is False

    def test_limit_zero(self) -> None:
        """Test limit of zero."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3]],
        )

        limited = limit_result(result, limit=0)

        assert limited.row_count == 0
        assert limited.rows == []

    def test_offset_beyond_data(self) -> None:
        """Test offset beyond available rows."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3]],
        )

        limited = limit_result(result, limit=10, offset=10)

        assert limited.row_count == 0
        assert limited.rows == []

    def test_negative_values_handled(self) -> None:
        """Test that negative limit/offset are handled."""
        result = make_result(
            columns=["value"],
            rows=[[1], [2], [3]],
        )

        limited = limit_result(result, limit=-1, offset=-1)

        assert limited.row_count == 0
