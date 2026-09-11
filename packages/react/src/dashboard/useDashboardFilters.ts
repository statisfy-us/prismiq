/**
 * Hook to manage dashboard filter state.
 */

import { useCallback, useMemo } from 'react';
import { useDashboard } from './useDashboard';
import type { DashboardFilter, FilterValue } from './types';

/**
 * Result of the useDashboardFilters hook.
 */
export interface UseDashboardFiltersResult {
  /** All dashboard filters. */
  filters: DashboardFilter[];
  /** Current filter values. */
  values: FilterValue[];
  /** Set a filter value. */
  setValue: (filterId: string, value: unknown) => void;
  /** Reset all filters to defaults. */
  resetAll: () => void;
  /** Reset a single filter to its default. */
  resetFilter: (filterId: string) => void;
  /** Get the current value for a filter. */
  getValue: (filterId: string) => unknown;
}

/**
 * Hook to manage dashboard filter state.
 *
 * Provides convenient methods for working with dashboard filters.
 *
 * @returns Filter management utilities
 *
 * @example
 * ```tsx
 * function FilterControls() {
 *   const { filters, values, setValue, resetAll, getValue } = useDashboardFilters();
 *
 *   return (
 *     <div>
 *       {filters.map((filter) => (
 *         <FilterInput
 *           key={filter.id}
 *           filter={filter}
 *           value={getValue(filter.id)}
 *           onChange={(v) => setValue(filter.id, v)}
 *         />
 *       ))}
 *       <button onClick={resetAll}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboardFilters(): UseDashboardFiltersResult {
  const { dashboard, filterValues, setFilterValue } = useDashboard();

  // Get all filters from the dashboard
  const filters = useMemo(() => {
    return dashboard?.filters || [];
  }, [dashboard]);

  // Default value for a filter: explicit default_value, else a date filter's
  // preset (resolved server-side against the tenant's fiscal calendar).
  const defaultFor = useCallback((filter: DashboardFilter | undefined): unknown => {
    if (!filter) return undefined;
    if (filter.default_value !== undefined && filter.default_value !== null) {
      return filter.default_value;
    }
    if (filter.type === 'date_range' && filter.date_preset) {
      return { preset: filter.date_preset };
    }
    return filter.default_value;
  }, []);

  // Get the current value for a filter
  const getValue = useCallback(
    (filterId: string): unknown => {
      const filterValue = filterValues.find((fv) => fv.filter_id === filterId);
      if (filterValue) {
        return filterValue.value;
      }

      // Return default value if no current value
      const filter = filters.find((f) => f.id === filterId);
      return defaultFor(filter);
    },
    [filterValues, filters, defaultFor]
  );

  // Reset all filters to their defaults
  const resetAll = useCallback(() => {
    for (const filter of filters) {
      setFilterValue(filter.id, defaultFor(filter));
    }
  }, [filters, setFilterValue, defaultFor]);

  // Reset a single filter to its default
  const resetFilter = useCallback(
    (filterId: string) => {
      const filter = filters.find((f) => f.id === filterId);
      if (filter) {
        setFilterValue(filterId, defaultFor(filter));
      }
    },
    [filters, setFilterValue, defaultFor]
  );

  return useMemo(
    () => ({
      filters,
      values: filterValues,
      setValue: setFilterValue,
      resetAll,
      resetFilter,
      getValue,
    }),
    [filters, filterValues, setFilterValue, resetAll, resetFilter, getValue]
  );
}
