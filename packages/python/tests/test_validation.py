"""Tests for enhanced query validation."""

from __future__ import annotations

import pytest

from prismiq.query import (
    ERROR_CIRCULAR_JOIN,
    ERROR_COLUMN_NOT_FOUND,
    ERROR_INVALID_AGGREGATION,
    ERROR_INVALID_JOIN,
    ERROR_TABLE_NOT_FOUND,
    ERROR_TYPE_MISMATCH,
    QueryBuilder,
    ValidationError,
    ValidationResult,
)
from prismiq.types import (
    AggregationType,
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    FilterDefinition,
    FilterOperator,
    JoinDefinition,
    QueryDefinition,
    QueryTable,
    SortDefinition,
    TableSchema,
)


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema for testing."""
    return DatabaseSchema(
        tables=[
            TableSchema(
                name="users",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="email", data_type="varchar", is_nullable=False),
                    ColumnSchema(name="name", data_type="varchar", is_nullable=True),
                    ColumnSchema(name="created_at", data_type="timestamp", is_nullable=False),
                ],
            ),
            TableSchema(
                name="orders",
                columns=[
                    ColumnSchema(
                        name="id", data_type="integer", is_nullable=False, is_primary_key=True
                    ),
                    ColumnSchema(name="user_id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="total", data_type="numeric", is_nullable=False),
                    ColumnSchema(name="status", data_type="varchar", is_nullable=False),
                ],
            ),
            TableSchema(
                name="products",
                columns=[
                    ColumnSchema(name="id", data_type="integer", is_nullable=False),
                    ColumnSchema(name="price", data_type="numeric", is_nullable=False),
                    ColumnSchema(name="quantity", data_type="integer", is_nullable=False),
                ],
            ),
        ],
        relationships=[],
    )


class TestValidationResult:
    """Tests for ValidationResult model."""

    def test_valid_result(self) -> None:
        """Valid result has no errors."""
        result = ValidationResult(valid=True, errors=[])
        assert result.valid is True
        assert result.errors == []

    def test_invalid_result(self) -> None:
        """Invalid result has errors."""
        result = ValidationResult(
            valid=False,
            errors=[
                ValidationError(
                    code="TEST_ERROR",
                    message="Test error message",
                    field="test.field",
                    suggestion="Try something else",
                )
            ],
        )
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].code == "TEST_ERROR"


class TestTableNotFound:
    """Tests for TABLE_NOT_FOUND errors."""

    def test_missing_table(self, sample_schema: DatabaseSchema) -> None:
        """Missing table produces TABLE_NOT_FOUND error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="nonexistent")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].code == ERROR_TABLE_NOT_FOUND
        assert result.errors[0].field == "tables[0].name"
        assert "nonexistent" in result.errors[0].message

    def test_similar_table_suggestion(self, sample_schema: DatabaseSchema) -> None:
        """Similar table name produces suggestion."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="user")],  # Close to "users"
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].suggestion is not None
        assert "users" in result.errors[0].suggestion


class TestColumnNotFound:
    """Tests for COLUMN_NOT_FOUND errors."""

    def test_missing_column(self, sample_schema: DatabaseSchema) -> None:
        """Missing column produces COLUMN_NOT_FOUND error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="nonexistent")],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].code == ERROR_COLUMN_NOT_FOUND
        assert result.errors[0].field == "columns[0].column"

    def test_similar_column_suggestion(self, sample_schema: DatabaseSchema) -> None:
        """Similar column name produces suggestion."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="emails")],  # Close to "email"
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].suggestion is not None
        assert "email" in result.errors[0].suggestion

    def test_filter_column_not_found(self, sample_schema: DatabaseSchema) -> None:
        """Missing filter column produces error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="missing", operator=FilterOperator.EQ, value=1
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_COLUMN_NOT_FOUND
        assert result.errors[0].field == "filters[0].column"

    def test_order_by_column_not_found(self, sample_schema: DatabaseSchema) -> None:
        """Missing order by column produces error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            order_by=[SortDefinition(table_id="t1", column="missing")],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_COLUMN_NOT_FOUND
        assert result.errors[0].field == "order_by[0].column"


class TestInvalidJoin:
    """Tests for INVALID_JOIN errors."""

    def test_invalid_from_column(self, sample_schema: DatabaseSchema) -> None:
        """Invalid from_column produces INVALID_JOIN error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[ColumnSelection(table_id="t1", column="id")],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="missing",
                    to_table_id="t2",
                    to_column="user_id",
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_INVALID_JOIN
        assert result.errors[0].field == "joins[0].from_column"

    def test_invalid_to_column(self, sample_schema: DatabaseSchema) -> None:
        """Invalid to_column produces INVALID_JOIN error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[ColumnSelection(table_id="t1", column="id")],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="id",
                    to_table_id="t2",
                    to_column="missing",
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_INVALID_JOIN
        assert result.errors[0].field == "joins[0].to_column"


class TestTypeMismatch:
    """Tests for TYPE_MISMATCH errors."""

    def test_numeric_column_string_value(self, sample_schema: DatabaseSchema) -> None:
        """Numeric column with string value produces TYPE_MISMATCH."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="id", operator=FilterOperator.EQ, value="not_a_number"
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_TYPE_MISMATCH

    def test_in_operator_requires_list(self, sample_schema: DatabaseSchema) -> None:
        """IN operator requires list value."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(table_id="t1", column="id", operator=FilterOperator.IN, value=1)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_TYPE_MISMATCH
        assert "list" in result.errors[0].message.lower()

    def test_between_operator_requires_two_values(self, sample_schema: DatabaseSchema) -> None:
        """BETWEEN operator requires exactly 2 values."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(
                    table_id="t1", column="id", operator=FilterOperator.BETWEEN, value=[1]
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_TYPE_MISMATCH

    def test_valid_numeric_filter(self, sample_schema: DatabaseSchema) -> None:
        """Valid numeric filter passes."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(table_id="t1", column="id", operator=FilterOperator.EQ, value=42)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is True


class TestInvalidAggregation:
    """Tests for INVALID_AGGREGATION errors."""

    def test_sum_on_string_column(self, sample_schema: DatabaseSchema) -> None:
        """SUM on string column produces INVALID_AGGREGATION."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="email", aggregation=AggregationType.SUM)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_INVALID_AGGREGATION
        assert result.errors[0].suggestion is not None

    def test_avg_on_string_column(self, sample_schema: DatabaseSchema) -> None:
        """AVG on string column produces INVALID_AGGREGATION."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="name", aggregation=AggregationType.AVG)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert result.errors[0].code == ERROR_INVALID_AGGREGATION

    def test_sum_on_numeric_column(self, sample_schema: DatabaseSchema) -> None:
        """SUM on numeric column is valid."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="orders")],
            columns=[
                ColumnSelection(table_id="t1", column="total", aggregation=AggregationType.SUM)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is True

    def test_count_on_any_column(self, sample_schema: DatabaseSchema) -> None:
        """COUNT is valid on any column."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="email", aggregation=AggregationType.COUNT)
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is True


class TestCircularJoin:
    """Tests for CIRCULAR_JOIN errors."""

    def test_self_join_detected(self, sample_schema: DatabaseSchema) -> None:
        """Self-join produces CIRCULAR_JOIN error."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="id",
                    to_table_id="t1",  # Same table
                    to_column="id",
                )
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        assert any(e.code == ERROR_CIRCULAR_JOIN for e in result.errors)


