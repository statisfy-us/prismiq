/**
 * Dashboard module exports.
 */

// Types
export type {
  // Widget types
  WidgetType,
  WidgetPosition,
  WidgetConfig,
  WidgetCrossFilterConfig,
  WidgetHyperlink,
  ReferenceLine,
  Widget as WidgetDefinition,
  // Filter types
  DashboardFilterType,
  FilterOption,
  DashboardFilter,
  FilterValue,
  DateRangeValue,
  NumberRangeValue,
  // Dashboard types
  DashboardLayout,
  Dashboard as DashboardDefinition,
  // Lazy loading types
  LazyLoadingConfig,
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
} from './types';

// Provider
export { DashboardProvider, DashboardContext } from './DashboardProvider';

// Hooks
export { useDashboard } from './useDashboard';
export { useDashboardFilters } from './useDashboardFilters';
export type { UseDashboardFiltersResult } from './useDashboardFilters';
export { useWidget } from './useWidget';
export type { UseWidgetResult } from './useWidget';
export { useAutoRefresh } from './useAutoRefresh';
export type { UseAutoRefreshOptions, UseAutoRefreshResult } from './useAutoRefresh';
export { useFullscreen } from './useFullscreen';
export type { UseFullscreenResult } from './useFullscreen';
export { useWidgetVisibility } from './useWidgetVisibility';
export type { UseWidgetVisibilityOptions, UseWidgetVisibilityResult } from './useWidgetVisibility';

// Main components
export { Dashboard } from './Dashboard';
export { DashboardLayout as DashboardLayoutComponent, EditableDashboardLayout } from './DashboardLayout';
export type { EditableDashboardLayoutProps } from './DashboardLayout';

// Widget components
export { Widget, WidgetHeader, WidgetContent, WidgetContainer, LazyWidget, WidgetPlaceholder } from './Widget';
export type { WidgetContentProps, WidgetContainerProps, LazyWidgetProps, WidgetPlaceholderProps } from './Widget';

// Filter components
export {
  FilterBar,
  DateRangeFilter,
  SelectFilter,
  MultiSelectFilter,
  TextFilter,
} from './filters';

// Editor components
export {
  DashboardEditor,
  EditorToolbar,
  WidgetPalette,
  WidgetEditor,
  WidgetEditorPage,
  WidgetTypeSelector,
  WidgetPreview,
} from './DashboardEditor';
export type {
  EditorToolbarProps,
  WidgetEditorPageProps,
  WidgetTypeSelectorProps,
  WidgetPreviewProps,
} from './DashboardEditor';

// Dashboard List components
export { DashboardList, DashboardCard, DashboardDialog } from './DashboardList';
export type { DashboardListProps, DashboardCardProps, DashboardDialogProps } from './DashboardList';
