"""Tests for query builder."""

from __future__ import annotations

import pytest

from prismiq.query import QueryBuilder
from prismiq.types import (
    AggregationType,
    CalculatedField,
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    GroupByDefinition,
    JoinDefinition,
    JoinType,
    QueryDefinition,
    QueryTable,
    Relationship,
    SortDefinition,
    SortDirection,
    TableSchema,
    TimeSeriesConfig,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="email", data_type="text", is_nullable=False),
                    ColumnSchema(name="name", data_type="text", is_nullable=True),
                    ColumnSchema(name="created_at", data_type="timestamp", is_nullable=False),
                ],
            ),
            TableSchema(
                name="orders",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="total", data_type="numeric", is_nullable=False),
                    ColumnSchema(name="status", data_type="text", is_nullable=False),
                    ColumnSchema(name="created_at", data_type="timestamp", is_nullable=False),
                ],
            ),
            TableSchema(
                name="products",
                schema_name="public",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="name", data_type="text", is_nullable=False),
                    ColumnSchema(name="price", data_type="numeric", is_nullable=False),
                ],
            ),
        ],
        relationships=[
            Relationship(
                from_table="orders",
                from_column="user_id",
                to_table="users",
                to_column="id",
            ),
        ],
    )


@pytest.fixture
def builder(sample_schema: DatabaseSchema) -> QueryBuilder:
    """Create a QueryBuilder with the sample schema."""
    return QueryBuilder(sample_schema)


# ============================================================================
# Validation Tests
# ============================================================================


