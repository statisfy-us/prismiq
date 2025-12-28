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
 *   Dashboard,
 *   useQuery
 * } from '@prismiq/react';
 *
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <AnalyticsProvider config={{ endpoint: 'https://api.example.com' }}>
 *         <Dashboard id="my-dashboard" />
 *       </AnalyticsProvider>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 *
 * For modular imports (smaller bundle size):
 * ```tsx
 * import { BarChart } from '@prismiq/react/charts';
 * import { Dashboard } from '@prismiq/react/dashboard';
 * import { useIsClient } from '@prismiq/react/ssr';
 * import { useFocusTrap } from '@prismiq/react/utils';
 * import { exportToCSV } from '@prismiq/react/export';
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
  // Skeleton Loading
  Skeleton,
  SkeletonText,
  SkeletonChart,
  SkeletonTable,
  SkeletonMetricCard,
  // Error Boundaries
  ErrorBoundary,
  ErrorFallback,
  WidgetErrorBoundary,
  // Empty States
  EmptyState,
  NoData,
  NoResults,
  EmptyDashboard,
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
  // Skeleton Loading
  SkeletonProps,
  SkeletonTextProps,
  SkeletonChartProps,
  SkeletonTableProps,
  SkeletonMetricCardProps,
  // Error Boundaries
  ErrorBoundaryProps,
  ErrorFallbackProps,
  WidgetErrorBoundaryProps,
  // Empty States
  EmptyStateProps,
  NoDataProps,
  NoResultsProps,
  EmptyDashboardProps,
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
// Export Utilities
// ============================================================================

export {
  // CSV export
  exportToCSV,
  generateCSV,
  downloadFile,
  // Excel export
  exportToExcel,
  exportMultipleSheets,
  // Hook
  useExport,
} from './export';

export type {
  ExportOptions,
  ExcelExportOptions,
  ExcelCellStyle,
  ExportData,
  UseExportOptions,
  UseExportResult,
} from './export';

// ============================================================================
// Dashboard
// ============================================================================

export {
  // Main components
  Dashboard,
  DashboardProvider,
  DashboardLayoutComponent,
  // Widget components
  Widget,
  WidgetHeader,
  WidgetContent,
  // Filter components
  FilterBar,
  DateRangeFilter,
  SelectFilter,
  MultiSelectFilter,
  TextFilter,
  // Editor components
  DashboardEditor,
  EditorToolbar,
  WidgetPalette,
  WidgetEditor,
  // Hooks
  useDashboard,
  useDashboardFilters,
  useWidget,
  useAutoRefresh,
  useFullscreen,
  // Context
  DashboardContext,
} from './dashboard';

export type {
  // Widget types
  WidgetType,
  WidgetPosition,
  WidgetConfig,
  WidgetDefinition,
  // Filter types
  DashboardFilterType,
  FilterOption,
  DashboardFilter,
  FilterValue,
  DateRangeValue,
  NumberRangeValue,
  // Dashboard types
  DashboardLayout,
  DashboardDefinition,
  // Context types
  DashboardContextValue,
  DashboardEditorContextValue,
  // Component props
  DashboardProviderProps,
  DashboardProps,
  DashboardEditorProps,
  DashboardLayoutProps,
  WidgetProps,
  WidgetHeaderProps,
  FilterBarProps,
  DateRangeFilterProps,
  SelectFilterProps,
  MultiSelectFilterProps,
  TextFilterProps,
  WidgetPaletteProps,
  WidgetEditorProps,
  WidgetContentProps,
  EditorToolbarProps,
  // Hook result types
  UseDashboardFiltersResult,
  UseWidgetResult,
  UseAutoRefreshOptions,
  UseAutoRefreshResult,
  UseFullscreenResult,
} from './dashboard';

// ============================================================================
// Accessibility Utilities
// ============================================================================

export {
  useFocusTrap,
  useArrowNavigation,
  useRovingTabIndex,
  useFocusVisible,
  announceToScreenReader,
  focusVisibleStyles,
  skipLinkStyles,
  skipLinkFocusStyles,
} from './utils';

export type {
  FocusTrapOptions,
  ArrowNavigationOptions,
  UseFocusTrapResult,
  UseArrowNavigationResult,
  SkipLinkProps,
} from './utils';

// ============================================================================
// SSR Utilities
// ============================================================================

export {
  useIsClient,
  ClientOnly,
  getWindowWidth,
  getWindowHeight,
  isBrowser,
  isServer,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  useWindowSize,
  useMediaQuery,
  useBreakpoint,
  useIsBreakpoint,
  BREAKPOINTS,
} from './ssr';

export type {
  ClientOnlyProps,
  WindowSize,
  Breakpoint,
} from './ssr';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';
