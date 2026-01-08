/**
 * Prismiq TypeScript type definitions.
 *
 * These types match the Python backend exactly (snake_case field names).
 * Keep in sync with packages/python/prismiq/types.py
 */

// ============================================================================
// Schema Types - Database metadata models
// ============================================================================

/**
 * Schema information for a single database column.
 */
export interface ColumnSchema {
  /** Column name. */
  name: string;
  /** PostgreSQL data type (e.g., 'integer', 'character varying'). */
  data_type: string;
  /** Whether the column allows NULL values. */
  is_nullable: boolean;
  /** Whether this column is part of the primary key. */
  is_primary_key: boolean;
  /** Default value expression, if any. */
  default_value: string | null;
}

/**
 * Schema information for a database table.
 */
export interface TableSchema {
  /** Table name. */
  name: string;
  /** Database schema (namespace) containing the table. */
  schema_name: string;
  /** List of columns in the table. */
  columns: ColumnSchema[];
  /** Approximate row count (from pg_class.reltuples). Undefined if not fetched. */
  row_count?: number;
}

/**
 * Foreign key relationship between two tables.
 */
export interface Relationship {
  /** Name of the table containing the foreign key. */
  from_table: string;
  /** Column name in the from_table. */
  from_column: string;
  /** Name of the referenced table. */
  to_table: string;
  /** Column name in the to_table (usually primary key). */
  to_column: string;
}

/**
 * Complete schema for an exposed database.
 */
export interface DatabaseSchema {
  /** List of exposed tables. */
  tables: TableSchema[];
  /** Foreign key relationships between tables. */
  relationships: Relationship[];
}

// ============================================================================
// Query Types - Query definition models
// ============================================================================

/**
 * A table reference in a query.
 */
export interface QueryTable {
  /** Unique identifier for this table in the query (e.g., 't1', 't2'). */
  id: string;
  /** Actual table name in the database. */
  name: string;
  /** Optional alias for the table in the query. */
  alias?: string;
}

/**
 * SQL join types.
 */
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

/**
 * Definition of a join between two tables.
 */
export interface JoinDefinition {
  /** ID of the left table in the join. */
  from_table_id: string;
  /** Column name in the left table. */
  from_column: string;
  /** ID of the right table in the join. */
  to_table_id: string;
  /** Column name in the right table. */
  to_column: string;
  /** Type of join to perform. */
  join_type: JoinType;
}

/**
 * SQL aggregation functions.
 */
export type AggregationType =
  | 'none'
  | 'sum'
  | 'avg'
  | 'count'
  | 'count_distinct'
  | 'min'
  | 'max';

/**
 * A column to select in a query.
 */
export interface ColumnSelection {
  /** ID of the table containing the column. */
  table_id: string;
  /** Column name. */
  column: string;
  /** Aggregation function to apply. */
  aggregation: AggregationType;
  /** Optional alias for the result column. */
  alias?: string;
}

/**
 * SQL filter operators.
 */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in_'
  | 'not_in'
  | 'like'
  | 'ilike'
  | 'between'
  | 'is_null'
  | 'is_not_null';

/**
 * A filter condition in a query.
 *
 * Value types:
 * - Single value for eq, neq, gt, gte, lt, lte, like, ilike
 * - Array for in_, not_in
 * - [min, max] tuple for between
 * - null/undefined for is_null, is_not_null
 */
export interface FilterDefinition {
  /** ID of the table containing the column to filter. */
  table_id: string;
  /** Column name to filter on. */
  column: string;
  /** Filter operator. */
  operator: FilterOperator;
  /** Value(s) for the filter. */
  value?: unknown;
}

/**
 * SQL sort directions.
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * A sort order definition.
 */
export interface SortDefinition {
  /** ID of the table containing the column to sort by. */
  table_id: string;
  /** Column name to sort by. */
  column: string;
  /** Sort direction. */
  direction: SortDirection;
}

/**
 * A group by column definition.
 */
export interface GroupByDefinition {
  /** ID of the table containing the column. */
  table_id: string;
  /** Column name to group by. */
  column: string;
}

/**
 * Complete query definition.
 */
