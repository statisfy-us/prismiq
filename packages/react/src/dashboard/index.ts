/**
 * Dashboard module exports.
 */

// Types
export type {
  // Widget types
  WidgetType,
  WidgetPosition,
  WidgetConfig,
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

// Main components
export { Dashboard } from './Dashboard';
export { DashboardLayout as DashboardLayoutComponent } from './DashboardLayout';

// Widget components
export { Widget, WidgetHeader, WidgetContent } from './Widget';
export type { WidgetContentProps } from './Widget';

// Filter components
export {
  FilterBar,
  DateRangeFilter,
  SelectFilter,
  MultiSelectFilter,
  TextFilter,
} from './filters';
