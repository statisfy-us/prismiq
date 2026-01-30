# Types Reference

Complete TypeScript type definitions for `@prismiq/react`.

## Table of Contents

- [Schema Types](#schema-types)
- [Query Types](#query-types)
- [Result Types](#result-types)
- [Dashboard Types](#dashboard-types)
- [Widget Types](#widget-types)
- [Filter Types](#filter-types)
- [Pin Types](#pin-types)
- [Theme Types](#theme-types)

---

## Schema Types

### DatabaseSchema

Complete schema for an exposed database.

```typescript
interface DatabaseSchema {
  /** List of exposed tables */
  tables: TableSchema[];
  /** Foreign key relationships between tables */
  relationships: Relationship[];
}
```

### TableSchema

Schema information for a database table.

```typescript
interface TableSchema {
  /** Table name */
  name: string;
  /** Database schema (namespace) containing the table */
  schema_name: string;
  /** List of columns in the table */
  columns: ColumnSchema[];
  /** Approximate row count (from pg_class.reltuples) */
  row_count?: number;
}
```

### ColumnSchema

Schema information for a single database column.

```typescript
interface ColumnSchema {
  /** Column name */
  name: string;
  /** PostgreSQL data type (e.g., 'integer', 'character varying') */
  data_type: string;
  /** Whether the column allows NULL values */
  is_nullable: boolean;
  /** Whether this column is part of the primary key */
  is_primary_key: boolean;
  /** Default value expression, if any */
  default_value: string | null;
}
```

### Relationship

Foreign key relationship between two tables.

```typescript
interface Relationship {
  /** Name of the table containing the foreign key */
  from_table: string;
  /** Column name in the from_table */
  from_column: string;
  /** Name of the referenced table */
  to_table: string;
  /** Column name in the to_table (usually primary key) */
  to_column: string;
}
```

---

## Query Types

### QueryDefinition

Complete query definition.

```typescript
interface QueryDefinition {
  /** Tables used in the query */
  tables: QueryTable[];
  /** Join definitions between tables */
  joins?: JoinDefinition[];
  /** Columns to select */
  columns: ColumnSelection[];
  /** Filter conditions */
  filters?: FilterDefinition[];
  /** Explicit group by columns */
  group_by?: GroupByDefinition[];
  /** Sort order */
  order_by?: SortDefinition[];
  /** Maximum number of rows to return */
  limit?: number;
  /** Number of rows to skip */
  offset?: number;
  /** Calculated field definitions */
  calculated_fields?: CalculatedField[];
  /** Time series configuration for date bucketing */
  time_series?: TimeSeriesConfig;
}
```

### QueryTable

A table reference in a query.

```typescript
interface QueryTable {
  /** Unique identifier for this table in the query (e.g., 't1', 't2') */
  id: string;
  /** Actual table name in the database */
  name: string;
  /** Optional alias for the table in the query */
  alias?: string;
}
```

### JoinDefinition

Definition of a join between two tables.

```typescript
interface JoinDefinition {
  /** ID of the left table in the join */
  from_table_id: string;
  /** Column name in the left table */
  from_column: string;
  /** ID of the right table in the join */
  to_table_id: string;
  /** Column name in the right table */
  to_column: string;
  /** Type of join to perform */
  join_type: JoinType;
}

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
```

### ColumnSelection

A column to select in a query.

```typescript
interface ColumnSelection {
  /** ID of the table containing the column */
  table_id: string;
  /** Column name */
  column: string;
  /** Aggregation function to apply */
  aggregation: AggregationType;
  /** Optional alias for the result column */
  alias?: string;
  /** Date truncation unit for date/timestamp columns */
  date_trunc?: DateTruncInterval;
}

type AggregationType =
  | 'none'
  | 'sum'
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max';

type DateTruncInterval =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day';
```

### FilterDefinition

A filter condition in a query.

```typescript
interface FilterDefinition {
  /** ID of the table containing the column to filter */
  table_id: string;
  /** Column name to filter on */
  column: string;
  /** Filter operator */
  operator: FilterOperator;
  /** Value(s) for the filter */
  value?: unknown;
}

type FilterOperator =
  | 'eq'          // Equals
  | 'neq'         // Not equals
  | 'gt'          // Greater than
  | 'gte'         // Greater than or equal
  | 'lt'          // Less than
  | 'lte'         // Less than or equal
  | 'in_'         // In list
  | 'not_in'      // Not in list
  | 'in_or_null'  // In list or NULL
  | 'like'        // Pattern match (case sensitive)
  | 'ilike'       // Pattern match (case insensitive)
  | 'not_like'    // Pattern not match (case sensitive)
  | 'not_ilike'   // Pattern not match (case insensitive)
  | 'between'     // Between range
  | 'is_null'     // Is NULL
  | 'is_not_null';// Is not NULL
```

### SortDefinition

A sort order definition.

```typescript
interface SortDefinition {
  /** ID of the table containing the column to sort by */
  table_id: string;
  /** Column name to sort by */
  column: string;
  /** Sort direction */
  direction: SortDirection;
}

type SortDirection = 'ASC' | 'DESC';
```

### GroupByDefinition

A group by column definition.

```typescript
interface GroupByDefinition {
  /** ID of the table containing the column */
  table_id: string;
  /** Column name to group by */
  column: string;
}
```

### CalculatedField

A calculated field definition with an expression.

```typescript
interface CalculatedField {
  /** Name of the calculated field */
  name: string;
  /**
   * Expression defining the calculation.
   * Uses a SQL-like expression language with functions like:
   * - if(condition, true_val, false_val)
   * - sum(expr), avg(expr), count(expr)
   * - year(date), month(date), today()
   * - Field references: [field_name]
   */
  expression: string;
  /** Data type of the result: 'number', 'string', 'date', 'boolean' */
  data_type?: string;
}
```

### TimeSeriesConfig

Time series configuration for date-based charts.

```typescript
interface TimeSeriesConfig {
  /** ID of the table containing the date column */
  table_id: string;
  /** Column name of the date/timestamp field */
  date_column: string;
  /** Time bucket interval for grouping */
  interval: TimeSeriesInterval;
  /** Whether to fill missing time buckets with a default value */
  fill_missing?: boolean;
  /** Value to use when filling missing buckets (default: 0) */
  fill_value?: number;
  /** Optional alias for the bucketed date column */
  alias?: string;
}

type TimeSeriesInterval = 'year' | 'quarter' | 'month' | 'week' | 'day';
```

---

## Result Types

### QueryResult

Result of executing a query.

```typescript
interface QueryResult {
  /** Column names in the result */
  columns: string[];
  /** PostgreSQL data types for each column */
  column_types: string[];
  /** Result rows as a list of lists */
  rows: unknown[][];
  /** Number of rows returned */
  row_count: number;
  /** Whether the result was truncated due to row limit */
  truncated: boolean;
  /** Query execution time in milliseconds */
  execution_time_ms: number;
  /** Unix timestamp when result was cached */
  cached_at?: number;
  /** Whether this result came from cache */
  is_from_cache?: boolean;
}
```

### ValidationResult

Result of query validation.

```typescript
interface ValidationResult {
  /** Whether the query is valid */
  valid: boolean;
  /** List of validation errors, if any */
  errors: string[];
}
```

### SQLValidationResult

Result of SQL validation.

```typescript
interface SQLValidationResult {
  /** Whether the SQL is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: string[];
  /** List of tables referenced in the query */
  tables: string[];
}
```

---

## Dashboard Types

### Dashboard

A dashboard.

```typescript
interface Dashboard {
  /** Unique dashboard ID */
  id: string;
  /** Dashboard name */
  name: string;
  /** Dashboard description */
  description: string | null;
  /** Owner user ID */
  owner_id: string | null;
  /** Whether the dashboard is public */
  is_public: boolean;
  /** List of user IDs with view access */
  allowed_viewers: string[];
  /** Widgets on the dashboard */
  widgets: Widget[];
  /** Dashboard filters */
  filters: DashboardFilter[];
  /** Layout configuration */
  layout: DashboardLayout;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}
```

### DashboardCreate

Data for creating a new dashboard.

```typescript
interface DashboardCreate {
  /** Dashboard name */
  name: string;
  /** Dashboard description */
  description?: string;
  /** Layout configuration */
  layout?: DashboardLayout;
}
```

### DashboardUpdate

Data for updating a dashboard.

```typescript
interface DashboardUpdate {
  /** Dashboard name */
  name?: string;
  /** Dashboard description */
  description?: string | null;
  /** Whether the dashboard is public */
  is_public?: boolean;
  /** List of user IDs with view access */
  allowed_viewers?: string[];
  /** Dashboard filters */
  filters?: DashboardFilter[];
  /** Layout configuration */
  layout?: DashboardLayout;
}
```

### DashboardLayout

Dashboard layout options.

```typescript
interface DashboardLayout {
  /** Number of columns in the grid (default: 12) */
  columns?: number;
  /** Row height in pixels (default: 100) */
  row_height?: number;
}
```

---

## Widget Types

### WidgetType

Widget types available in Prismiq.

```typescript
enum WidgetType {
  METRIC = 'metric',
  BAR_CHART = 'bar_chart',
  LINE_CHART = 'line_chart',
  AREA_CHART = 'area_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_CHART = 'scatter_chart',
  TABLE = 'table',
  TEXT = 'text',
}
```

### Widget

A widget on a dashboard.

```typescript
interface Widget {
  /** Unique widget ID */
  id: string;
  /** Widget type */
  type: WidgetType;
  /** Widget title */
  title: string;
  /** Query definition for data widgets */
  query: QueryDefinition | null;
  /** Position on the dashboard grid */
  position: WidgetPosition;
  /** Display configuration */
  config: WidgetConfig;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
}
```

### WidgetPosition

Widget position on the dashboard grid.

```typescript
interface WidgetPosition {
  /** X coordinate (column) */
  x: number;
  /** Y coordinate (row) */
  y: number;
  /** Width in columns */
  w: number;
  /** Height in rows */
  h: number;
}
```

### WidgetConfig

Widget display configuration.

```typescript
interface WidgetConfig {
  // Chart configuration
  /** X-axis column for charts */
  xAxis?: string;
  /** Y-axis column(s) for charts */
  yAxis?: string | string[];
  /** Series column for multi-series charts */
  seriesColumn?: string;
  /** Chart orientation */
  orientation?: 'vertical' | 'horizontal';
  /** Stack bars/areas */
  stacked?: boolean;
  /** Show data points on lines */
  showPoints?: boolean;
  /** Smooth lines */
  smooth?: boolean;
  /** Show legend */
  showLegend?: boolean;
  /** Show data labels */
  showDataLabels?: boolean;
  /** Custom colors */
  colors?: string[];

  // Metric configuration
  /** Value column for metrics */
  valueColumn?: string;
  /** Number format */
  format?: 'number' | 'currency' | 'percent' | 'compact';
  /** Currency symbol */
  currencySymbol?: string;
  /** Decimal digits */
  decimalDigits?: number;
  /** Show trend indicator */
  showTrend?: boolean;
  /** Trend column */
  trendColumn?: string;

  // Pie chart configuration
  /** Category field for pie charts */
  categoryField?: string;
  /** Value field for pie charts */
  valueField?: string;
  /** Donut style */
  donut?: boolean;

  // Table configuration
  /** Striped rows */
  striped?: boolean;
  /** Sortable columns */
  sortable?: boolean;
  /** Rows per page */
  pageSize?: number;

  // Text widget configuration
  /** Text content */
  content?: string;

  // Reference lines
  referenceLines?: ReferenceLine[];

  // Cross-filter configuration
  crossFilter?: WidgetCrossFilterConfig;

  // Additional options
  [key: string]: unknown;
}
```

### ReferenceLine

Reference line configuration for charts.

```typescript
interface ReferenceLine {
  /** Line value */
  value: number;
  /** Line label */
  label?: string;
  /** Line color */
  color?: string;
  /** Line style */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}
```

### WidgetCreate

Data for creating a new widget.

```typescript
interface WidgetCreate {
  /** Widget type */
  type: WidgetType;
  /** Widget title */
  title: string;
  /** Query definition for data widgets */
  query?: QueryDefinition | null;
  /** Position on the dashboard grid */
  position: WidgetPosition;
  /** Display configuration */
  config?: WidgetConfig;
}
```

### WidgetUpdate

Data for updating a widget.

```typescript
interface WidgetUpdate {
  /** Widget title */
  title?: string;
  /** Query definition */
  query?: QueryDefinition | null;
  /** Position on the grid */
  position?: WidgetPosition;
  /** Display configuration */
  config?: WidgetConfig;
}
```

### WidgetPositionUpdate

Position update for a widget.

```typescript
interface WidgetPositionUpdate {
  /** Widget ID */
  widget_id: string;
  /** New position */
  position: WidgetPosition;
}
```

---

## Filter Types

### DashboardFilterType

Dashboard filter types.

```typescript
enum DashboardFilterType {
  TEXT = 'text',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  DATE = 'date',
  DATE_RANGE = 'date_range',
  NUMBER = 'number',
  NUMBER_RANGE = 'number_range',
}
```

### DashboardFilter

A filter on a dashboard.

```typescript
interface DashboardFilter {
  /** Unique filter ID */
  id: string;
  /** Filter type */
  type: DashboardFilterType;
  /** Filter label */
  label: string;
  /** Column to filter on */
  column: string;
  /** Table containing the column */
  table_id: string;
  /** Default value */
  default_value?: unknown;
}
```

---

## Pin Types

### PinnedDashboard

A pinned dashboard entry.

```typescript
interface PinnedDashboard {
  /** Unique pin ID */
  id: string;
  /** Dashboard ID that is pinned */
  dashboard_id: string;
  /** Context the dashboard is pinned to */
  context: string;
  /** Position in the pinned list (0-based) */
  position: number;
  /** Timestamp when the dashboard was pinned */
  pinned_at: string;
}
```

### PinnedDashboardsResponse

Response from getting pinned dashboards for a context.

```typescript
interface PinnedDashboardsResponse {
  /** List of pinned dashboards, ordered by position */
  dashboards: Dashboard[];
  /** Pin metadata for each dashboard */
  pins: PinnedDashboard[];
}
```

### DashboardPinContextsResponse

Response from getting contexts where a dashboard is pinned.

```typescript
interface DashboardPinContextsResponse {
  /** List of context names where the dashboard is pinned */
  contexts: string[];
}
```

---

## Theme Types

### PrismiqTheme

Complete theme configuration.

```typescript
interface PrismiqTheme {
  /** Theme identifier name */
  name: string;
  /** Color palette */
  colors: {
    primary: string;
    primaryHover: string;
    background: string;
    surface: string;
    surfaceHover: string;
    text: string;
    textMuted: string;
    textInverse: string;
    border: string;
    borderFocus: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  /** Font families */
  fonts: {
    sans: string;
    mono: string;
  };
  /** Font sizes */
  fontSizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  /** Spacing values */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  /** Border radius values */
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  /** Box shadow values */
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };
  /** Chart-specific theme values */
  chart: {
    colors: string[];
    gridColor: string;
    axisColor: string;
    tooltipBackground: string;
  };
}
```

### ThemeMode

Theme mode options.

```typescript
type ThemeMode = 'light' | 'dark' | 'system';
```

### ThemeContextValue

Value provided by the ThemeContext.

```typescript
interface ThemeContextValue {
  /** The currently active theme */
  theme: PrismiqTheme;
  /** The current theme mode setting */
  mode: ThemeMode;
  /** Function to change the theme mode */
  setMode: (mode: ThemeMode) => void;
  /** The resolved mode (light or dark) after system detection */
  resolvedMode: 'light' | 'dark';
}
```

### DeepPartial

Utility type for partial theme customization.

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

---

## Saved Query Types

### SavedQuery

A saved query for reuse across dashboards.

```typescript
interface SavedQuery {
  /** Unique saved query ID */
  id: string;
  /** Query name */
  name: string;
  /** Query description */
  description: string | null;
  /** The query definition */
  query: QueryDefinition;
  /** Tenant ID for multi-tenancy */
  tenant_id: string;
  /** Owner user ID */
  owner_id: string | null;
  /** Whether the query is shared with all users */
  is_shared: boolean;
  /** Creation timestamp */
  created_at: string | null;
  /** Last update timestamp */
  updated_at: string | null;
}
```

### SavedQueryCreate

Data for creating a saved query.

```typescript
interface SavedQueryCreate {
  /** Query name */
  name: string;
  /** Query description */
  description?: string | null;
  /** The query definition */
  query: QueryDefinition;
  /** Whether to share with all users */
  is_shared?: boolean;
}
```

### SavedQueryUpdate

Data for updating a saved query.

```typescript
interface SavedQueryUpdate {
  /** Query name */
  name?: string;
  /** Query description */
  description?: string | null;
  /** The query definition */
  query?: QueryDefinition;
  /** Whether to share with all users */
  is_shared?: boolean;
}
```

---

## Client Types

### ClientConfig

Configuration for the Prismiq client.

```typescript
interface ClientConfig {
  /** Base URL of the Prismiq API endpoint */
  endpoint: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** User ID for ownership and permissions */
  userId?: string;
  /** PostgreSQL schema name for per-tenant isolation */
  schemaName?: string;
  /** Optional function to get an authentication token */
  getToken?: () => Promise<string> | string;
}
```

### ExecuteSQLRequest

Request for executing raw SQL.

```typescript
interface ExecuteSQLRequest {
  /** Raw SQL query (SELECT only) */
  sql: string;
  /** Optional named parameters for the query */
  params?: Record<string, unknown>;
}
```
