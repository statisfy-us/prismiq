"""Tests for filter merging utilities."""

from __future__ import annotations

from datetime import date

import pytest

from prismiq.dashboards import DashboardFilter, DashboardFilterType
from prismiq.filter_merge import (
    FilterValue,
    filter_to_query_filter,
    filter_to_query_filters,
    get_applicable_filters,
    merge_filters,
    resolve_date_filter,
)
from prismiq.types import (
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    QueryDefinition,
    QueryTable,
    TableSchema,
)

# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="orders",
                columns=[
                    ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="status", data_type="varchar", is_nullable=False),
                    ColumnSchema(name="amount", data_type="numeric", is_nullable=False),
                    ColumnSchema(name="created_at", data_type="date", is_nullable=False),
                    ColumnSchema(name="category", data_type="varchar", is_nullable=True),
                    ColumnSchema(name="name", data_type="varchar", is_nullable=True),
                ],
            ),
            TableSchema(
                name="customers",
                columns=[
                    ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="name", data_type="varchar", is_nullable=False),
                    ColumnSchema(name="region", data_type="varchar", is_nullable=True),
                ],
            ),
        ],
        relationships=[],
    )


@pytest.fixture
def sample_query() -> QueryDefinition:
    """Create a sample query for testing."""
    return QueryDefinition(
        tables=[QueryTable(id="t1", name="orders")],
        columns=[
            ColumnSelection(table_id="t1", column="id"),
            ColumnSelection(table_id="t1", column="status"),
            ColumnSelection(table_id="t1", column="amount"),
        ],
    )


@pytest.fixture
def multi_table_query() -> QueryDefinition:
    """Create a query with multiple tables."""
    return QueryDefinition(
        tables=[
            QueryTable(id="t1", name="orders"),
            QueryTable(id="t2", name="customers"),
        ],
        columns=[
            ColumnSelection(table_id="t1", column="id"),
            ColumnSelection(table_id="t2", column="name"),
        ],
    )


# ============================================================================
# FilterValue Tests
# ============================================================================


class TestFilterValue:
    """Tests for FilterValue model."""

    def test_string_value(self) -> None:
        """Test FilterValue with string value."""
        fv = FilterValue(filter_id="f1", value="active")
        assert fv.filter_id == "f1"
        assert fv.value == "active"

    def test_list_value(self) -> None:
        """Test FilterValue with list value."""
        fv = FilterValue(filter_id="f1", value=["a", "b", "c"])
        assert fv.value == ["a", "b", "c"]

    def test_dict_value(self) -> None:
        """Test FilterValue with dict value."""
        fv = FilterValue(filter_id="f1", value={"start": "2024-01-01", "end": "2024-01-31"})
        assert fv.value["start"] == "2024-01-01"

    def test_none_value(self) -> None:
        """Test FilterValue with None value."""
        fv = FilterValue(filter_id="f1", value=None)
        assert fv.value is None


# ============================================================================
# resolve_date_filter Tests
# ============================================================================


class TestResolveDateFilter:
    """Tests for resolve_date_filter function."""

    def test_preset_value(self) -> None:
        """Test resolving a preset date value."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value="last_7_days")

        result = resolve_date_filter(filter_def, fv)

        assert result is not None
        start, end = result
        assert end == date.today()
        assert start == date.today() - __import__("datetime").timedelta(days=6)

    def test_explicit_date_range(self) -> None:
        """Test resolving explicit start/end dates."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value={"start": "2024-01-01", "end": "2024-01-31"})

        result = resolve_date_filter(filter_def, fv)

        assert result is not None
        start, end = result
        assert start == date(2024, 1, 1)
        assert end == date(2024, 1, 31)

    def test_dict_with_preset(self) -> None:
        """Test resolving dict with preset key."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value={"preset": "today"})

        result = resolve_date_filter(filter_def, fv)

        assert result is not None
        start, end = result
        assert start == date.today()
        assert end == date.today()

    def test_none_value_with_default(self) -> None:
        """Test None value uses filter's date_preset default."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
            date_preset="today",
        )
        fv = FilterValue(filter_id="f1", value=None)

        result = resolve_date_filter(filter_def, fv)

        assert result is not None
        start, _end = result
        assert start == date.today()

    def test_none_value_no_default(self) -> None:
        """Test None value without default returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value=None)

        result = resolve_date_filter(filter_def, fv)

        assert result is None

    def test_invalid_date_format(self) -> None:
        """Test invalid date format returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value={"start": "not-a-date", "end": "also-bad"})

        result = resolve_date_filter(filter_def, fv)

        assert result is None


# ============================================================================
# filter_to_query_filter Tests
# ============================================================================