class TestValidation:
    """Tests for query validation."""

    def test_validate_valid_query(self, builder: QueryBuilder) -> None:
        """Test validation passes for valid query."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        errors = builder.validate(query)
        assert errors == []

    def test_validate_unknown_table(self, builder: QueryBuilder) -> None:
        """Test validation fails for unknown table."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="nonexistent")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "nonexistent" in errors[0]

    def test_validate_unknown_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for unknown column."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="nonexistent")],
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "nonexistent" in errors[0]

    def test_validate_invalid_join_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for invalid join column."""
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="orders"),
                QueryTable(id="t2", name="users"),
            ],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="invalid_column",
                    to_table_id="t2",
                    to_column="id",
                )
            ],
            columns=[ColumnSelection(table_id="t1", column="total")],
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "invalid_column" in errors[0]

    def test_validate_invalid_filter_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for invalid filter column."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="nonexistent",
                    operator=FilterOperator.EQ,
                    value="test",
                )
            ],
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "nonexistent" in errors[0]

    def test_validate_invalid_order_by_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for invalid order by column."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            order_by=[
                SortDefinition(table_id="t1", column="nonexistent", direction=SortDirection.ASC)
            ],
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "nonexistent" in errors[0]


# ============================================================================
# Simple Query Tests
# ============================================================================


class TestSimpleQueries:
    """Tests for simple single-table queries."""

    def test_simple_select(self, builder: QueryBuilder) -> None:
        """Test simple SELECT query."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        sql, params = builder.build(query)

        assert sql == 'SELECT "users"."email" FROM "users"'
        assert params == []

    def test_select_multiple_columns(self, builder: QueryBuilder) -> None:
        """Test SELECT with multiple columns."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="id"),
                ColumnSelection(table_id="t1", column="email"),
                ColumnSelection(table_id="t1", column="name"),
            ],
        )
        sql, params = builder.build(query)

        assert sql == 'SELECT "users"."id", "users"."email", "users"."name" FROM "users"'
        assert params == []

    def test_select_with_alias(self, builder: QueryBuilder) -> None:
        """Test SELECT with column alias."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="email", alias="user_email"),
            ],
        )
        sql, params = builder.build(query)

        assert sql == 'SELECT "users"."email" AS "user_email" FROM "users"'
        assert params == []

    def test_select_with_table_alias(self, builder: QueryBuilder) -> None:
        """Test SELECT with table alias."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users", alias="u")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        sql, params = builder.build(query)

        assert sql == 'SELECT "u"."email" FROM "users" AS "u"'
        assert params == []


# ============================================================================
# Filter Tests
# ============================================================================


class TestFilters:
    """Tests for filter operators."""

    def test_filter_eq(self, builder: QueryBuilder) -> None:
        """Test equality filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(table_id="t1", column="id", operator=FilterOperator.EQ, value=42)
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."id" = $1' in sql
        assert params == [42]

    def test_filter_neq(self, builder: QueryBuilder) -> None:
        """Test not equal filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="name", operator=FilterOperator.NEQ, value="test"
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."name" <> $1' in sql
        assert params == ["test"]

    def test_filter_gt_gte_lt_lte(self, builder: QueryBuilder) -> None:
        """Test comparison filters."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="total", operator=FilterOperator.GTE, value=100
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."total" >= $1' in sql
        assert params == [100]

    def test_filter_in(self, builder: QueryBuilder) -> None:
        """Test IN filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN,
                    value=["pending", "shipped"],
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."status" IN ($1, $2)' in sql
        assert params == ["pending", "shipped"]

    def test_filter_not_in(self, builder: QueryBuilder) -> None:
        """Test NOT IN filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.NOT_IN,
                    value=["cancelled"],
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."status" NOT IN ($1)' in sql
        assert params == ["cancelled"]

    def test_filter_in_or_null(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value=["pending", "shipped"],
                )
            ],
        )
        sql, params = builder.build(query)

        assert '("orders"."status" IN ($1, $2) OR "orders"."status" IS NULL)' in sql
        assert params == ["pending", "shipped"]

    def test_filter_in_or_null_single_value(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter with a single non-list value."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value="pending",
                )
            ],
        )
        sql, params = builder.build(query)

        assert '("orders"."status" IN ($1) OR "orders"."status" IS NULL)' in sql
        assert params == ["pending"]

    def test_filter_in_or_null_empty_list(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter with empty list falls back to IS NULL."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value=[],
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."status" IS NULL' in sql
        assert params == []

    def test_filter_in_or_null_filters_none_from_list(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter removes None values from list (handled by IS NULL)."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value=["pending", None, "shipped"],
                )
            ],
        )
        sql, params = builder.build(query)

        # None should be filtered out - only concrete values in IN clause
        assert '("orders"."status" IN ($1, $2) OR "orders"."status" IS NULL)' in sql
        assert params == ["pending", "shipped"]

    def test_filter_in_or_null_list_of_only_nones(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter with list of only None values falls back to IS NULL."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value=[None, None],
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."status" IS NULL' in sql
        assert params == []

    def test_filter_in_or_null_single_none_value(self, builder: QueryBuilder) -> None:
        """Test IN OR NULL filter with single None value returns IS NULL."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="status")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="status",
                    operator=FilterOperator.IN_OR_NULL,
                    value=None,
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."status" IS NULL' in sql
        assert params == []

    def test_filter_like(self, builder: QueryBuilder) -> None:
        """Test LIKE filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="email",
                    operator=FilterOperator.LIKE,
                    value="%@example.com",
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."email" LIKE $1' in sql
        assert params == ["%@example.com"]

    def test_filter_ilike(self, builder: QueryBuilder) -> None:
        """Test ILIKE filter (case-insensitive)."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="name", operator=FilterOperator.ILIKE, value="%john%"
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."name" ILIKE $1' in sql
        assert params == ["%john%"]

    def test_filter_not_like(self, builder: QueryBuilder) -> None:
        """Test NOT LIKE filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="email",
                    operator=FilterOperator.NOT_LIKE,
                    value="%@spam.com",
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."email" NOT LIKE $1' in sql
        assert params == ["%@spam.com"]

    def test_filter_not_ilike(self, builder: QueryBuilder) -> None:
        """Test NOT ILIKE filter (case-insensitive)."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="name")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="name",
                    operator=FilterOperator.NOT_ILIKE,
                    value="%test%",
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."name" NOT ILIKE $1' in sql
        assert params == ["%test%"]

    def test_filter_between(self, builder: QueryBuilder) -> None:
        """Test BETWEEN filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="total",
                    operator=FilterOperator.BETWEEN,
                    value=[100, 500],
                )
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "orders"."total" BETWEEN $1 AND $2' in sql
        assert params == [100, 500]

    def test_filter_is_null(self, builder: QueryBuilder) -> None:
        """Test IS NULL filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(table_id="t1", column="name", operator=FilterOperator.IS_NULL)
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."name" IS NULL' in sql
        assert params == []

    def test_filter_is_not_null(self, builder: QueryBuilder) -> None:
        """Test IS NOT NULL filter."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(table_id="t1", column="name", operator=FilterOperator.IS_NOT_NULL)
            ],
        )
        sql, params = builder.build(query)

        assert 'WHERE "users"."name" IS NOT NULL' in sql
        assert params == []

    def test_multiple_filters(self, builder: QueryBuilder) -> None:
        """Test multiple filters combined with AND."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="status", operator=FilterOperator.EQ, value="pending"
                ),
                FilterDefinition(
                    table_id="t1", column="total", operator=FilterOperator.GTE, value=100
                ),
            ],
        )
        sql, params = builder.build(query)

        assert "WHERE" in sql
        assert '"orders"."status" = $1' in sql
        assert '"orders"."total" >= $2' in sql
        assert " AND " in sql
        assert params == ["pending", 100]


# ============================================================================
# Join Tests
# ============================================================================


class TestJoins:
    """Tests for JOIN queries."""

    def test_inner_join(self, builder: QueryBuilder) -> None:
        """Test INNER JOIN."""
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="orders"),
                QueryTable(id="t2", name="users"),
            ],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="user_id",
                    to_table_id="t2",
                    to_column="id",
                    join_type=JoinType.INNER,
                )
            ],
            columns=[
                ColumnSelection(table_id="t1", column="total"),
                ColumnSelection(table_id="t2", column="email"),
            ],
        )
        sql, _params = builder.build(query)

        assert 'INNER JOIN "users"' in sql
        assert '"orders"."user_id" = "users"."id"' in sql

    def test_left_join(self, builder: QueryBuilder) -> None:
        """Test LEFT JOIN."""
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="id",
                    to_table_id="t2",
                    to_column="user_id",
                    join_type=JoinType.LEFT,
                )
            ],
            columns=[
                ColumnSelection(table_id="t1", column="email"),
                ColumnSelection(table_id="t2", column="total"),
            ],
        )
        sql, _params = builder.build(query)

        assert 'LEFT JOIN "orders"' in sql


# ============================================================================
# Aggregation Tests
# ============================================================================


class TestAggregations:
    """Tests for aggregation functions."""

    def test_count(self, builder: QueryBuilder) -> None:
        """Test COUNT aggregation."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1", column="id", aggregation=AggregationType.COUNT, alias="count"
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'COUNT("orders"."id") AS "count"' in sql

    def test_sum(self, builder: QueryBuilder) -> None:
        """Test SUM aggregation."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.SUM, alias="sum"
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'SUM("orders"."total") AS "sum"' in sql

    def test_avg(self, builder: QueryBuilder) -> None:
        """Test AVG aggregation."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.AVG, alias="average"
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'AVG("orders"."total") AS "average"' in sql

    def test_count_distinct(self, builder: QueryBuilder) -> None:
        """Test COUNT DISTINCT aggregation."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1",
                    column="user_id",
                    aggregation=AggregationType.COUNT_DISTINCT,
                    alias="unique_users",
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'COUNT(DISTINCT "orders"."user_id") AS "unique_users"' in sql

    def test_min_max(self, builder: QueryBuilder) -> None:
        """Test MIN and MAX aggregations."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.MIN, alias="min"
                ),
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.MAX, alias="max"
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'MIN("orders"."total") AS "min"' in sql
        assert 'MAX("orders"."total") AS "max"' in sql


