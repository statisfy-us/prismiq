"""Prismiq type definitions.

This module contains all Pydantic models and custom exceptions for the
Prismiq embedded analytics platform.
"""

from __future__ import annotations

from enum import Enum
from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

if TYPE_CHECKING:
    pass

# ============================================================================
# Schema Types - Database metadata models
# ============================================================================


class ColumnSchema(BaseModel):
    """Schema information for a single database column."""

    model_config = ConfigDict()

    name: str
    """Column name."""

    data_type: str
    """PostgreSQL data type (e.g., 'integer', 'character varying')."""

    is_nullable: bool
    """Whether the column allows NULL values."""

    is_primary_key: bool = False
    """Whether this column is part of the primary key."""

    default_value: str | None = None
    """Default value expression, if any."""


class TableSchema(BaseModel):
    """Schema information for a database table."""

    model_config = ConfigDict()

    name: str
    """Table name."""

    schema_name: str = "public"
    """Database schema (namespace) containing the table."""

    columns: list[ColumnSchema]
    """List of columns in the table."""

    row_count: int | None = None
    """Approximate row count (from pg_class.reltuples). None if not fetched."""

    def get_column(self, column_name: str) -> ColumnSchema | None:
        """Get a column by name, or None if not found."""
        for col in self.columns:
            if col.name == column_name:
                return col
        return None

    def has_column(self, column_name: str) -> bool:
        """Check if the table has a column with the given name."""
        return self.get_column(column_name) is not None


class Relationship(BaseModel):
    """Foreign key relationship between two tables."""

    model_config = ConfigDict()

    from_table: str
    """Name of the table containing the foreign key."""

    from_column: str
    """Column name in the from_table."""

    to_table: str
    """Name of the referenced table."""

    to_column: str
    """Column name in the to_table (usually primary key)."""


class DatabaseSchema(BaseModel):
    """Complete schema for an exposed database."""

    model_config = ConfigDict()

    tables: list[TableSchema]
    """List of exposed tables."""

    relationships: list[Relationship]
    """Foreign key relationships between tables."""

    def get_table(self, table_name: str) -> TableSchema | None:
        """Get a table by name, or None if not found."""
        for table in self.tables:
            if table.name == table_name:
                return table
        return None

    def has_table(self, table_name: str) -> bool:
        """Check if the schema contains a table with the given name."""
        return self.get_table(table_name) is not None

    def table_names(self) -> list[str]:
        """Get list of all table names."""
        return [t.name for t in self.tables]


# ============================================================================
# Query Types - Query definition models
# ============================================================================


class QueryTable(BaseModel):
    """A table reference in a query."""

    model_config = ConfigDict()

    id: str
    """Unique identifier for this table in the query (e.g., 't1', 't2')."""

    name: str
    """Actual table name in the database."""

    alias: str | None = None
    """Optional alias for the table in the query."""


class JoinType(str, Enum):
    """SQL join types."""

    INNER = "INNER"
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    FULL = "FULL"


class JoinDefinition(BaseModel):
    """Definition of a join between two tables."""

    model_config = ConfigDict()

    from_table_id: str
    """ID of the left table in the join."""

    from_column: str
    """Column name in the left table."""

    to_table_id: str
    """ID of the right table in the join."""

    to_column: str
    """Column name in the right table."""

    join_type: JoinType = JoinType.INNER
    """Type of join to perform."""


class AggregationType(str, Enum):
    """SQL aggregation functions."""

    NONE = "none"
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    COUNT_DISTINCT = "count_distinct"
    MIN = "min"
    MAX = "max"


