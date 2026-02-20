/**
 * Dashboard type definitions for Prismiq.
 *
 * These types define dashboards, widgets, and filters.
 */

import type { QueryDefinition, QueryResult, DatabaseSchema } from '../types';

// ============================================================================
// Widget Types
// ============================================================================

/**
 * Supported widget types.
 */
export type WidgetType =
  | 'metric'
  | 'bar_chart'
  | 'line_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'scatter_chart'
  | 'table'
  | 'text';

/**
 * Widget position and size in the grid layout.
 */
export interface WidgetPosition {
  /** X coordinate (column position). */
  x: number;
  /** Y coordinate (row position). */
  y: number;
  /** Width in grid units. */
  w: number;
  /** Height in grid units. */
  h: number;
  /** Minimum width constraint. */
  minW?: number;
  /** Minimum height constraint. */
  minH?: number;
  /** Maximum width constraint. */
  maxW?: number;
  /** Maximum height constraint. */
  maxH?: number;
}

/**
 * Cross-filter widget configuration.
 */
export interface WidgetCrossFilterConfig {
  /** Enable cross-filtering on this widget. */
  enabled: boolean;
  /** Column to filter on (defaults to x_axis). */
  column?: string;
  /** Table for the filter (optional). */
  table?: string;
}

/**
 * A reference line (threshold/goal) for charts.
 */
export interface ReferenceLine {
  /** Y-axis value where line should appear. */
  value: number;
  /** Optional label displayed on the line. */
  label?: string;
  /** Line color (hex). */
  color?: string;
  /** Line style. */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

/**
 * Widget-specific configuration options.
 */
export interface WidgetConfig {
  // Chart options
  /** Column to use for X axis. */
  x_axis?: string;
  /** Columns to use for Y axis (supports multiple for multi-series). */
  y_axis?: string[];
  /** Column that defines series for multi-series charts (e.g., category column in long-format data). */
  series_column?: string;
  /** Maximum number of series to display (top N by total value). Useful for charts with many series. */
  max_series?: number;
  /** Chart orientation for bar charts. */
  orientation?: 'vertical' | 'horizontal';
  /** Whether to stack series. */
  stacked?: boolean;
  /** Whether to show the legend. */
  show_legend?: boolean;
  /** Whether to show data labels on chart elements. */
  show_data_labels?: boolean;
  /** Custom color palette for the chart. */
  colors?: string[];
  /** Value format for chart axes (e.g., 'currency', 'percent'). */
  valueFormat?: 'number' | 'currency' | 'percent' | 'compact';
  /** Currency symbol when valueFormat is 'currency'. */
  currencySymbol?: string;
  /** Compact notation mode (K for thousands, M for millions, etc.). Null means no compacting. */
  compactNotation?: 'K' | 'M' | 'B' | 'T' | null;
  /** Number of decimal digits to show. */
  decimalDigits?: number;

  /** Reference lines for charts (thresholds, goals). */
  referenceLines?: ReferenceLine[];

  // Cross-filter options
  /** Cross-filter configuration for this widget. */
  cross_filter?: WidgetCrossFilterConfig;

  // MetricCard options
  /** Number format for metric display. */
  format?: 'number' | 'currency' | 'percent' | 'compact';
  /** Column to use for trend comparison (deprecated, use trendDateColumn). */
  trend_comparison?: string;
  /** Whether to show trend indicator. */
  showTrend?: boolean;
  /** Comparison period for trend calculation. */
  trendPeriod?: 'previous_period' | 'previous_year' | 'previous_month' | 'previous_week';
  /** Date column to use for trend comparison. */
  trendDateColumn?: string;

  // Table options
  /** Number of rows per page. */
  page_size?: number;
  /** Whether table columns are sortable. */
  sortable?: boolean;
  /** Column to pivot (for pivot tables). Unique values become columns. */
  pivot_column?: string;
  /** Column containing values to distribute across pivoted columns. */
  value_column?: string;

  // Date formatting (used by both tables and charts)
  /** Date format strings for datetime columns (column name -> date-fns format string). Used by tables and chart axes. */
  dateFormats?: Record<string, string>;

