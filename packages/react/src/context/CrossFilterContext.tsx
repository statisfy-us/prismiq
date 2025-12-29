/**
 * CrossFilterContext - Cross-filtering state management.
 *
 * Enables interactive filtering: click on a chart element to filter other widgets.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * A cross-filter applied from one widget to others.
 */
export interface CrossFilter {
  /** Widget ID that triggered the filter. */
  sourceWidgetId: string;
  /** Column being filtered. */
  column: string;
  /** Filter value (can be string, number, or array for multi-select). */
  value: string | number | (string | number)[];
  /** Table the column belongs to (optional). */
  table?: string;
  /** Table ID in the query context. */
  tableId?: string;
}

/**
 * Cross-filter context value.
 */
export interface CrossFilterContextValue {
  /** Active cross-filters. */
  filters: CrossFilter[];
  /** Add or update a cross-filter from a widget. */
  addFilter: (filter: CrossFilter) => void;
  /** Remove a cross-filter by source widget ID. */
  removeFilter: (sourceWidgetId: string) => void;
  /** Toggle a filter (add if not exists, remove if same value). */
  toggleFilter: (filter: CrossFilter) => void;
  /** Clear all cross-filters. */
  clearFilters: () => void;
  /** Check if a widget has an active filter. */
  hasFilter: (widgetId: string) => boolean;
  /** Get the filter value for a widget. */
  getFilterValue: (widgetId: string) => CrossFilter | undefined;
  /** Check if any filters are active. */
  hasActiveFilters: boolean;
}

// ============================================================================
// Context
// ============================================================================

const CrossFilterContext = createContext<CrossFilterContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface CrossFilterProviderProps {
  children: ReactNode;
}

/**
 * Provider for cross-filter state.
 *
 * Wrap your dashboard or application with this provider to enable
 * cross-filtering between widgets.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <CrossFilterProvider>
 *       <Dashboard id="my-dashboard" />
 *     </CrossFilterProvider>
 *   );
 * }
 * ```
 */
export function CrossFilterProvider({
  children,
}: CrossFilterProviderProps): JSX.Element {
  const [filters, setFilters] = useState<CrossFilter[]>([]);

  const addFilter = useCallback((filter: CrossFilter) => {
    setFilters((prev) => {
      // Replace existing filter from same source widget
      const filtered = prev.filter(
        (f) => f.sourceWidgetId !== filter.sourceWidgetId
      );
      return [...filtered, filter];
    });
  }, []);

  const removeFilter = useCallback((sourceWidgetId: string) => {
    setFilters((prev) =>
      prev.filter((f) => f.sourceWidgetId !== sourceWidgetId)
    );
  }, []);

  const toggleFilter = useCallback((filter: CrossFilter) => {
    setFilters((prev) => {
      const existing = prev.find(
        (f) => f.sourceWidgetId === filter.sourceWidgetId
      );

      // If same value exists, remove it (toggle off)
      if (existing && existing.value === filter.value) {
        return prev.filter((f) => f.sourceWidgetId !== filter.sourceWidgetId);
      }

      // Otherwise add/replace it
      const filtered = prev.filter(
        (f) => f.sourceWidgetId !== filter.sourceWidgetId
      );
      return [...filtered, filter];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const hasFilter = useCallback(
    (widgetId: string) => filters.some((f) => f.sourceWidgetId === widgetId),
    [filters]
  );

  const getFilterValue = useCallback(
    (widgetId: string) => filters.find((f) => f.sourceWidgetId === widgetId),
    [filters]
  );

  const hasActiveFilters = filters.length > 0;

  const value = useMemo(
    (): CrossFilterContextValue => ({
      filters,
      addFilter,
      removeFilter,
      toggleFilter,
      clearFilters,
      hasFilter,
      getFilterValue,
      hasActiveFilters,
    }),
    [
      filters,
      addFilter,
      removeFilter,
      toggleFilter,
      clearFilters,
      hasFilter,
      getFilterValue,
      hasActiveFilters,
    ]
  );

  return (
    <CrossFilterContext.Provider value={value}>
      {children}
    </CrossFilterContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access cross-filter context.
 *
 * @example
 * ```tsx
 * function MyChart({ widgetId }: { widgetId: string }) {
 *   const { toggleFilter, hasFilter } = useCrossFilter();
 *
 *   const handleClick = (value: string) => {
 *     toggleFilter({
 *       sourceWidgetId: widgetId,
 *       column: 'region',
 *       value,
 *     });
 *   };
 *
 *   const isFiltering = hasFilter(widgetId);
 *
 *   return <BarChart onClick={handleClick} highlighted={isFiltering} />;
 * }
 * ```
 */
export function useCrossFilter(): CrossFilterContextValue {
  const context = useContext(CrossFilterContext);
  if (!context) {
    throw new Error('useCrossFilter must be used within CrossFilterProvider');
  }
  return context;
}

/**
 * Hook to optionally access cross-filter context.
 *
 * Returns null if not wrapped in CrossFilterProvider.
 * Use this when cross-filtering is optional.
 */
export function useCrossFilterOptional(): CrossFilterContextValue | null {
  return useContext(CrossFilterContext);
}

/**
 * Hook to get filters that apply to a specific widget.
 *
 * Returns all filters except those originating from this widget.
 *
 * @param widgetId - The widget ID to get filters for.
 */
export function useApplicableFilters(widgetId: string): CrossFilter[] {
  const { filters } = useCrossFilter();
  return useMemo(
    () => filters.filter((f) => f.sourceWidgetId !== widgetId),
    [filters, widgetId]
  );
}
