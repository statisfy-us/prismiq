"""Tests for Prismiq type definitions."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from prismiq.types import (
    AggregationType,
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    GroupByDefinition,
    JoinDefinition,
    JoinType,
    PrismiqError,
    QueryDefinition,
    QueryResult,
    QueryTable,
    QueryTimeoutError,
    QueryValidationError,
    Relationship,
    SortDirection,
    TableNotFoundError,
    TableSchema,
)

# ============================================================================
# Schema Type Tests
# ============================================================================


class TestColumnSchema:
    """Tests for ColumnSchema model."""

    def test_basic_column(self) -> None:
        """Test creating a basic column."""
        col = ColumnSchema(
            name="id",
            data_type="integer",
            is_nullable=False,
        )
        assert col.name == "id"
        assert col.data_type == "integer"
        assert col.is_nullable is False
        assert col.is_primary_key is False
        assert col.default_value is None

    def test_column_with_all_fields(self) -> None:
        """Test creating a column with all fields."""
        col = ColumnSchema(
            name="created_at",
            data_type="timestamp with time zone",
            is_nullable=False,
            is_primary_key=False,
            default_value="now()",
        )
        assert col.default_value == "now()"

    def test_primary_key_column(self) -> None:
        """Test primary key column."""
        col = ColumnSchema(
            name="id",
            data_type="integer",
            is_nullable=False,
            is_primary_key=True,
        )
        assert col.is_primary_key is True


class TestTableSchema:
    """Tests for TableSchema model."""

    @pytest.fixture
    def users_table(self) -> TableSchema:
        """Create a sample users table."""
        return TableSchema(
            name="users",
            schema_name="public",
            columns=[
                ColumnSchema(
                    name="id", data_type="integer", is_nullable=False, is_primary_key=True
                ),
                ColumnSchema(name="email", data_type="text", is_nullable=False),
                ColumnSchema(name="name", data_type="text", is_nullable=True),
            ],
        )

    def test_basic_table(self, users_table: TableSchema) -> None:
        """Test basic table creation."""
        assert users_table.name == "users"
        assert users_table.schema_name == "public"
        assert len(users_table.columns) == 3

    def test_get_column_exists(self, users_table: TableSchema) -> None:
        """Test getting an existing column."""
        col = users_table.get_column("email")
        assert col is not None
        assert col.name == "email"
        assert col.data_type == "text"

    def test_get_column_not_exists(self, users_table: TableSchema) -> None:
        """Test getting a non-existent column."""
        col = users_table.get_column("nonexistent")
        assert col is None

    def test_has_column(self, users_table: TableSchema) -> None:
        """Test has_column method."""
        assert users_table.has_column("id") is True
        assert users_table.has_column("email") is True
        assert users_table.has_column("missing") is False


class TestRelationship:
    """Tests for Relationship model."""

    def test_relationship(self) -> None:
        """Test creating a relationship."""
        rel = Relationship(
            from_table="orders",
            from_column="user_id",
            to_table="users",
            to_column="id",
        )
        assert rel.from_table == "orders"
        assert rel.from_column == "user_id"
        assert rel.to_table == "users"
        assert rel.to_column == "id"


class TestDatabaseSchema:
    """Tests for DatabaseSchema model."""

    @pytest.fixture
    def sample_schema(self) -> DatabaseSchema:
        """Create a sample database schema."""
        return DatabaseSchema(
            tables=[
                TableSchema(
                    name="users",
                    columns=[
                        ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ],
                ),
                TableSchema(
                    name="orders",
                    columns=[
                        ColumnSchema(name="id", data_type="integer", is_nullable=False),
                        ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
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

    def test_get_table_exists(self, sample_schema: DatabaseSchema) -> None:
        """Test getting an existing table."""
        table = sample_schema.get_table("users")
        assert table is not None
        assert table.name == "users"

    def test_get_table_not_exists(self, sample_schema: DatabaseSchema) -> None:
        """Test getting a non-existent table."""
        table = sample_schema.get_table("nonexistent")
        assert table is None

    def test_has_table(self, sample_schema: DatabaseSchema) -> None:
        """Test has_table method."""
        assert sample_schema.has_table("users") is True
        assert sample_schema.has_table("orders") is True
        assert sample_schema.has_table("missing") is False

    def test_table_names(self, sample_schema: DatabaseSchema) -> None:
        """Test table_names method."""
        names = sample_schema.table_names()
        assert "users" in names
        assert "orders" in names
        assert len(names) == 2


# ============================================================================
# Query Type Tests
# ============================================================================


class TestQueryTable:
    """Tests for QueryTable model."""

    def test_basic_query_table(self) -> None:
        """Test creating a basic query table."""
        qt = QueryTable(id="t1", name="users")
        assert qt.id == "t1"
        assert qt.name == "users"
        assert qt.alias is None

    def test_query_table_with_alias(self) -> None:
        """Test query table with alias."""
        qt = QueryTable(id="t1", name="users", alias="u")
        assert qt.alias == "u"


class TestJoinDefinition:
    """Tests for JoinDefinition model."""

    def test_inner_join(self) -> None:
        """Test creating an inner join."""
        join = JoinDefinition(
            from_table_id="t1",
            from_column="user_id",
            to_table_id="t2",
            to_column="id",
        )
        assert join.join_type == JoinType.INNER

    def test_left_join(self) -> None:
        """Test creating a left join."""
        join = JoinDefinition(
            from_table_id="t1",
            from_column="user_id",
            to_table_id="t2",
            to_column="id",
            join_type=JoinType.LEFT,
        )
        assert join.join_type == JoinType.LEFT


class TestColumnSelection:
    """Tests for ColumnSelection model."""

    def test_basic_selection(self) -> None:
        """Test basic column selection."""
        sel = ColumnSelection(table_id="t1", column="email")
        assert sel.aggregation == AggregationType.NONE
        assert sel.alias is None

    def test_aggregated_selection(self) -> None:
        """Test aggregated column selection."""
        sel = ColumnSelection(
            table_id="t1",
            column="amount",
            aggregation=AggregationType.SUM,
            alias="total_amount",
        )
        assert sel.aggregation == AggregationType.SUM
        assert sel.alias == "total_amount"


class TestFilterDefinition:
    """Tests for FilterDefinition model."""

    def test_equality_filter(self) -> None:
        """Test equality filter."""
        f = FilterDefinition(
            table_id="t1",
            column="status",
            operator=FilterOperator.EQ,
            value="active",
        )
        assert f.operator == FilterOperator.EQ
        assert f.value == "active"

    def test_in_filter(self) -> None:
        """Test IN filter."""
        f = FilterDefinition(
            table_id="t1",
            column="status",
            operator=FilterOperator.IN,
            value=["active", "pending"],
        )
        assert f.value == ["active", "pending"]

    def test_null_filter(self) -> None:
        """Test IS NULL filter."""
        f = FilterDefinition(
            table_id="t1",
            column="deleted_at",
            operator=FilterOperator.IS_NULL,
        )
        assert f.value is None


class TestQueryDefinition:
    """Tests for QueryDefinition model."""

    def test_simple_query(self) -> None:
        """Test creating a simple query."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        assert len(query.tables) == 1
        assert len(query.columns) == 1
        assert query.joins == []
        assert query.filters == []

    def test_query_with_join(self) -> None:
        """Test query with join."""
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
                ),
            ],
            columns=[
                ColumnSelection(table_id="t1", column="total"),
                ColumnSelection(table_id="t2", column="email"),
            ],
        )
        assert len(query.joins) == 1

    def test_empty_tables_raises_error(self) -> None:
        """Test that empty tables raises validation error."""
        with pytest.raises(ValidationError, match="At least one table must be specified"):
            QueryDefinition(
                tables=[],
                columns=[ColumnSelection(table_id="t1", column="email")],
            )

    def test_empty_columns_raises_error(self) -> None:
        """Test that empty columns raises validation error."""
        with pytest.raises(ValidationError, match="At least one column must be selected"):
            QueryDefinition(
                tables=[QueryTable(id="t1", name="users")],
                columns=[],
            )

    def test_invalid_table_reference_in_join(self) -> None:
        """Test that invalid table reference in join raises error."""
        with pytest.raises(ValidationError, match="unknown table_id"):
            QueryDefinition(
                tables=[QueryTable(id="t1", name="users")],
                joins=[
                    JoinDefinition(
                        from_table_id="t1",
                        from_column="id",
                        to_table_id="t99",  # Invalid
                        to_column="user_id",
                    ),
                ],
                columns=[ColumnSelection(table_id="t1", column="email")],
            )

    def test_invalid_table_reference_in_column(self) -> None:
        """Test that invalid table reference in column raises error."""
        with pytest.raises(ValidationError, match="unknown table_id"):
            QueryDefinition(
                tables=[QueryTable(id="t1", name="users")],
                columns=[ColumnSelection(table_id="t99", column="email")],  # Invalid
            )

    def test_invalid_table_reference_in_filter(self) -> None:
        """Test that invalid table reference in filter raises error."""
        with pytest.raises(ValidationError, match="unknown table_id"):
            QueryDefinition(
                tables=[QueryTable(id="t1", name="users")],
                columns=[ColumnSelection(table_id="t1", column="email")],
                filters=[
                    FilterDefinition(
                        table_id="t99",  # Invalid
                        column="status",
                        operator=FilterOperator.EQ,
                        value="active",
                    )
                ],
            )

    def test_has_aggregations_false(self) -> None:
        """Test has_aggregations returns False when no aggregations."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        assert query.has_aggregations() is False

    def test_has_aggregations_true(self) -> None:
        """Test has_aggregations returns True with aggregations."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="amount", aggregation=AggregationType.SUM),
            ],
        )
        assert query.has_aggregations() is True

    def test_derive_group_by_empty_when_no_aggregations(self) -> None:
        """Test derive_group_by returns empty when no aggregations."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        assert query.derive_group_by() == []

    def test_derive_group_by_auto_derives(self) -> None:
        """Test derive_group_by auto-derives from non-aggregated columns."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="status"),
                ColumnSelection(table_id="t1", column="amount", aggregation=AggregationType.SUM),
            ],
        )
        group_by = query.derive_group_by()
        assert len(group_by) == 1
        assert group_by[0].table_id == "t1"
        assert group_by[0].column == "status"

    def test_derive_group_by_uses_explicit(self) -> None:
        """Test derive_group_by uses explicit group_by if provided."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="status"),
                ColumnSelection(table_id="t1", column="amount", aggregation=AggregationType.SUM),
            ],
            group_by=[GroupByDefinition(table_id="t1", column="category")],
        )
        group_by = query.derive_group_by()
        assert len(group_by) == 1
        assert group_by[0].column == "category"

    def test_get_table_by_id(self) -> None:
        """Test get_table_by_id method."""
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        assert query.get_table_by_id("t1") is not None
        assert query.get_table_by_id("t1").name == "users"  # type: ignore[union-attr]
        assert query.get_table_by_id("t99") is None


# ============================================================================
# Result Type Tests
# ============================================================================


class TestQueryResult:
    """Tests for QueryResult model."""

    def test_basic_result(self) -> None:
        """Test creating a basic result."""
        result = QueryResult(
            columns=["id", "email"],
            column_types=["integer", "text"],
            rows=[[1, "test@example.com"], [2, "user@example.com"]],
            row_count=2,
            execution_time_ms=5.5,
        )
        assert result.row_count == 2
        assert result.truncated is False
        assert len(result.rows) == 2

    def test_truncated_result(self) -> None:
        """Test truncated result."""
        result = QueryResult(
            columns=["id"],
            column_types=["integer"],
            rows=[[i] for i in range(100)],
            row_count=100,
            truncated=True,
            execution_time_ms=10.0,
        )
        assert result.truncated is True


# ============================================================================
# Exception Tests
# ============================================================================


class TestExceptions:
    """Tests for custom exceptions."""

    def test_prismiq_error(self) -> None:
        """Test base PrismiqError."""
        err = PrismiqError("Something went wrong")
        assert str(err) == "Something went wrong"
        assert err.message == "Something went wrong"

    def test_query_validation_error(self) -> None:
        """Test QueryValidationError."""
        err = QueryValidationError(
            "Query is invalid",
            errors=["Table 'foo' not found", "Column 'bar' not found"],
        )
        assert err.message == "Query is invalid"
        assert len(err.errors) == 2

    def test_query_timeout_error(self) -> None:
        """Test QueryTimeoutError."""
        err = QueryTimeoutError("Query timed out", timeout_seconds=30.0)
        assert err.timeout_seconds == 30.0

    def test_table_not_found_error(self) -> None:
        """Test TableNotFoundError."""
        err = TableNotFoundError("missing_table")
        assert err.table_name == "missing_table"
        assert "missing_table" in str(err)


# ============================================================================
# Enum Tests
# ============================================================================


class TestEnums:
    """Tests for enum types."""

    def test_aggregation_type_values(self) -> None:
        """Test AggregationType enum values."""
        assert AggregationType.NONE.value == "none"
        assert AggregationType.SUM.value == "sum"
        assert AggregationType.COUNT_DISTINCT.value == "count_distinct"

    def test_filter_operator_values(self) -> None:
        """Test FilterOperator enum values."""
        assert FilterOperator.EQ.value == "eq"
        assert FilterOperator.IN.value == "in_"
        assert FilterOperator.IS_NULL.value == "is_null"

    def test_join_type_values(self) -> None:
        """Test JoinType enum values."""
        assert JoinType.INNER.value == "INNER"
        assert JoinType.LEFT.value == "LEFT"

    def test_sort_direction_values(self) -> None:
        """Test SortDirection enum values."""
        assert SortDirection.ASC.value == "ASC"
        assert SortDirection.DESC.value == "DESC"