  // Text options
  /** Text content for text widgets. */
  content?: string;
  /** Whether to render content as markdown. */
  markdown?: boolean;
  /** Text alignment for text widgets. */
  alignment?: 'Left' | 'Center' | 'Right';
  /** Font size for text widgets. */
  fontSize?: 'Small' | 'Normal' | 'Large' | 'XLarge';

  // Editor metadata
  /** Editor mode used to build this widget ('guided', 'advanced', or 'saved'). */
  data_source_mode?: 'guided' | 'advanced' | 'saved';
}

/**
 * Widget hyperlink configuration for linking to external URLs.
 */
export interface WidgetHyperlink {
  /** URL to navigate to. */
  url: string;
  /** Link title/tooltip. */
  title?: string;
  /** Target window (_blank for new tab, _self for same tab). */
  target?: '_blank' | '_self';
}

/**
 * A widget in a dashboard.
 */
export interface Widget {
  /** Unique widget identifier. */
  id: string;
  /** Widget type determines rendering. */
  type: WidgetType;
  /** Widget display title. */
  title: string;
  /** Query to execute for widget data (null for text widgets). */
  query: QueryDefinition | null;
  /** Position and size in the grid. */
  position: WidgetPosition;
  /** Widget-specific configuration. */
  config: WidgetConfig;
  /** Optional hyperlink to external URL (displayed as link icon in header). */
  hyperlink?: WidgetHyperlink;
  /** Creation timestamp (ISO string). */
  created_at?: string;
  /** Last update timestamp (ISO string). */
  updated_at?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Supported dashboard filter types.
 */
export type DashboardFilterType =
  | 'date_range'
  | 'select'
  | 'multi_select'
  | 'text'
  | 'number_range';

/**
 * Filter option for select/multi-select filters.
 */
export interface FilterOption {
  /** Option value. */
  value: string;
  /** Display label. */
  label: string;
}

/**
 * A dashboard filter definition.
 */
export interface DashboardFilter {
  /** Unique filter identifier. */
  id: string;
  /** Filter type determines the input component. */
  type: DashboardFilterType;
  /** Display label for the filter. */
  label: string;
  /** Column name this filter applies to. */
  field: string;
  /** Table name if filter targets a specific table. */
  table?: string;
  /** Default value for the filter. */
  default_value?: unknown;
  /** Available options for select/multi-select filters. */
  options?: FilterOption[];
  /** Date preset for date_range filters (e.g., 'last_7_days'). */
  date_preset?: string;
  /**
   * Whether to dynamically load options from the database.
   * When true, options are fetched from the table's column using getColumnSample.
   * Requires `table` and `field` to be set.
   */
  dynamic?: boolean;
}

/**
 * A filter value set by the user.
 */
export interface FilterValue {
  /** ID of the filter this value belongs to. */
  filter_id: string;
  /** The filter value. */
  value: unknown;
}

/**
 * Date range value for date_range filters.
 */
export interface DateRangeValue {
  /** Start date (ISO string). */
  start: string;
  /** End date (ISO string). */
  end: string;
}

/**
 * Number range value for number_range filters.
 */
export interface NumberRangeValue {
  /** Minimum value. */
  min: number | null;
  /** Maximum value. */
  max: number | null;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard layout configuration.
 */
export interface DashboardLayout {
  /** Number of columns in the grid. */
  columns: number;
  /** Height of a single row in pixels. */
  row_height: number;
  /** Margin between widgets [horizontal, vertical]. */
  margin: [number, number];
  /** Compact type for auto-arranging widgets. */
  compact_type: 'vertical' | 'horizontal' | null;
}

/**
 * A complete dashboard definition.
 */
export interface Dashboard {
  /** Unique dashboard identifier. */
  id: string;
  /** Dashboard name. */
  name: string;
  /** Optional description. */
  description?: string;
  /** Grid layout configuration. */
  layout: DashboardLayout;
  /** Widgets in the dashboard. */
  widgets: Widget[];
  /** Dashboard-level filters. */
  filters: DashboardFilter[];
  /** Whether the dashboard is publicly accessible. */
  is_public: boolean;
  /** Owner user ID. */
  owner_id?: string | null;
  /** List of user IDs with view access. */
  allowed_viewers?: string[];
  /** Creation timestamp (ISO string). */
  created_at?: string;
  /** Last update timestamp (ISO string). */
  updated_at?: string;
}

// ============================================================================
// Lazy Loading Types
// ============================================================================

/**
 * Configuration for scroll-based lazy loading of widgets.
 */
export interface LazyLoadingConfig {
  /** Whether lazy loading is enabled (default: true). */
  enabled?: boolean;
  /** Root margin for prefetching - loads widgets before visible (default: "200px"). */
  rootMargin?: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Dashboard context value for read-only mode.
 */
export interface DashboardContextValue {
  /** Current dashboard (null while loading). */
  dashboard: Dashboard | null;
  /** Whether the dashboard is loading. */
  isLoading: boolean;
  /** Error if dashboard failed to load. */
  error: Error | null;
  /** Current filter values. */
  filterValues: FilterValue[];
  /** Query results keyed by widget ID. */
  widgetResults: Record<string, QueryResult>;
  /** Query errors keyed by widget ID. */
  widgetErrors: Record<string, Error>;
  /** Loading state keyed by widget ID. */
  widgetLoading: Record<string, boolean>;
  /** Unix timestamps when each widget was last refreshed. */
  widgetRefreshTimes: Record<string, number>;
  /** Set of widget IDs currently being refreshed (force refresh). */
  refreshingWidgets: Set<string>;