class TestMultipleErrors:
    """Tests for collecting multiple errors."""

    def test_collects_all_errors(self, sample_schema: DatabaseSchema) -> None:
        """Multiple errors are all collected."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="missing_table1"),
                QueryTable(id="t2", name="missing_table2"),
            ],
            columns=[
                ColumnSelection(table_id="t1", column="col1"),
                ColumnSelection(table_id="t2", column="col2"),
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        # Should have 2 TABLE_NOT_FOUND errors (not 2 - columns aren't validated if table doesn't exist)
        table_errors = [e for e in result.errors if e.code == ERROR_TABLE_NOT_FOUND]
        assert len(table_errors) == 2

    def test_mixed_error_types(self, sample_schema: DatabaseSchema) -> None:
        """Different error types are all collected."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="nonexistent"),
            ],
            columns=[
                ColumnSelection(table_id="t1", column="missing_col"),
            ],
        )

        result = builder.validate_detailed(query)
        assert result.valid is False
        error_codes = {e.code for e in result.errors}
        assert ERROR_TABLE_NOT_FOUND in error_codes
        assert ERROR_COLUMN_NOT_FOUND in error_codes


class TestBackwardCompatibility:
    """Tests for backward compatibility with validate() method."""

    def test_validate_returns_strings(self, sample_schema: DatabaseSchema) -> None:
        """validate() returns list of strings."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="nonexistent")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        errors = builder.validate(query)
        assert isinstance(errors, list)
        assert len(errors) == 1
        assert isinstance(errors[0], str)
        assert "nonexistent" in errors[0]

    def test_validate_empty_on_valid_query(self, sample_schema: DatabaseSchema) -> None:
        """validate() returns empty list for valid query."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
        )

        errors = builder.validate(query)
        assert errors == []


class TestFieldPaths:
    """Tests for field path accuracy."""

    def test_column_field_paths(self, sample_schema: DatabaseSchema) -> None:
        """Column errors have correct field paths."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="id"),
                ColumnSelection(table_id="t1", column="missing"),
            ],
        )

        result = builder.validate_detailed(query)
        assert result.errors[0].field == "columns[1].column"

    def test_filter_field_paths(self, sample_schema: DatabaseSchema) -> None:
        """Filter errors have correct field paths."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="id")],
            filters=[
                FilterDefinition(table_id="t1", column="id", operator=FilterOperator.EQ, value=1),
                FilterDefinition(
                    table_id="t1", column="missing", operator=FilterOperator.EQ, value=1
                ),
            ],
        )

        result = builder.validate_detailed(query)
        assert result.errors[0].field == "filters[1].column"

    def test_join_field_paths(self, sample_schema: DatabaseSchema) -> None:
        """Join errors have correct field paths."""
        builder = QueryBuilder(sample_schema)
        query = QueryDefinition(
            tables=[
                QueryTable(id="t1", name="users"),
                QueryTable(id="t2", name="orders"),
            ],
            columns=[ColumnSelection(table_id="t1", column="id")],
            joins=[
                JoinDefinition(
                    from_table_id="t1",
                    from_column="id",
                    to_table_id="t2",
                    to_column="user_id",
                ),
                JoinDefinition(
                    from_table_id="t1",
                    from_column="missing",
                    to_table_id="t2",
                    to_column="user_id",
                ),
            ],
        )

        result = builder.validate_detailed(query)
        assert result.errors[0].field == "joins[1].from_column"
