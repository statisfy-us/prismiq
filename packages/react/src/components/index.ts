/**
 * Components module exports.
 *
 * Re-exports all UI and query builder components for convenient access.
 */

// ============================================================================
// UI Components
// ============================================================================

export {
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
  Dialog,
  DialogHeader,
  DialogFooter,
} from './ui';

export type {
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
  DialogProps,
  DialogHeaderProps,
  DialogFooterProps,
} from './ui';

// ============================================================================
// Skeleton Loading Components
// ============================================================================

export {
  Skeleton,
  SkeletonText,
  SkeletonChart,
  SkeletonTable,
  SkeletonMetricCard,
} from './Skeleton';

export type {
  SkeletonProps,
  SkeletonTextProps,
  SkeletonChartProps,
  SkeletonTableProps,
  SkeletonMetricCardProps,
} from './Skeleton';

// ============================================================================
// Error Boundary Components
// ============================================================================

export {
  ErrorBoundary,
  ErrorFallback,
  WidgetErrorBoundary,
} from './ErrorBoundary';

export type {
  ErrorBoundaryProps,
  ErrorFallbackProps,
  WidgetErrorBoundaryProps,
} from './ErrorBoundary';

// ============================================================================
// Empty State Components
// ============================================================================

export {
  EmptyState,
  NoData,
  NoResults,
  EmptyDashboard,
} from './EmptyState';

export type {
  EmptyStateProps,
  NoDataProps,
  NoResultsProps,
  EmptyDashboardProps,
} from './EmptyState';

// ============================================================================
// Schema Explorer
// ============================================================================

export { SchemaExplorer, TableNode, ColumnNode } from './SchemaExplorer';

export type {
  SchemaExplorerProps,
  TableNodeProps,
  ColumnNodeProps,
} from './SchemaExplorer';

// ============================================================================
// Column Selector
// ============================================================================

export { ColumnSelector, SelectedColumn } from './ColumnSelector';

export type { ColumnSelectorProps, SelectedColumnProps } from './ColumnSelector';

// ============================================================================
// Filter Builder
// ============================================================================

export { FilterBuilder, FilterRow, FilterValueInput } from './FilterBuilder';

export type {
  FilterBuilderProps,
  FilterRowProps,
  FilterValueInputProps,
} from './FilterBuilder';

// ============================================================================
// Sort Builder
// ============================================================================

export { SortBuilder, SortRow } from './SortBuilder';

export type { SortBuilderProps, SortRowProps } from './SortBuilder';

// ============================================================================
// Join Builder
// ============================================================================

export { JoinBuilder, JoinRow } from './JoinBuilder';

export type { JoinBuilderProps, JoinRowProps } from './JoinBuilder';

// ============================================================================
// Aggregation Picker
// ============================================================================

export { AggregationPicker } from './AggregationPicker';

export type { AggregationPickerProps } from './AggregationPicker';

// ============================================================================
// Results Table
// ============================================================================

export {
  ResultsTable,
  TableHeader,
  TableRow,
  TableCell,
  Pagination,
} from './ResultsTable';

export type {
  ResultsTableProps,
  TableHeaderProps,
  TableRowProps,
  TableCellProps,
  PaginationProps,
} from './ResultsTable';

// ============================================================================
// Query Builder
// ============================================================================

export { QueryBuilder, QueryBuilderToolbar, QueryPreview } from './QueryBuilder';

export type {
  QueryBuilderProps,
  QueryBuilderState,
  QueryBuilderToolbarProps,
  QueryPreviewProps,
} from './QueryBuilder';

// ============================================================================
// Auto Save Indicator
// ============================================================================

export { AutoSaveIndicator } from './AutoSaveIndicator';

export type { AutoSaveIndicatorProps } from './AutoSaveIndicator';

// ============================================================================
// Saved Query Picker
// ============================================================================

export { SavedQueryPicker } from './SavedQueryPicker';

export type { SavedQueryPickerProps } from './SavedQueryPicker';

// ============================================================================
// Custom SQL Editor
// ============================================================================

export { CustomSQLEditor } from './CustomSQLEditor';

export type { CustomSQLEditorProps } from './CustomSQLEditor';

// ============================================================================
// Table Selector
// ============================================================================

export { TableSelector } from './TableSelector';

export type { TableSelectorProps } from './TableSelector';

// ============================================================================
// Time Series Config
// ============================================================================

export { TimeSeriesConfig } from './TimeSeriesConfig';

export type { TimeSeriesConfigProps } from './TimeSeriesConfig';

// ============================================================================
// Calculated Field Builder
// ============================================================================

export { CalculatedFieldBuilder, ExpressionEditor } from './CalculatedFieldBuilder';

export type {
  CalculatedFieldBuilderProps,
  ExpressionEditorProps,
} from './CalculatedFieldBuilder';

// ============================================================================
// Chat Panel
// ============================================================================

export { ChatPanel, ChatBubble } from './ChatPanel';

export type { ChatPanelProps, ChatBubbleProps } from './ChatPanel';
