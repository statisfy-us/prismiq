/**
 * @prismiq/react - React SDK for Prismiq embedded analytics
 *
 * @example
 * ```tsx
 * import {
 *   AnalyticsProvider,
 *   ThemeProvider,
 *   QueryBuilder,
 *   BarChart,
 *   useQuery
 * } from '@prismiq/react';
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <AnalyticsProvider config={{ endpoint: 'https://api.example.com' }}>
 *         <QueryBuilder onExecute={(result) => console.log(result)} />
 *         <BarChart data={result} xAxis="month" yAxis="revenue" />
 *       </AnalyticsProvider>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Schema types
  ColumnSchema,
  TableSchema,
  Relationship,
  DatabaseSchema,
  // Query types
  QueryTable,
  JoinType,
  JoinDefinition,
  AggregationType,
  ColumnSelection,
  FilterOperator,
  FilterDefinition,
  SortDirection,
  SortDefinition,
  GroupByDefinition,
  QueryDefinition,
  // Result types
  QueryResult,
  ValidationResult,
} from './types';

// ============================================================================
// API Client
// ============================================================================

export { PrismiqClient, PrismiqError } from './api';
export type { ClientConfig } from './api';

// ============================================================================
// Theme
// ============================================================================

export { ThemeProvider, useTheme, lightTheme, darkTheme } from './theme';
export type {
  PrismiqTheme,
  ThemeMode,
  ThemeContextValue,
  ThemeProviderProps,
  DeepPartial,
} from './theme';

// ============================================================================
// Context
// ============================================================================

export { AnalyticsProvider, useAnalytics, useAnalyticsCallbacks } from './context';
export type {
  AnalyticsContextValue,
  AnalyticsProviderProps,
  AnalyticsCallbacks,
} from './context';

// ============================================================================
// Hooks
// ============================================================================

export { useSchema, useQuery, useChartData } from './hooks';
export type { UseSchemaResult, UseQueryResult, UseQueryOptions } from './hooks';

// ============================================================================
// Charts
// ============================================================================

export {
  // Base wrapper
  EChartWrapper,
  // Chart components
  MetricCard,
  TrendIndicator,
  Sparkline,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  ScatterChart,
  // Auto suggest
  suggestChartType,
  // Utilities
  queryResultToChartData,
  dataPointsToChartData,
  toChartData,
  createChartTheme,
  applyThemeToOption,
  formatAxisLabel,
  formatCompact,
  formatMetricValue,
  getChartColors,
  createGradientColor,
  isChartDataEmpty,
} from './charts';

export type {
  // Data types
  ChartDataPoint,
  ChartSeries,
  // Base props
  BaseChartProps,
  ChartClickParams,
  ReferenceLineConfig,
  AxisFormat,
  LegendPosition,
  EChartWrapperProps,
  // Chart-specific props
  BarChartProps,
  LineChartProps,
  AreaChartProps,
  PieChartProps,
  ScatterChartProps,
  // MetricCard
  TrendConfig,
  MetricCardProps,
  TrendIndicatorProps,
  SparklineProps,
  // Hook types
  ChartDataOptions,
  ChartDataResult,
  // Auto suggest
  ChartType,
  ChartSuggestion,
} from './charts';

// ============================================================================
// UI Components
// ============================================================================

export {
  // Base UI
  Button,
  Input,
  Select,
  Checkbox,
  Badge,
  Tooltip,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  Icon,
  // Schema Explorer
  SchemaExplorer,
  TableNode,
  ColumnNode,
  // Column Selector
  ColumnSelector,
  SelectedColumn,
  // Filter Builder
  FilterBuilder,
  FilterRow,
  FilterValueInput,
  // Sort Builder
  SortBuilder,
  SortRow,
  // Aggregation Picker
  AggregationPicker,
  // Results Table
  ResultsTable,
  TableHeader,
  TableRow,
  TableCell,
  Pagination,
  // Query Builder
  QueryBuilder,
  QueryBuilderToolbar,
  QueryPreview,
} from './components';

export type {
  // Base UI
  ButtonProps,
  InputProps,
  SelectProps,
  SelectOption,
  CheckboxProps,
  BadgeProps,
  TooltipProps,
  DropdownProps,
  DropdownItemProps,
  DropdownSeparatorProps,
  IconProps,
  IconName,
  // Schema Explorer
  SchemaExplorerProps,
  TableNodeProps,
  ColumnNodeProps,
  // Column Selector
  ColumnSelectorProps,
  SelectedColumnProps,
  // Filter Builder
  FilterBuilderProps,
  FilterRowProps,
  FilterValueInputProps,
  // Sort Builder
  SortBuilderProps,
  SortRowProps,
  // Aggregation Picker
  AggregationPickerProps,
  // Results Table
  ResultsTableProps,
  TableHeaderProps,
  TableRowProps,
  TableCellProps,
  PaginationProps,
  // Query Builder
  QueryBuilderProps,
  QueryBuilderState,
  QueryBuilderToolbarProps,
  QueryPreviewProps,
} from './components';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';