  // Actions
  /** Set a filter value. */
  setFilterValue: (filterId: string, value: unknown) => void;
  /** Refresh all widgets (with batching). */
  refreshDashboard: () => Promise<void>;
  /** Refresh a single widget (bypasses cache). */
  refreshWidget: (widgetId: string) => Promise<void>;
  /** Refresh all widgets with configurable batch size. */
  refreshAll: (batchSize?: number) => Promise<void>;
  /** Get oldest widget refresh timestamp (for dashboard-level indicator). */
  getOldestRefreshTime: () => number | null;

  // Lazy loading visibility tracking
  /** Register a widget's visibility state (for lazy loading). */
  registerVisibility: (widgetId: string, isVisible: boolean) => void;
  /** Unregister a widget when unmounted (for lazy loading). */
  unregisterVisibility: (widgetId: string) => void;
  /** Whether lazy loading is enabled. */
  lazyLoadingEnabled: boolean;
}

/**
 * Dashboard context value for editor mode.
 * Extends the read-only context with editing capabilities.
 */
export interface DashboardEditorContextValue extends DashboardContextValue {
  /** Whether the dashboard is in edit mode. */
  isEditing: boolean;
  /** Whether there are unsaved changes. */
  hasChanges: boolean;

  // Editor actions
  /** Add a new widget. */
  addWidget: (widget: Omit<Widget, 'id'>) => void;
  /** Update an existing widget. */
  updateWidget: (widgetId: string, updates: Partial<Widget>) => void;
  /** Remove a widget. */
  removeWidget: (widgetId: string) => void;
  /** Duplicate a widget. */
  duplicateWidget: (widgetId: string) => void;
  /** Update widget positions after layout change. */
  updateLayout: (positions: Record<string, WidgetPosition>) => void;
  /** Save the dashboard. */
  save: () => Promise<void>;
  /** Cancel editing and revert changes. */
  cancel: () => void;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Props for DashboardProvider.
 */
export interface DashboardProviderProps {
  /** Dashboard ID to load. */
  dashboardId: string;
  /**
   * @deprecated Auto-refresh is no longer supported. Use manual refresh via refreshAll().
   */
  refreshInterval?: number;
  /** Number of widgets to load in each batch (default: 8). */
  batchSize?: number;
  /** Lazy loading configuration (default: enabled with 200px margin). */
  lazyLoading?: LazyLoadingConfig;
  /** Children to render. */
  children: React.ReactNode;
}

/**
 * Props for Dashboard component.
 */
export interface DashboardProps {
  /** Dashboard ID to display. */
  id: string;
  /** Whether to show the filter bar. */
  showFilters?: boolean;
  /** Whether to show the dashboard title. */
  showTitle?: boolean;
  /** Auto-refresh interval in milliseconds. */
  refreshInterval?: number;
  /** Number of widgets to load in each batch (default: 8). */
  batchSize?: number;
  /** Lazy loading configuration (default: enabled with 200px margin). */
  lazyLoading?: LazyLoadingConfig;
  /** Callback when a widget is clicked. */
  onWidgetClick?: (widget: Widget, result: QueryResult) => void;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Props for DashboardEditor component.
 */
export interface DashboardEditorProps {
  /** Dashboard ID to edit (omit for new dashboard). */
  dashboardId?: string;
  /** Callback when dashboard is saved. */
  onSave?: (dashboard: Dashboard) => void;
  /** Callback when editing is cancelled. */
  onCancel?: () => void;
  /** Number of widgets to load in each batch (default: 4). */
  batchSize?: number;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Props for DashboardLayout component.
 */
export interface DashboardLayoutProps {
  /** Widgets to display. */
  widgets: Widget[];
  /** Layout configuration. */
  layout: DashboardLayout;
  /** Whether the layout is editable. */
  editable?: boolean;
  /** Callback when layout changes. */
  onLayoutChange?: (positions: Record<string, WidgetPosition>) => void;
  /** Render function for each widget. */
  renderWidget: (widget: Widget) => React.ReactNode;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Props for Widget component.
 */
export interface WidgetProps {
  /** Widget to display. */
  widget: Widget;
  /** Query result for the widget. */
  result: QueryResult | null;
  /** Whether the widget is loading. */
  isLoading?: boolean;
  /** Error if query failed. */
  error?: Error | null;
  /** Additional CSS class. */
  className?: string;
  /** Unix timestamp when widget was last refreshed. */
  lastRefreshed?: number;
  /** Whether the widget is currently being refreshed (force refresh). */
  isRefreshing?: boolean;
  /** Callback to trigger widget refresh. */
  onRefresh?: () => void;
}

/**
 * Props for WidgetHeader component.
 */
export interface WidgetHeaderProps {
  /** Widget title. */
  title: string;
  /** Optional hyperlink for the widget (shows link icon in header). */
  hyperlink?: WidgetHyperlink;
  /** Unix timestamp when widget was last refreshed. */
  lastRefreshed?: number;
  /** Whether the widget is currently being refreshed (force refresh). */
  isRefreshing?: boolean;
  /** Callback to trigger widget refresh. */
  onRefresh?: () => void;
}

/**
 * Props for FilterBar component.
 */
export interface FilterBarProps {
  /** Filters to display. */
  filters: DashboardFilter[];
  /** Current filter values. */
  values: FilterValue[];
  /** Callback when a filter value changes. */
  onChange: (filterId: string, value: unknown) => void;
  /** Callback to reset all filters. */
  onReset?: () => void;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Props for DateRangeFilter component.
 */
export interface DateRangeFilterProps {
  /** Filter definition. */
  filter: DashboardFilter;
  /** Current value (DateRangeValue or preset string). */
  value: DateRangeValue | string | null;
  /** Callback when value changes. */
  onChange: (value: DateRangeValue | string) => void;
}

/**
 * Props for SelectFilter component.
 */
export interface SelectFilterProps {
  /** Filter definition. */
  filter: DashboardFilter;
  /** Current value. */
  value: string | null;
  /** Callback when value changes. */
  onChange: (value: string | null) => void;
}

/**
 * Props for MultiSelectFilter component.
 */
export interface MultiSelectFilterProps {
  /** Filter definition. */
  filter: DashboardFilter;
  /** Current values. */
  value: string[];
  /** Callback when values change. */
  onChange: (value: string[]) => void;
}

/**
 * Props for TextFilter component.
 */
export interface TextFilterProps {
  /** Filter definition. */
  filter: DashboardFilter;
  /** Current value. */
  value: string;
  /** Callback when value changes. */
  onChange: (value: string) => void;
  /** Debounce delay in milliseconds. */
  debounceMs?: number;
}

/**
 * Props for WidgetPalette component.
 */
export interface WidgetPaletteProps {
  /** Callback when a widget type is selected. */
  onAddWidget: (type: WidgetType) => void;
}

/**
 * Props for WidgetEditor component.
 */
export interface WidgetEditorProps {
  /** Widget to edit. */
  widget: Widget;
  /** Database schema for column selection. */
  schema: DatabaseSchema;
  /** Callback when widget is saved. */
  onSave: (widget: Widget) => void;
  /** Callback when editing is cancelled. */
  onCancel: () => void;
}