# ============================================================================
# GROUP BY Tests
# ============================================================================


class TestGroupBy:
    """Tests for GROUP BY clause generation."""

    def test_auto_group_by(self, builder: QueryBuilder) -> None:
        """Test automatic GROUP BY for aggregated queries."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="status"),
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.SUM, alias="sum"
                ),
            ],
        )
        sql, _params = builder.build(query)

        assert 'GROUP BY "orders"."status"' in sql

    def test_explicit_group_by(self, builder: QueryBuilder) -> None:
        """Test explicit GROUP BY."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="status"),
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.SUM, alias="sum"
                ),
            ],
            group_by=[GroupByDefinition(table_id="t1", column="status")],
        )
        sql, _params = builder.build(query)

        assert 'GROUP BY "orders"."status"' in sql

    def test_no_group_by_without_aggregation(self, builder: QueryBuilder) -> None:
        """Test no GROUP BY when no aggregations."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="status"),
                ColumnSelection(table_id="t1", column="total"),
            ],
        )
        sql, _params = builder.build(query)

        assert "GROUP BY" not in sql


# ============================================================================
# ORDER BY Tests
# ============================================================================


class TestOrderBy:
    """Tests for ORDER BY clause."""

    def test_order_by_asc(self, builder: QueryBuilder) -> None:
        """Test ORDER BY ascending."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            order_by=[SortDefinition(table_id="t1", column="email", direction=SortDirection.ASC)],
        )
        sql, _params = builder.build(query)

        assert 'ORDER BY "users"."email" ASC' in sql

    def test_order_by_desc(self, builder: QueryBuilder) -> None:
        """Test ORDER BY descending."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            order_by=[
                SortDefinition(table_id="t1", column="created_at", direction=SortDirection.DESC)
            ],
        )
        sql, _params = builder.build(query)

        assert 'ORDER BY "users"."created_at" DESC' in sql

    def test_multiple_order_by(self, builder: QueryBuilder) -> None:
        """Test multiple ORDER BY columns."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            order_by=[
                SortDefinition(table_id="t1", column="name", direction=SortDirection.ASC),
                SortDefinition(table_id="t1", column="email", direction=SortDirection.DESC),
            ],
        )
        sql, _params = builder.build(query)

        assert 'ORDER BY "users"."name" ASC, "users"."email" DESC' in sql