class ColumnSelection(BaseModel):
    """A column to select in a query."""

    model_config = ConfigDict()

    table_id: str
    """ID of the table containing the column."""

    column: str
    """Column name."""

    aggregation: AggregationType = AggregationType.NONE
    """Aggregation function to apply."""

    alias: str | None = None
    """Optional alias for the result column."""

    date_trunc: str | None = None
    """Date truncation unit (e.g., 'year', 'month', 'day') for date columns."""

    date_format: str | None = None
    """Date format string for display (e.g., 'MMM-yyyy')."""

    sql_expression: str | None = None
    """
    Pre-computed SQL expression for calculated fields.
    When provided, this is used directly instead of looking up the column.
    """


class FilterOperator(str, Enum):
    """SQL filter operators.

    SECURITY NOTE for IN_SUBQUERY:
    The IN_SUBQUERY operator interpolates SQL directly without parameterization.
    This is by design since subqueries cannot be parameterized. Callers MUST
    ensure the SQL is generated from trusted internal code (e.g., RLS rules),
    never from user input. The SQL should reference only allowed tables/schemas.
    """

    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in_"
    NOT_IN = "not_in"
    LIKE = "like"
    ILIKE = "ilike"
    BETWEEN = "between"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"
    IN_SUBQUERY = "in_subquery"


class FilterDefinition(BaseModel):
    """A filter condition in a query."""

    model_config = ConfigDict()

    table_id: str
    """ID of the table containing the column to filter."""

    column: str
    """Column name to filter on."""

    operator: FilterOperator
    """Filter operator."""

    value: Any = None
    """
    Value(s) for the filter.
    - Single value for eq, neq, gt, gte, lt, lte, like, ilike
    - List for in_, not_in
    - Tuple of (min, max) for between
    - None for is_null, is_not_null
    - Dict with 'sql' key for in_subquery: {"sql": "SELECT id FROM ..."}
      SECURITY: The SQL is interpolated directly. Must be from trusted code only.
    """

    sql_expression: str | None = None
    """
    Pre-computed SQL expression for calculated fields.
    When provided, this is used directly instead of looking up the column.
    """


class SortDirection(str, Enum):
    """SQL sort directions."""

    ASC = "ASC"
    DESC = "DESC"


class SortDefinition(BaseModel):
    """A sort order definition."""

    model_config = ConfigDict()

    table_id: str
    """ID of the table containing the column to sort by."""

    column: str
    """Column name to sort by."""

    direction: SortDirection = SortDirection.ASC
    """Sort direction."""


class GroupByDefinition(BaseModel):
    """A group by column definition."""

    model_config = ConfigDict()

    table_id: str
    """ID of the table containing the column."""

    column: str
    """Column name to group by."""


class CalculatedField(BaseModel):
    """A calculated field definition with an expression.

    Calculated fields allow defining computed columns using expressions
    that can reference other columns and calculated fields.
    """

    model_config = ConfigDict()

    name: str
    """Name of the calculated field."""

    expression: str
    """
    Expression defining the calculation.
    Uses a SQL-like expression language with functions like:
    - if(condition, true_val, false_val)
    - sum(expr), avg(expr), count(expr)
    - year(date), month(date), today()
    - Field references: [field_name]
    """

    sql_expression: str | None = None
    """
    Pre-computed SQL expression with all field references resolved.
    When provided, this is used directly instead of parsing `expression`.
    This allows the caller to handle inter-field dependency resolution.

    IMPORTANT: This is an internal field for SQL generation. The SQL should:
    - Have all column references fully qualified (e.g., "table"."column")
    - Have all inter-field dependencies already resolved
    - Be valid PostgreSQL syntax
    """

    has_internal_aggregation: bool = False
    """
    Whether this calculated field's expression contains aggregation functions.
    When True, this field should NOT be included in GROUP BY clauses.
    The caller (e.g., converter) should set this based on expression analysis.
    """

    data_type: str = "number"
    """Data type of the result: 'number', 'string', 'date', 'boolean'."""


