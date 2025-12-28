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

  // Get the current value for a filter
  const getValue = useCallback(
    (filterId: string): unknown => {
      const filterValue = filterValues.find((fv) => fv.filter_id === filterId);
      if (filterValue) {
        return filterValue.value;
      }

      // Return default value if no current value
      const filter = filters.find((f) => f.id === filterId);
      return filter?.default_value;
    },
    [filterValues, filters]
  );

  // Reset all filters to their defaults
  const resetAll = useCallback(() => {
    for (const filter of filters) {
      setFilterValue(filter.id, filter.default_value);
    }
  }, [filters, setFilterValue]);

  // Reset a single filter to its default
  const resetFilter = useCallback(
    (filterId: string) => {
      const filter = filters.find((f) => f.id === filterId);
      if (filter) {
        setFilterValue(filterId, filter.default_value);
      }
    },
    [filters, setFilterValue]
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