# ============================================================================
# LIMIT/OFFSET Tests
# ============================================================================


class TestLimitOffset:
    """Tests for LIMIT and OFFSET."""

    def test_limit(self, builder: QueryBuilder) -> None:
        """Test LIMIT clause."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            limit=100,
        )
        sql, params = builder.build(query)

        assert "LIMIT $1" in sql
        assert params == [100]

    def test_offset(self, builder: QueryBuilder) -> None:
        """Test OFFSET clause."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            offset=50,
        )
        sql, params = builder.build(query)

        assert "OFFSET $1" in sql
        assert params == [50]

    def test_limit_and_offset(self, builder: QueryBuilder) -> None:
        """Test LIMIT and OFFSET together."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            limit=100,
            offset=50,
        )
        sql, params = builder.build(query)

        assert "LIMIT $1" in sql
        assert "OFFSET $2" in sql
        assert params == [100, 50]


# ============================================================================
# SQL Injection Prevention Tests
# ============================================================================


class TestSqlInjectionPrevention:
    """Tests for SQL injection prevention."""

    def test_quotes_identifiers(self, builder: QueryBuilder) -> None:
        """Test that identifiers are properly quoted."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        sql, _params = builder.build(query)

        # All identifiers should be double-quoted
        assert '"users"' in sql
        assert '"email"' in sql

    def test_values_are_parameterized(self, builder: QueryBuilder) -> None:
        """Test that values are parameterized, not interpolated."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="email",
                    operator=FilterOperator.EQ,
                    value="test'; DROP TABLE users; --",
                )
            ],
        )
        sql, params = builder.build(query)

        # The malicious value should be in params, not in the SQL
        assert "DROP TABLE" not in sql
        assert "test'; DROP TABLE users; --" in params
        assert "$1" in sql

    def test_escapes_identifier_quotes(self, builder: QueryBuilder) -> None:
        """Test that double quotes in identifiers are escaped."""
        # This tests the internal _quote_identifier method
        escaped = builder._quote_identifier('column"name')
        assert escaped == '"column""name"'


# ============================================================================
# Time Series Tests
# ============================================================================


class TestTimeSeries:
    """Tests for time series query building."""

    def test_time_series_adds_date_trunc_column(self, builder: QueryBuilder) -> None:
        """Test that time series adds date_trunc to SELECT."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(
                    table_id="t1", column="total", aggregation=AggregationType.SUM, alias="sum"
                ),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="day",
            ),
        )
        sql, _params = builder.build(query)

        assert "date_trunc('day'" in sql
        assert '"orders"."created_at"' in sql
        assert '"created_at_bucket"' in sql  # Default alias

    def test_time_series_with_custom_alias(self, builder: QueryBuilder) -> None:
        """Test time series with custom alias."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="month",
                alias="period",
            ),
        )
        sql, _params = builder.build(query)

        assert "date_trunc('month'" in sql
        assert '"period"' in sql

    def test_time_series_adds_group_by(self, builder: QueryBuilder) -> None:
        """Test that time series adds date_trunc to GROUP BY."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="week",
            ),
        )
        sql, _params = builder.build(query)

        assert "GROUP BY date_trunc('week'" in sql

    def test_time_series_adds_order_by(self, builder: QueryBuilder) -> None:
        """Test that time series adds date bucket to ORDER BY."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="day",
            ),
        )
        sql, _params = builder.build(query)

        assert "ORDER BY date_trunc('day'" in sql
        assert "ASC" in sql

    def test_time_series_with_explicit_order_by(self, builder: QueryBuilder) -> None:
        """Test that explicit order_by overrides time series default."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="day",
            ),
            order_by=[SortDefinition(table_id="t1", column="total", direction=SortDirection.DESC)],
        )
        sql, _params = builder.build(query)

        # Should use explicit order by, not the date bucket
        assert '"orders"."total" DESC' in sql

    def test_time_series_all_intervals(self, builder: QueryBuilder) -> None:
        """Test all valid time intervals."""
        for interval in ["minute", "hour", "day", "week", "month", "quarter", "year"]:
            query = QueryDefinition(
                tables=[QueryTable(id="t1", name="orders")],
                columns=[
                    ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
                ],
                time_series=TimeSeriesConfig(
                    table_id="t1",
                    date_column="created_at",
                    interval=interval,
                ),
            )
            sql, _params = builder.build(query)

            assert f"date_trunc('{interval}'" in sql