class TimeSeriesConfig(BaseModel):
    """Configuration for time series queries.

    When provided in a QueryDefinition, the query will automatically
    bucket dates using PostgreSQL's date_trunc function.
    """

    model_config = ConfigDict()

    table_id: str
    """ID of the table containing the date column."""

    date_column: str
    """Name of the date/timestamp column to bucket."""

    interval: str
    """Time interval for bucketing (minute, hour, day, week, month, quarter, year)."""

    fill_missing: bool = True
    """Whether to fill missing time buckets with default values."""

    fill_value: Any = 0
    """Value to use for missing time buckets."""

    alias: str | None = None
    """Optional alias for the date bucket column."""

    @field_validator("interval")
    @classmethod
    def validate_interval(cls, v: str) -> str:
        """Validate that interval is a valid TimeInterval value."""
        valid_intervals = {"minute", "hour", "day", "week", "month", "quarter", "year"}
        if v.lower() not in valid_intervals:
            raise ValueError(
                f"Invalid interval '{v}'. Must be one of: {', '.join(valid_intervals)}"
            )
        return v.lower()


class QueryDefinition(BaseModel):
    """Complete query definition."""

    model_config = ConfigDict()

    tables: list[QueryTable]
    """Tables used in the query."""

    joins: list[JoinDefinition] = []
    """Join definitions between tables."""

    columns: list[ColumnSelection]
    """Columns to select."""

    filters: list[FilterDefinition] = []
    """Filter conditions."""

    group_by: list[GroupByDefinition] = []
    """
    Explicit group by columns.
    If empty and aggregations are present, will be auto-derived.
    """

    order_by: list[SortDefinition] = []
    """Sort order."""

    limit: int | None = None
    """Maximum number of rows to return."""

    offset: int | None = None
    """Number of rows to skip."""

    time_series: TimeSeriesConfig | None = None
    """
    Optional time series configuration.
    When present, the query will bucket dates automatically.
    """

    calculated_fields: list[CalculatedField] = []
    """
    Calculated field definitions.
    These fields can be referenced in columns, filters, etc.
    """

    @field_validator("tables")
    @classmethod
    def validate_tables_not_empty(cls, v: list[QueryTable]) -> list[QueryTable]:
        """Ensure at least one table is specified."""
        if not v:
            raise ValueError("At least one table must be specified")
        return v

    @field_validator("columns")
    @classmethod
    def validate_columns_not_empty(cls, v: list[ColumnSelection]) -> list[ColumnSelection]:
        """Ensure at least one column is selected."""
        if not v:
            raise ValueError("At least one column must be selected")
        return v

    @model_validator(mode="after")
    def validate_table_references(self) -> QueryDefinition:
        """Validate that all table_id references point to defined tables."""
        table_ids = {t.id for t in self.tables}

        # Check joins
        for join in self.joins:
            if join.from_table_id not in table_ids:
                raise ValueError(f"Join references unknown table_id: {join.from_table_id}")
            if join.to_table_id not in table_ids:
                raise ValueError(f"Join references unknown table_id: {join.to_table_id}")

        # Check columns
        for col in self.columns:
            if col.table_id not in table_ids:
                raise ValueError(f"Column selection references unknown table_id: {col.table_id}")

        # Check filters
        for f in self.filters:
            if f.table_id not in table_ids:
                raise ValueError(f"Filter references unknown table_id: {f.table_id}")

        # Check group_by
        for g in self.group_by:
            if g.table_id not in table_ids:
                raise ValueError(f"Group by references unknown table_id: {g.table_id}")

        # Check order_by
        for o in self.order_by:
            if o.table_id not in table_ids:
                raise ValueError(f"Order by references unknown table_id: {o.table_id}")

        # Check time_series
        if self.time_series and self.time_series.table_id not in table_ids:
            raise ValueError(
                f"Time series references unknown table_id: {self.time_series.table_id}"
            )

        return self

    def get_table_by_id(self, table_id: str) -> QueryTable | None:
        """Get a QueryTable by its ID."""
        for t in self.tables:
            if t.id == table_id:
                return t
        return None

    def has_aggregations(self) -> bool:
        """Check if any column has an aggregation."""
        return any(col.aggregation != AggregationType.NONE for col in self.columns)

    def get_non_aggregated_columns(self) -> list[ColumnSelection]:
        """Get columns that don't have aggregations applied."""
        return [col for col in self.columns if col.aggregation == AggregationType.NONE]

    def derive_group_by(self) -> list[GroupByDefinition]:
        """Auto-derive GROUP BY from non-aggregated columns.

        When aggregations are present but group_by is empty, all non-
        aggregated columns should be in GROUP BY.
        """
        if not self.has_aggregations():
            return []

        if self.group_by:
            # Explicit group_by provided
            return self.group_by

        # Auto-derive from non-aggregated columns
        return [
            GroupByDefinition(table_id=col.table_id, column=col.column)
            for col in self.get_non_aggregated_columns()
        ]


