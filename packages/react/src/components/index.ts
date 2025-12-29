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