export interface QueryDefinition {
  /** Tables used in the query. */
  tables: QueryTable[];
  /** Join definitions between tables. */
  joins?: JoinDefinition[];
  /** Columns to select. */
  columns: ColumnSelection[];
  /** Filter conditions. */
  filters?: FilterDefinition[];
  /** Explicit group by columns. If empty and aggregations are present, will be auto-derived. */
  group_by?: GroupByDefinition[];
  /** Sort order. */
  order_by?: SortDefinition[];
  /** Maximum number of rows to return. */
  limit?: number;
  /** Number of rows to skip. */
  offset?: number;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result of executing a query.
 */
export interface QueryResult {
  /** Column names in the result. */
  columns: string[];
  /** PostgreSQL data types for each column. */
  column_types: string[];
  /** Result rows as a list of lists. */
  rows: unknown[][];
  /** Number of rows returned. */
  row_count: number;
  /** Whether the result was truncated due to row limit. */
  truncated: boolean;
  /** Query execution time in milliseconds. */
  execution_time_ms: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of query validation.
 */
export interface ValidationResult {
  /** Whether the query is valid. */
  valid: boolean;
  /** List of validation errors, if any. */
  errors: string[];
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Widget types available in Prismiq.
 */
export enum WidgetType {
  METRIC = 'metric',
  BAR_CHART = 'bar_chart',
  LINE_CHART = 'line_chart',
  AREA_CHART = 'area_chart',
  PIE_CHART = 'pie_chart',
  SCATTER_CHART = 'scatter_chart',
  TABLE = 'table',
  TEXT = 'text',
}

/**
 * Widget position on the dashboard grid.
 */
export interface WidgetPosition {
  /** X coordinate (column). */
  x: number;
  /** Y coordinate (row). */
  y: number;
  /** Width in columns. */
  w: number;
  /** Height in rows. */
  h: number;
}

/**
 * Widget display configuration.
 */
export interface WidgetConfig {
  /** X-axis column for charts. */
  xAxis?: string;
  /** Y-axis column for charts. */
  yAxis?: string;
  /** Value column for metrics. */
  valueColumn?: string;
  /** Number format for metrics. */
  format?: 'number' | 'currency' | 'percent' | 'compact';
  /** Show trend indicator for metrics. */
  showTrend?: boolean;
  /** Chart orientation. */
  orientation?: 'vertical' | 'horizontal';
  /** Stack bars. */
  stacked?: boolean;
  /** Show data points. */
  showPoints?: boolean;
  /** Donut style for pie charts. */
  donut?: boolean;
  /** Striped rows for tables. */
  striped?: boolean;
  /** Allow column sorting for tables. */
  sortable?: boolean;
  /** Rows per page for tables. */
  pageSize?: number;
  /** Text content for text widgets. */
  content?: string;
  /** Additional config options. */
  [key: string]: unknown;
}

/**
 * A widget on a dashboard.
 */
export interface Widget {
  /** Unique widget ID. */
  id: string;
  /** Widget type. */
  type: WidgetType;
  /** Widget title. */
  title: string;
  /** Query definition for data widgets. */
  query: QueryDefinition | null;
  /** Position on the dashboard grid. */
  position: WidgetPosition;
  /** Display configuration. */
  config: WidgetConfig;
  /** Creation timestamp. */
  created_at: string;
  /** Last update timestamp. */
  updated_at: string;
}

/**
 * Data for creating a new widget.
 */
export interface WidgetCreate {
  /** Widget type. */
  type: WidgetType;
  /** Widget title. */
  title: string;
  /** Query definition for data widgets. */
  query?: QueryDefinition | null;
  /** Position on the dashboard grid. */
  position: WidgetPosition;
  /** Display configuration. */
  config?: WidgetConfig;
}

/**
 * Data for updating a widget.
 */
export interface WidgetUpdate {
  /** Widget title. */
  title?: string;
  /** Query definition. */
  query?: QueryDefinition | null;
  /** Position on the grid. */
  position?: WidgetPosition;
  /** Display configuration. */
  config?: WidgetConfig;
}

/**
 * Dashboard filter types.
 */
export enum DashboardFilterType {
  TEXT = 'text',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  DATE = 'date',
  DATE_RANGE = 'date_range',
  NUMBER = 'number',
  NUMBER_RANGE = 'number_range',
}

/**
 * A filter on a dashboard.
 */
export interface DashboardFilter {
  /** Unique filter ID. */
  id: string;
  /** Filter type. */
  type: DashboardFilterType;
  /** Filter label. */
  label: string;
  /** Column to filter on. */
  column: string;
  /** Table containing the column. */
  table_id: string;
  /** Default value. */
  default_value?: unknown;
}

/**
 * Dashboard layout options.
 */
export interface DashboardLayout {
  /** Number of columns in the grid. */
  columns?: number;
  /** Row height in pixels. */
  row_height?: number;
}

/**
 * A dashboard.
 */
export interface Dashboard {
  /** Unique dashboard ID. */
  id: string;
  /** Dashboard name. */
  name: string;
  /** Dashboard description. */
  description: string | null;
  /** Owner user ID. */
  owner_id: string | null;
  /** Whether the dashboard is public. */
  is_public: boolean;
  /** List of user IDs with view access. */
  allowed_viewers: string[];
  /** Widgets on the dashboard. */
  widgets: Widget[];
  /** Dashboard filters. */
  filters: DashboardFilter[];
  /** Layout configuration. */
  layout: DashboardLayout;
  /** Creation timestamp. */
  created_at: string;
  /** Last update timestamp. */
  updated_at: string;
}

/**
 * Data for creating a new dashboard.
 */
export interface DashboardCreate {
  /** Dashboard name. */
  name: string;
  /** Dashboard description. */
  description?: string;
  /** Layout configuration. */
  layout?: DashboardLayout;
}

/**
 * Data for updating a dashboard.
 */
export interface DashboardUpdate {
  /** Dashboard name. */
  name?: string;
  /** Dashboard description. */
  description?: string | null;
  /** Whether the dashboard is public. */
  is_public?: boolean;
  /** List of user IDs with view access. */
  allowed_viewers?: string[];
  /** Dashboard filters. */
  filters?: DashboardFilter[];
  /** Layout configuration. */
  layout?: DashboardLayout;
}

/**
 * Position update for a widget.
 */
export interface WidgetPositionUpdate {
  /** Widget ID. */
  widget_id: string;
  /** New position. */
  position: WidgetPosition;
}

// ============================================================================
// Saved Query Types
// ============================================================================

/**
 * A saved query for reuse across dashboards.
 */
export interface SavedQuery {
  /** Unique saved query ID. */
  id: string;
  /** Query name. */
  name: string;
  /** Query description. */
  description: string | null;
  /** The query definition. */
  query: QueryDefinition;
  /** Tenant ID for multi-tenancy. */
  tenant_id: string;
  /** Owner user ID. */
  owner_id: string | null;
  /** Whether the query is shared with all users. */
  is_shared: boolean;
  /** Creation timestamp. */
  created_at: string | null;
  /** Last update timestamp. */
  updated_at: string | null;
}

/**
 * Data for creating a saved query.
 */
export interface SavedQueryCreate {
  /** Query name. */
  name: string;
  /** Query description. */
  description?: string | null;
  /** The query definition. */
  query: QueryDefinition;
  /** Whether to share with all users. */
  is_shared?: boolean;
}

/**
 * Data for updating a saved query.
 */
export interface SavedQueryUpdate {
  /** Query name. */
  name?: string;
  /** Query description. */
  description?: string | null;
  /** The query definition. */
  query?: QueryDefinition;
  /** Whether to share with all users. */
  is_shared?: boolean;
}

// ============================================================================
// Custom SQL Types
// ============================================================================

/**
 * Request for executing raw SQL.
 */
export interface ExecuteSQLRequest {
  /** Raw SQL query (SELECT only). */
  sql: string;
  /** Optional named parameters for the query. */
  params?: Record<string, unknown>;
}

/**
 * Result of SQL validation.
 */
export interface SQLValidationResult {
  /** Whether the SQL is valid. */
  valid: boolean;
  /** List of validation errors (empty if valid). */
  errors: string[];
  /** List of tables referenced in the query. */
  tables: string[];
}