# ============================================================================
# Result Types
# ============================================================================


class QueryResult(BaseModel):
    """Result of executing a query."""

    model_config = ConfigDict()

    columns: list[str]
    """Column names in the result."""

    column_types: list[str]
    """PostgreSQL data types for each column."""

    rows: list[list[Any]]
    """Result rows as a list of lists."""

    row_count: int
    """Number of rows returned."""

    truncated: bool = False
    """Whether the result was truncated due to row limit."""

    execution_time_ms: float
    """Query execution time in milliseconds."""


# ============================================================================
# Saved Query Types
# ============================================================================


class SavedQuery(BaseModel):
    """A saved query for reuse across dashboards."""

    model_config = ConfigDict()

    id: str
    """Unique identifier for the saved query."""

    name: str
    """Display name for the saved query."""

    description: str | None = None
    """Optional description of what the query does."""

    query: QueryDefinition
    """The query definition."""

    tenant_id: str
    """Tenant that owns this saved query."""

    owner_id: str | None = None
    """User who created this query (None for shared queries)."""

    is_shared: bool = False
    """Whether the query is shared with all users in the tenant."""

    created_at: str | None = None
    """ISO timestamp when the query was created."""

    updated_at: str | None = None
    """ISO timestamp when the query was last updated."""


class SavedQueryCreate(BaseModel):
    """Data for creating a saved query."""

    model_config = ConfigDict()

    name: str
    """Display name for the saved query."""

    description: str | None = None
    """Optional description of what the query does."""

    query: QueryDefinition
    """The query definition to save."""

    is_shared: bool = False
    """Whether to share the query with all users in the tenant."""


class SavedQueryUpdate(BaseModel):
    """Data for updating a saved query."""

    model_config = ConfigDict()

    name: str | None = None
    """New display name."""

    description: str | None = None
    """New description."""

    query: QueryDefinition | None = None
    """Updated query definition."""

    is_shared: bool | None = None
    """Whether to share the query."""


# ============================================================================
# Exception Types
# ============================================================================


class PrismiqError(Exception):
    """Base exception for all Prismiq errors."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class QueryValidationError(PrismiqError):
    """Raised when a query fails validation."""

    def __init__(self, message: str, errors: list[str] | None = None) -> None:
        super().__init__(message)
        self.errors = errors or []


class QueryTimeoutError(PrismiqError):
    """Raised when a query exceeds the timeout limit."""

    def __init__(self, message: str, timeout_seconds: float) -> None:
        super().__init__(message)
        self.timeout_seconds = timeout_seconds


class QueryExecutionError(PrismiqError):
    """Raised when query execution fails."""

    def __init__(self, message: str, sql: str | None = None) -> None:
        super().__init__(message)
        self.sql = sql


class TableNotFoundError(PrismiqError):
    """Raised when a requested table is not found or not exposed."""

    def __init__(self, table_name: str) -> None:
        super().__init__(f"Table not found: {table_name}")
        self.table_name = table_name
