---
name: analytics-patterns
description: Use when implementing query builders, SQL generation, schema introspection, or visualization components for Prismiq. Contains reference patterns and data structures.
---

# Prismiq Analytics Patterns

## Core Data Structures

### Query Definition Schema

The central data structure representing a visual query:

```python
# Python
class QueryTable(BaseModel):
    id: str                    # Unique ID for this table instance
    name: str                  # Actual table name in database
    alias: str | None = None   # Optional alias

class JoinDefinition(BaseModel):
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    join_type: Literal["inner", "left", "right"] = "left"

class AggregationType(str, Enum):
    NONE = "none"
    SUM = "sum"
    AVG = "avg"
    COUNT = "count"
    COUNT_DISTINCT = "count_distinct"
    MIN = "min"
    MAX = "max"

class ColumnSelection(BaseModel):
    table_id: str
    column: str
    aggregation: AggregationType = AggregationType.NONE
    alias: str | None = None

class FilterOperator(str, Enum):
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

class FilterDefinition(BaseModel):
    table_id: str
    column: str
    operator: FilterOperator
    value: Any

class SortDefinition(BaseModel):
    table_id: str
    column: str
    direction: Literal["asc", "desc"] = "asc"

class QueryDefinition(BaseModel):
    tables: list[QueryTable]
    joins: list[JoinDefinition] = []
    columns: list[ColumnSelection]
    filters: list[FilterDefinition] = []
    group_by: list[dict] | None = None  # Auto-derived if aggregations present
    order_by: list[SortDefinition] = []
    limit: int = 10000
    offset: int = 0
```

### Query Result Schema

```python
class QueryResult(BaseModel):
    columns: list[str]           # Column names/aliases
    column_types: list[str]      # PostgreSQL data types
    rows: list[list[Any]]        # Row data
    row_count: int
    truncated: bool              # True if limit was hit
    execution_time_ms: float
```

## Schema Introspection Queries

### Get Tables
```sql
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Get Columns
```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = $1 
  AND table_name = $2
ORDER BY ordinal_position;
```

### Get Primary Keys
```sql
SELECT kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = $1
    AND tc.table_name = $2;
```

### Get Foreign Keys
```sql
SELECT
    kcu.column_name,
    ccu.table_name AS foreign_table,
    ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = $1
    AND tc.table_name = $2;
```

## SQL Generation Patterns

### Identifier Quoting
Always quote identifiers to handle reserved words:
```python
def quote_identifier(name: str) -> str:
    return f'"{name}"'

# Usage
table_ref = f'{quote_identifier(schema)}.{quote_identifier(table)}'
```

### Aggregation Wrapping
```python
def wrap_aggregation(column_ref: str, agg: AggregationType) -> str:
    if agg == AggregationType.NONE:
        return column_ref
    if agg == AggregationType.COUNT_DISTINCT:
        return f"COUNT(DISTINCT {column_ref})"
    return f"{agg.value.upper()}({column_ref})"
```

### Filter Operators to SQL
```python
OPERATOR_MAP = {
    FilterOperator.EQ: "=",
    FilterOperator.NEQ: "!=",
    FilterOperator.GT: ">",
    FilterOperator.GTE: ">=",
    FilterOperator.LT: "<",
    FilterOperator.LTE: "<=",
    FilterOperator.LIKE: "LIKE",
    FilterOperator.ILIKE: "ILIKE",
}

def build_filter(filter: FilterDefinition, param_index: int) -> tuple[str, Any]:
    col = f'"{filter.table_id}"."{filter.column}"'
    
    if filter.operator == FilterOperator.IS_NULL:
        return f"{col} IS NULL", None
    if filter.operator == FilterOperator.IS_NOT_NULL:
        return f"{col} IS NOT NULL", None
    if filter.operator == FilterOperator.IN:
        return f"{col} = ANY(${param_index})", filter.value
    if filter.operator == FilterOperator.BETWEEN:
        return f"{col} BETWEEN ${param_index} AND ${param_index + 1}", filter.value
    
    op = OPERATOR_MAP[filter.operator]
    return f"{col} {op} ${param_index}", filter.value
```

### Auto Group By
```python
def derive_group_by(columns: list[ColumnSelection]) -> list[ColumnSelection]:
    """Non-aggregated columns must be in GROUP BY."""
    has_aggregation = any(c.aggregation != AggregationType.NONE for c in columns)
    if not has_aggregation:
        return []
    return [c for c in columns if c.aggregation == AggregationType.NONE]
```

## React Component Patterns

### Query Builder State
```typescript
interface QueryBuilderState {
  tables: QueryTable[];
  joins: JoinDefinition[];
  columns: ColumnSelection[];
  filters: FilterDefinition[];
  orderBy: SortDefinition[];
}

type QueryAction =
  | { type: 'ADD_TABLE'; table: QueryTable }
  | { type: 'REMOVE_TABLE'; tableId: string }
  | { type: 'ADD_JOIN'; join: JoinDefinition }
  | { type: 'ADD_COLUMN'; column: ColumnSelection }
  | { type: 'ADD_FILTER'; filter: FilterDefinition }
  | { type: 'SET_ORDER'; orderBy: SortDefinition[] };

function queryReducer(state: QueryBuilderState, action: QueryAction): QueryBuilderState {
  switch (action.type) {
    case 'ADD_TABLE':
      return { ...state, tables: [...state.tables, action.table] };
    // ... other cases
  }
}
```

### Chart Type Selection
```typescript
function suggestChartType(columns: ColumnSelection[], data: QueryResult): ChartType {
  const hasTimeSeries = columns.some(c => 
    ['date', 'timestamp', 'timestamptz'].includes(getColumnType(c, data))
  );
  const numericCount = columns.filter(c => 
    c.aggregation !== 'none' || isNumericType(getColumnType(c, data))
  ).length;
  const categoricalCount = columns.length - numericCount;

  if (hasTimeSeries && numericCount >= 1) return 'line';
  if (categoricalCount === 1 && numericCount === 1) return 'bar';
  if (categoricalCount === 1 && numericCount === 1 && data.row_count <= 10) return 'pie';
  if (numericCount >= 2) return 'scatter';
  
  return 'table';
}
```

## Performance Guidelines

1. **Always apply LIMIT** — Max 10,000 rows for charts
2. **Use connection pooling** — asyncpg pool with 20-50 connections
3. **Cache schema metadata** — TTL of 5-10 minutes
4. **Query timeout** — 30 second hard limit
5. **Result caching** — Redis with query hash as key, 5-min TTL
