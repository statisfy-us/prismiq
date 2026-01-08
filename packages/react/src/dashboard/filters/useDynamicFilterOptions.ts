/**
 * Hook for fetching dynamic filter options from the database.
 */

import { useState, useEffect, useRef } from 'react';
import { useAnalytics } from '../../context';
import type { FilterOption, DashboardFilter } from '../types';

/**
 * State returned by useDynamicFilterOptions hook.
 */
export interface DynamicFilterOptionsState {
  /** Whether options are loading. */
  isLoading: boolean;
  /** Loaded options. */
  options: FilterOption[];
  /** Error if fetch failed. */
  error: Error | null;
}

/**
 * Hook to fetch dynamic filter options from the database.
 *
 * When a filter has `dynamic: true`, this hook fetches distinct values
 * from the specified table and column using getColumnSample API.
 *
 * @param filter - The filter definition.
 * @param limit - Maximum number of options to fetch (default: 100).
 * @returns Loading state, options, and any error.
 *
 * @example
 * ```tsx
 * function DynamicSelectFilter({ filter }: { filter: DashboardFilter }) {
 *   const { isLoading, options, error } = useDynamicFilterOptions(filter);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <select>
 *       {options.map(opt => (
 *         <option key={opt.value} value={opt.value}>{opt.label}</option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useDynamicFilterOptions(
  filter: DashboardFilter,
  limit: number = 100
): DynamicFilterOptionsState {
  const { client } = useAnalytics();
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Skip if not dynamic or already has static options
    if (!filter.dynamic || (filter.options && filter.options.length > 0)) {
      if (filter.options) {
        setOptions(filter.options);
      }
      return;
    }

    // Skip if missing required fields
    if (!filter.table || !filter.field) {
      console.warn(
        `Dynamic filter "${filter.id}" requires both table and field to be set`
      );
      return;
    }

    // Avoid double fetching
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchOptions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const values = await client.getColumnSample(
          filter.table!,
          filter.field,
          limit
        );

        // Convert values to FilterOption format
        const fetchedOptions: FilterOption[] = values
          .filter((v) => v !== null && v !== undefined)
          .map((v) => {
            const stringValue = String(v);
            return {
              value: stringValue,
              label: stringValue,
            };
          });

        setOptions(fetchedOptions);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load options'));
        // Fall back to static options if available
        if (filter.options) {
          setOptions(filter.options);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [client, filter, limit]);

  return { isLoading, options, error };
}
