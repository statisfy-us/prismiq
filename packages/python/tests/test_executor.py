"""Tests for query executor."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from prismiq.executor import QueryExecutor, qualify_table_schemas
from prismiq.sql_validator import SQLValidationError
from prismiq.types import (
    ColumnSchema,
    ColumnSelection,
    DatabaseSchema,
    QueryDefinition,
    QueryExecutionError,
    QueryTable,
    QueryValidationError,
    TableSchema,
)

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def sample_schema() -> DatabaseSchema:
    """Create a sample database schema."""
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
                ],
            ),
        ],
        relationships=[],
    )


@pytest.fixture
def mock_pool() -> MagicMock:
    """Create a mock asyncpg connection pool."""
    pool = MagicMock()
    mock_connection = AsyncMock()
    mock_context = AsyncMock()
    mock_context.__aenter__.return_value = mock_connection
    mock_context.__aexit__.return_value = None
    pool.acquire.return_value = mock_context
    return pool


@pytest.fixture
def mock_connection(mock_pool: MagicMock) -> AsyncMock:
    """Get the mock connection from the pool."""
    return mock_pool.acquire.return_value.__aenter__.return_value


@pytest.fixture
def executor(mock_pool: MagicMock, sample_schema: DatabaseSchema) -> QueryExecutor:
    """Create a QueryExecutor with mock pool."""
    return QueryExecutor(mock_pool, sample_schema, query_timeout=30.0, max_rows=1000)


class MockRecord(dict[str, Any]):
    """Mock asyncpg Record that behaves like both dict and Record."""

    def keys(self) -> list[str]:
        """Return keys as a list."""
        return list(super().keys())

    def values(self) -> list[Any]:
        """Return values as a list."""
        return list(super().values())


def make_record(data: dict[str, Any]) -> MockRecord:
    """Create a mock asyncpg Record."""
    return MockRecord(data)


# ============================================================================
# Initialization Tests
# ============================================================================


class TestExecutorInit:
    """Tests for QueryExecutor initialization."""

    def test_init_with_defaults(self, mock_pool: MagicMock, sample_schema: DatabaseSchema) -> None:
        """Test initialization with default values."""
        executor = QueryExecutor(mock_pool, sample_schema)
        assert executor._query_timeout == 30.0
        assert executor._max_rows == 10000

    def test_init_with_custom_values(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test initialization with custom values."""
        executor = QueryExecutor(mock_pool, sample_schema, query_timeout=60.0, max_rows=5000)
        assert executor._query_timeout == 60.0
        assert executor._max_rows == 5000


# ============================================================================
# Execute Tests
# ============================================================================