class TestFilterToQueryFilter:
    """Tests for filter_to_query_filter function."""

    def test_select_filter(self) -> None:
        """Test converting select filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Status",
            field="status",
        )
        fv = FilterValue(filter_id="f1", value="active")

        result = filter_to_query_filter(filter_def, fv)

        assert result is not None
        assert result.column == "status"
        assert result.operator == FilterOperator.EQ
        assert result.value == "active"

    def test_select_empty_value_returns_none(self) -> None:
        """Test select filter with empty value returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Status",
            field="status",
        )
        fv = FilterValue(filter_id="f1", value="")

        result = filter_to_query_filter(filter_def, fv)

        assert result is None

    def test_select_all_value_returns_none(self) -> None:
        """Test select filter with __all__ value returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Status",
            field="status",
        )
        fv = FilterValue(filter_id="f1", value="__all__")

        result = filter_to_query_filter(filter_def, fv)

        assert result is None

    def test_multi_select_filter(self) -> None:
        """Test converting multi-select filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.MULTI_SELECT,
            label="Categories",
            field="category",
        )
        fv = FilterValue(filter_id="f1", value=["electronics", "clothing"])

        result = filter_to_query_filter(filter_def, fv)

        assert result is not None
        assert result.operator == FilterOperator.IN
        assert result.value == ["electronics", "clothing"]

    def test_multi_select_empty_list_returns_none(self) -> None:
        """Test multi-select with empty list returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.MULTI_SELECT,
            label="Categories",
            field="category",
        )
        fv = FilterValue(filter_id="f1", value=[])

        result = filter_to_query_filter(filter_def, fv)

        assert result is None

    def test_text_filter(self) -> None:
        """Test converting text filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.TEXT,
            label="Search",
            field="name",
        )
        fv = FilterValue(filter_id="f1", value="test")

        result = filter_to_query_filter(filter_def, fv)

        assert result is not None
        assert result.operator == FilterOperator.ILIKE
        assert result.value == "%test%"

    def test_text_empty_value_returns_none(self) -> None:
        """Test text filter with empty value returns None."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.TEXT,
            label="Search",
            field="name",
        )
        fv = FilterValue(filter_id="f1", value="")

        result = filter_to_query_filter(filter_def, fv)

        assert result is None

    def test_none_value_returns_none(self) -> None:
        """Test None value returns None for any filter type."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Status",
            field="status",
        )
        fv = FilterValue(filter_id="f1", value=None)

        result = filter_to_query_filter(filter_def, fv)

        assert result is None


# ============================================================================
# filter_to_query_filters Tests
# ============================================================================