class TestTimeSeriesValidation:
    """Tests for time series validation."""

    def test_validate_time_series_valid(self, builder: QueryBuilder) -> None:
        """Test validation passes for valid time series config."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="day",
            ),
        )
        errors = builder.validate(query)
        assert errors == []

    def test_validate_time_series_invalid_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for invalid date column."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total"),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="nonexistent",
                interval="day",
            ),
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "nonexistent" in errors[0]

    def test_validate_time_series_non_date_column(self, builder: QueryBuilder) -> None:
        """Test validation fails for non-date column."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total"),
            ],
            time_series=TimeSeriesConfig(
                table_id="t1",
                date_column="status",  # text column, not date
                interval="day",
            ),
        )
        errors = builder.validate(query)
        assert len(errors) == 1
        assert "not a date/timestamp type" in errors[0]

    def test_validate_time_series_invalid_interval(self) -> None:
        """Test validation fails for invalid interval."""
        with pytest.raises(ValueError, match="Invalid interval"):
            TimeSeriesConfig(
                table_id="t1",
                date_column="created_at",
                interval="invalid",
            )


# ============================================================================
# Calculated Fields Tests
# ============================================================================


class TestCalculatedFields:
    """Tests for calculated field support in queries."""

    def test_calculated_field_in_select(self, builder: QueryBuilder) -> None:
        """Test calculated field is expanded in SELECT clause."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="is_large_order")],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)")
            ],
        )
        sql, _params = builder.build(query)

        # Should expand to CASE WHEN expression, not "orders"."is_large_order"
        assert "is_large_order" not in sql or "CASE WHEN" in sql
        assert '"orders"."is_large_order"' not in sql

    def test_calculated_field_in_filter(self, builder: QueryBuilder) -> None:
        """Test calculated field is expanded in WHERE clause."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="is_large_order",
                    operator=FilterOperator.EQ,
                    value=1,
                )
            ],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)")
            ],
        )
        sql, params = builder.build(query)

        # Should expand calculated field in WHERE, not reference non-existent column
        assert '"orders"."is_large_order"' not in sql
        assert "WHERE" in sql
        assert "CASE WHEN" in sql
        assert params == [1]

    def test_calculated_field_in_order_by(self, builder: QueryBuilder) -> None:
        """Test calculated field is expanded in ORDER BY clause."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            order_by=[
                SortDefinition(table_id="t1", column="is_large_order", direction=SortDirection.DESC)
            ],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)")
            ],
        )
        sql, _params = builder.build(query)

        # Should expand calculated field in ORDER BY, not reference non-existent column
        assert '"orders"."is_large_order"' not in sql
        assert "ORDER BY" in sql
        assert "CASE WHEN" in sql
        assert "DESC" in sql

    def test_calculated_field_validation_allows_filter(self, builder: QueryBuilder) -> None:
        """Test validation passes for filter on calculated field."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="is_large_order",
                    operator=FilterOperator.EQ,
                    value=1,
                )
            ],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)")
            ],
        )
        errors = builder.validate(query)

        # Should not error about "is_large_order" not found in table
        assert len(errors) == 0

    def test_calculated_field_validation_allows_order_by(self, builder: QueryBuilder) -> None:
        """Test validation passes for order by calculated field."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="total")],
            order_by=[
                SortDefinition(table_id="t1", column="is_large_order", direction=SortDirection.ASC)
            ],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)")
            ],
        )
        errors = builder.validate(query)

        # Should not error about "is_large_order" not found in table
        assert len(errors) == 0

    def test_calculated_field_with_simple_expression(self, builder: QueryBuilder) -> None:
        """Test calculated field with simple arithmetic expression."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[ColumnSelection(table_id="t1", column="double_total")],
            calculated_fields=[CalculatedField(name="double_total", expression="[total] * 2")],
        )
        sql, _params = builder.build(query)

        # Should expand to arithmetic expression
        assert '"total"' in sql
        assert "* 2" in sql

    def test_multiple_calculated_fields(self, builder: QueryBuilder) -> None:
        """Test multiple calculated fields in same query."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="is_large_order"),
                ColumnSelection(table_id="t1", column="double_total"),
            ],
            filters=[
                FilterDefinition(
                    table_id="t1",
                    column="is_large_order",
                    operator=FilterOperator.EQ,
                    value=1,
                )
            ],
            order_by=[
                SortDefinition(table_id="t1", column="double_total", direction=SortDirection.DESC)
            ],
            calculated_fields=[
                CalculatedField(name="is_large_order", expression="if([total] > 100, 1, 0)"),
                CalculatedField(name="double_total", expression="[total] * 2"),
            ],
        )
        sql, params = builder.build(query)

        # Both calculated fields should be expanded
        assert '"orders"."is_large_order"' not in sql
        assert '"orders"."double_total"' not in sql
        assert "CASE WHEN" in sql  # From is_large_order
        assert "* 2" in sql  # From double_total
        assert params == [1]