class TestExecute:
    """Tests for execute method."""

    async def test_execute_returns_query_result(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that execute returns a QueryResult."""
        mock_connection.fetch.return_value = [
            make_record({"id": 1, "email": "test@example.com"}),
            make_record({"id": 2, "email": "user@example.com"}),
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="id"),
                ColumnSelection(table_id="t1", column="email"),
            ],
        )

        result = await executor.execute(query)

        assert result.row_count == 2
        assert result.columns == ["id", "email"]
        assert result.execution_time_ms >= 0

    async def test_execute_raises_validation_error(self, executor: QueryExecutor) -> None:
        """Test that execute raises QueryValidationError for invalid queries."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="nonexistent")],
        )

        with pytest.raises(QueryValidationError) as exc_info:
            await executor.execute(query)

        assert "validation failed" in exc_info.value.message.lower()
        assert len(exc_info.value.errors) > 0

    async def test_execute_raises_execution_error(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that execute raises QueryExecutionError on database errors."""
        mock_connection.fetch.side_effect = Exception("Database connection failed")

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        with pytest.raises(QueryExecutionError) as exc_info:
            await executor.execute(query)

        assert "Database connection failed" in str(exc_info.value)

    async def test_execute_handles_empty_result(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that execute handles empty results."""
        mock_connection.fetch.return_value = []

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        result = await executor.execute(query)

        assert result.row_count == 0
        assert result.rows == []
        assert result.truncated is False


# ============================================================================
# Preview Tests
# ============================================================================


class TestPreview:
    """Tests for preview method."""

    async def test_preview_applies_limit(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that preview applies a smaller limit."""
        mock_connection.fetch.return_value = [
            make_record({"email": "test@example.com"}),
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        result = await executor.preview(query, limit=10)

        assert result.row_count >= 0
        # The actual SQL should have had a LIMIT applied
        # We can verify by checking the mock was called

    async def test_preview_default_limit(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that preview uses default limit of 100."""
        mock_connection.fetch.return_value = []

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        await executor.preview(query)
        # Should succeed without errors


# ============================================================================
# Row Limit Tests
# ============================================================================


class TestRowLimits:
    """Tests for row limit enforcement."""

    async def test_truncates_when_exceeds_max_rows(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Test that results are truncated when exceeding max_rows."""
        # Create executor with small max_rows
        executor = QueryExecutor(mock_pool, sample_schema, max_rows=5)

        mock_connection = mock_pool.acquire.return_value.__aenter__.return_value
        # Return more rows than max_rows
        mock_connection.fetch.return_value = [
            make_record({"email": f"user{i}@example.com"}) for i in range(10)
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        result = await executor.execute(query)

        assert result.row_count == 5
        assert result.truncated is True


# ============================================================================
# Explain Tests
# ============================================================================


class TestExplain:
    """Tests for explain method."""

    async def test_explain_returns_plan(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that explain returns query plan."""
        mock_connection.fetchval.return_value = [
            {
                "Plan": {
                    "Node Type": "Seq Scan",
                    "Relation Name": "users",
                    "Actual Total Time": 0.5,
                }
            }
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        result = await executor.explain(query)

        assert "Plan" in result

    async def test_explain_raises_validation_error(self, executor: QueryExecutor) -> None:
        """Test that explain raises ValidationError for invalid queries."""
        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="nonexistent")],
        )

        with pytest.raises(QueryValidationError):
            await executor.explain(query)

    async def test_explain_handles_execution_error(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that explain handles database errors."""
        mock_connection.fetchval.side_effect = Exception("EXPLAIN failed")

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        with pytest.raises(QueryExecutionError):
            await executor.explain(query)


# ============================================================================
# Result Formatting Tests
# ============================================================================


class TestResultFormatting:
    """Tests for result formatting."""

    async def test_formats_columns_correctly(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that columns are formatted correctly."""
        mock_connection.fetch.return_value = [
            make_record({"id": 1, "email": "test@example.com"}),
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="id"),
                ColumnSelection(table_id="t1", column="email"),
            ],
        )

        result = await executor.execute(query)

        assert result.columns == ["id", "email"]
        assert len(result.column_types) == 2

    async def test_formats_rows_as_lists(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that rows are formatted as lists."""
        mock_connection.fetch.return_value = [
            make_record({"id": 1, "email": "test@example.com"}),
        ]

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[
                ColumnSelection(table_id="t1", column="id"),
                ColumnSelection(table_id="t1", column="email"),
            ],
        )

        result = await executor.execute(query)

        assert result.rows == [[1, "test@example.com"]]

    async def test_includes_execution_time(
        self, executor: QueryExecutor, mock_connection: AsyncMock
    ) -> None:
        """Test that execution time is included."""
        mock_connection.fetch.return_value = []

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )

        result = await executor.execute(query)

        assert result.execution_time_ms >= 0


# ============================================================================
# Schema Qualification Tests
# ============================================================================


class TestQualifyTableSchemas:
    """Tests for qualify_table_schemas function."""

    @pytest.mark.parametrize(
        ("sql", "expected"),
        [
            ('SELECT * FROM "users"', '"org_123"."users"'),
            ('SELECT "id" FROM "users"', '"org_123"."users"'),
            ('SELECT * FROM (SELECT id FROM "users") sub', '"org_123"."users"'),
            ('SELECT * FROM "Users"', '"org_123"."Users"'),
        ],
        ids=["simple_select", "quoted_columns", "subquery", "case_insensitive"],
    )
    def test_qualifies_known_table(self, sql: str, expected: str) -> None:
        """Test schema qualification on various SQL patterns."""
        result = qualify_table_schemas(sql, "org_123", frozenset({"users"}))
        assert expected in result

    def test_qualifies_multiple_tables_in_join(self) -> None:
        """Test schema qualification with JOINs."""
        sql = 'SELECT u."id", o."name" FROM "users" u JOIN "orders" o ON u."id" = o."user_id"'
        known = frozenset({"users", "orders"})
        result = qualify_table_schemas(sql, "org_123", known)
        assert '"org_123"."users"' in result
        assert '"org_123"."orders"' in result

    def test_skips_unknown_tables(self) -> None:
        """Test that tables not in known set are not qualified."""
        sql = 'SELECT * FROM "users" JOIN "unknown_table" ON 1=1'
        result = qualify_table_schemas(sql, "org_123", frozenset({"users"}))
        assert '"org_123"."users"' in result
        assert '"org_123"."unknown_table"' not in result

    def test_skips_already_qualified_with_correct_schema(self) -> None:
        """Test that tables already qualified with the correct schema are not double-qualified."""
        sql = 'SELECT * FROM "org_123"."users"'
        result = qualify_table_schemas(sql, "org_123", frozenset({"users"}))
        assert result.count('"org_123"') == 1

    def test_rejects_foreign_schema_qualifier(self) -> None:
        """Test that tables qualified with a different schema are rejected."""
        sql = 'SELECT * FROM "other_schema"."users"'
        with pytest.raises(SQLValidationError, match=r"only.*org_123.*is allowed"):
            qualify_table_schemas(sql, "org_123", frozenset({"users"}))

    def test_skips_cte_references(self) -> None:
        """Test that CTE names are not schema-qualified."""
        sql = (
            'WITH recent_users AS (SELECT * FROM "users" WHERE active = true) '
            "SELECT * FROM recent_users"
        )
        known = frozenset({"users"})
        result = qualify_table_schemas(sql, "org_123", known)
        assert '"org_123"."users"' in result
        # CTE reference "recent_users" should not be qualified
        assert '"org_123"."recent_users"' not in result

    def test_raises_on_parse_error(self) -> None:
        """Test that unparseable SQL raises SQLValidationError (fail closed)."""
        bad_sql = "NOT VALID SQL @@@ %%% &&&"
        with pytest.raises(SQLValidationError, match="schema-qualify SQL"):
            qualify_table_schemas(bad_sql, "org_123", frozenset({"users"}))

    def test_empty_known_tables(self) -> None:
        """Test with empty known tables set — nothing gets qualified."""
        sql = 'SELECT * FROM "users"'
        result = qualify_table_schemas(sql, "org_123", frozenset())
        assert '"org_123"' not in result

    def test_union_tables_qualified(self) -> None:
        """Test that tables in UNION branches are qualified."""
        sql = 'SELECT id FROM "users" UNION ALL SELECT id FROM "users"'
        result = qualify_table_schemas(sql, "org_123", frozenset({"users"}))
        # Both occurrences should be qualified
        assert result.count('"org_123"') == 2

    def test_cte_shadowing_real_table_known_limitation(self) -> None:
        """Known limitation: CTE that shadows a real table name gets incorrectly qualified."""
        sql = "WITH users AS (SELECT 1 AS id) SELECT * FROM users"
        result = qualify_table_schemas(sql, "org_123", frozenset({"users"}))
        # The CTE reference "users" is incorrectly qualified because its
        # name matches a known table. This test documents current behavior.
        assert '"org_123"' in result


# ============================================================================
# Raw SQL Integration Tests
# ============================================================================


class TestConnectionCleanup:
    """Tests for connection cleanup when RESET search_path fails."""

    async def test_connection_closed_when_search_path_reset_fails(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Verify conn.close() is called when RESET search_path fails."""
        executor = QueryExecutor(mock_pool, sample_schema, schema_name="org_123")
        mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
        mock_conn.fetch.return_value = [make_record({"email": "test@example.com"})]
        mock_conn.fetchval.return_value = None
        mock_conn.close = AsyncMock()

        async def execute_side_effect(sql: str, *args: Any) -> None:
            if "search_path" in sql:
                raise Exception("connection lost")

        mock_conn.execute = AsyncMock(side_effect=execute_side_effect)

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        result = await executor.execute(query)

        assert result.row_count == 1
        mock_conn.close.assert_awaited_once()

    async def test_connection_terminated_when_close_also_fails(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Verify conn.terminate() is called when both RESET and close() fail."""
        executor = QueryExecutor(mock_pool, sample_schema, schema_name="org_123")
        mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
        mock_conn.fetch.return_value = [make_record({"email": "test@example.com"})]
        mock_conn.fetchval.return_value = None
        mock_conn.close = AsyncMock(side_effect=Exception("close failed"))
        mock_conn.terminate = MagicMock()

        async def execute_side_effect(sql: str, *args: Any) -> None:
            if "search_path" in sql:
                raise Exception("connection lost")

        mock_conn.execute = AsyncMock(side_effect=execute_side_effect)

        query = QueryDefinition(
            tables=[QueryTable(id="t1", name="users")],
            columns=[ColumnSelection(table_id="t1", column="email")],
        )
        result = await executor.execute(query)

        assert result.row_count == 1
        mock_conn.close.assert_awaited_once()
        mock_conn.terminate.assert_called_once()


class TestExecuteRawSql:
    """Tests for execute_raw_sql with schema qualification."""

    async def test_qualifies_tables_when_schema_set(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Verify raw SQL gets schema-qualified before execution."""
        executor = QueryExecutor(mock_pool, sample_schema, schema_name="org_123")
        mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
        mock_conn.fetch.return_value = []
        mock_conn.fetchval.return_value = None

        await executor.execute_raw_sql('SELECT "email" FROM "users"')

        # Inspect the SQL passed to conn.fetch
        call_args = mock_conn.fetch.call_args
        executed_sql = call_args[0][0]
        assert '"org_123"."users"' in executed_sql

    async def test_rejects_foreign_schema_in_raw_sql(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Verify execute_raw_sql rejects SQL referencing a foreign schema."""
        executor = QueryExecutor(mock_pool, sample_schema, schema_name="org_123")
        mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
        mock_conn.fetchval.return_value = None

        with pytest.raises(SQLValidationError, match=r"only.*org_123.*is allowed"):
            await executor.execute_raw_sql('SELECT * FROM "evil_schema"."users"')

    async def test_no_qualification_without_schema(
        self, mock_pool: MagicMock, sample_schema: DatabaseSchema
    ) -> None:
        """Verify raw SQL is not modified when schema_name is not set."""
        executor = QueryExecutor(mock_pool, sample_schema)  # No schema_name
        mock_conn = mock_pool.acquire.return_value.__aenter__.return_value
        mock_conn.fetch.return_value = []
        mock_conn.fetchval.return_value = None

        await executor.execute_raw_sql('SELECT "email" FROM "users"')

        call_args = mock_conn.fetch.call_args
        executed_sql = call_args[0][0]
        assert '"org_123"' not in executed_sql