class TestFilterToQueryFilters:
    """Tests for filter_to_query_filters function."""

    def test_date_range_creates_two_filters(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test date range filter creates two query filters."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.DATE_RANGE,
            label="Date",
            field="created_at",
        )
        fv = FilterValue(filter_id="f1", value={"start": "2024-01-01", "end": "2024-01-31"})

        result = filter_to_query_filters(filter_def, fv, sample_query, sample_schema)

        assert len(result) == 2
        assert result[0].operator == FilterOperator.GTE
        assert result[0].value == "2024-01-01"
        assert result[1].operator == FilterOperator.LTE
        assert result[1].value == "2024-01-31"

    def test_number_range_min_only(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test number range with only min creates one filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.NUMBER_RANGE,
            label="Amount",
            field="amount",
        )
        fv = FilterValue(filter_id="f1", value={"min": 100})

        result = filter_to_query_filters(filter_def, fv, sample_query, sample_schema)

        assert len(result) == 1
        assert result[0].operator == FilterOperator.GTE
        assert result[0].value == 100

    def test_number_range_max_only(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test number range with only max creates one filter."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.NUMBER_RANGE,
            label="Amount",
            field="amount",
        )
        fv = FilterValue(filter_id="f1", value={"max": 1000})

        result = filter_to_query_filters(filter_def, fv, sample_query, sample_schema)

        assert len(result) == 1
        assert result[0].operator == FilterOperator.LTE
        assert result[0].value == 1000

    def test_number_range_both(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test number range with both min and max creates two filters."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.NUMBER_RANGE,
            label="Amount",
            field="amount",
        )
        fv = FilterValue(filter_id="f1", value={"min": 100, "max": 1000})

        result = filter_to_query_filters(filter_def, fv, sample_query, sample_schema)

        assert len(result) == 2

    def test_column_not_in_query_returns_empty(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test filter for column not in query returns empty list."""
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Region",
            field="region",  # This column is in customers, not orders
        )
        fv = FilterValue(filter_id="f1", value="east")

        result = filter_to_query_filters(filter_def, fv, sample_query, sample_schema)

        assert len(result) == 0

    def test_resolves_correct_table_id(
        self, multi_table_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that correct table ID is resolved for column."""
        # Filter for region column which is only in customers (t2)
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.SELECT,
            label="Region",
            field="region",
        )
        fv = FilterValue(filter_id="f1", value="east")

        result = filter_to_query_filters(filter_def, fv, multi_table_query, sample_schema)

        assert len(result) == 1
        assert result[0].table_id == "t2"

    def test_table_hint_respected(
        self, multi_table_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that table hint is respected when column exists in multiple tables."""
        # 'name' exists in both orders and customers, but we specify customers
        filter_def = DashboardFilter(
            id="f1",
            type=DashboardFilterType.TEXT,
            label="Name",
            field="name",
            table="customers",
        )
        fv = FilterValue(filter_id="f1", value="John")

        result = filter_to_query_filters(filter_def, fv, multi_table_query, sample_schema)

        assert len(result) == 1
        assert result[0].table_id == "t2"


# ============================================================================
# get_applicable_filters Tests
# ============================================================================


class TestGetApplicableFilters:
    """Tests for get_applicable_filters function."""

    def test_returns_applicable_filters(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test returns only filters for columns in query."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",  # In orders
            ),
            DashboardFilter(
                id="f2",
                type=DashboardFilterType.SELECT,
                label="Region",
                field="region",  # In customers, not in query
            ),
        ]

        result = get_applicable_filters(sample_query, filters, sample_schema)

        assert len(result) == 1
        assert result[0].id == "f1"

    def test_multi_table_query(
        self, multi_table_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test with query that includes multiple tables."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",  # In orders
            ),
            DashboardFilter(
                id="f2",
                type=DashboardFilterType.SELECT,
                label="Region",
                field="region",  # In customers
            ),
            DashboardFilter(
                id="f3",
                type=DashboardFilterType.TEXT,
                label="City",
                field="city",  # Not in any table
            ),
        ]

        result = get_applicable_filters(multi_table_query, filters, sample_schema)

        assert len(result) == 2
        filter_ids = {f.id for f in result}
        assert filter_ids == {"f1", "f2"}

    def test_empty_filters_returns_empty(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test empty filter list returns empty."""
        result = get_applicable_filters(sample_query, [], sample_schema)
        assert result == []


# ============================================================================
# merge_filters Tests
# ============================================================================


class TestMergeFilters:
    """Tests for merge_filters function."""

    def test_merges_filter_into_query(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that filter is merged into query."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            )
        ]
        values = [FilterValue(filter_id="f1", value="active")]

        result = merge_filters(sample_query, filters, values, sample_schema)

        assert len(result.filters) == 1
        assert result.filters[0].column == "status"
        assert result.filters[0].value == "active"

    def test_preserves_existing_filters(self, sample_schema: DatabaseSchema) -> None:
        """Test that existing query filters are preserved."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="amount",
                    operator=FilterOperator.GT,
                    value=100,
                )
            ],
        )
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            )
        ]
        values = [FilterValue(filter_id="f1", value="active")]

        result = merge_filters(query, filters, values, sample_schema)

        assert len(result.filters) == 2

    def test_uses_default_value_when_no_runtime_value(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that default value is used when no runtime value provided."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
                default_value="pending",
            )
        ]

        result = merge_filters(sample_query, filters, [], sample_schema)

        assert len(result.filters) == 1
        assert result.filters[0].value == "pending"

    def test_skips_filters_without_value_or_default(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that filters without value or default are skipped."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            )
        ]

        result = merge_filters(sample_query, filters, [], sample_schema)

        assert len(result.filters) == 0

    def test_does_not_mutate_original_query(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test that original query is not mutated."""
        original_filter_count = len(sample_query.filters)
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            )
        ]
        values = [FilterValue(filter_id="f1", value="active")]

        merge_filters(sample_query, filters, values, sample_schema)

        assert len(sample_query.filters) == original_filter_count

    def test_returns_original_when_no_applicable_filters(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test returns original query when no filters apply."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Region",
                field="region",  # Not in orders table
            )
        ]
        values = [FilterValue(filter_id="f1", value="east")]

        result = merge_filters(sample_query, filters, values, sample_schema)

        # Should return original query unchanged
        assert len(result.filters) == 0

    def test_multi_value_filters(
        self, sample_query: QueryDefinition, sample_schema: DatabaseSchema
    ) -> None:
        """Test merging multiple filter values."""
        filters = [
            DashboardFilter(
                id="f1",
                type=DashboardFilterType.SELECT,
                label="Status",
                field="status",
            ),
            DashboardFilter(
                id="f2",
                type=DashboardFilterType.DATE_RANGE,
                label="Date",
                field="created_at",
            ),
        ]
        values = [
            FilterValue(filter_id="f1", value="active"),
            FilterValue(filter_id="f2", value={"start": "2024-01-01", "end": "2024-01-31"}),
        ]

        result = merge_filters(sample_query, filters, values, sample_schema)

        # 1 from select + 2 from date range
        assert len(result.filters) == 3
