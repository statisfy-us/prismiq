/**
 * useDashboards hook.
 *
 * Fetches and manages the list of dashboards from the Prismiq backend.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { Dashboard } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useDashboards hook.
 */
export interface UseDashboardsOptions {
  /**
   * Whether to automatically fetch dashboards on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of the useDashboards hook.
 */
export interface UseDashboardsResult {
  /** The list of dashboards, or null if not yet loaded. */
  data: Dashboard[] | null;
  /** Whether the dashboards are currently loading. */
  isLoading: boolean;
  /** Error that occurred during fetch, if any. */
  error: Error | null;
  /** Function to manually refresh the dashboard list. */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching the list of dashboards.
 *
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * function DashboardList() {
 *   const { data, isLoading, error } = useDashboards();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data?.map(dashboard => (
 *         <li key={dashboard.id}>{dashboard.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDashboards(
  options: UseDashboardsOptions = {}
): UseDashboardsResult {
  const { enabled = true } = options;

  const { client } = useAnalytics();

  const [data, setData] = useState<Dashboard[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboards = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.listDashboards();
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled]);

  const refetch = useCallback(async () => {
    await fetchDashboards();
  }, [fetchDashboards]);

  useEffect(() => {
    if (enabled) {
      void fetchDashboards();
    }
  }, [enabled, fetchDashboards]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
