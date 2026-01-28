/**
 * usePinnedDashboards hook.
 *
 * Fetches dashboards pinned to a specific context.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { Dashboard, PinnedDashboard } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the usePinnedDashboards hook.
 */
export interface UsePinnedDashboardsOptions {
  /**
   * Context to get pinned dashboards for (e.g., "accounts", "dashboard").
   */
  context: string;
  /**
   * Whether to automatically fetch on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of the usePinnedDashboards hook.
 */
export interface UsePinnedDashboardsResult {
  /** The list of pinned dashboards, or null if not yet loaded. */
  dashboards: Dashboard[] | null;
  /** Pin metadata for each dashboard. */
  pins: PinnedDashboard[] | null;
  /** Whether the data is currently loading. */
  isLoading: boolean;
  /** Error that occurred during fetch, if any. */
  error: Error | null;
  /** Function to manually refresh the pinned dashboards. */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching dashboards pinned to a context.
 *
 * @param options - Configuration options including the context.
 *
 * @example
 * ```tsx
 * function AccountsPinnedDashboards() {
 *   const { dashboards, isLoading, error } = usePinnedDashboards({
 *     context: 'accounts',
 *   });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {dashboards?.map(d => (
 *         <li key={d.id}>{d.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function usePinnedDashboards(
  options: UsePinnedDashboardsOptions
): UsePinnedDashboardsResult {
  const { context, enabled = true } = options;

  const { client } = useAnalytics();

  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null);
  const [pins, setPins] = useState<PinnedDashboard[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPinnedDashboards = useCallback(async () => {
    if (!enabled || !context) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.getPinnedDashboards(context);
      setDashboards(result.dashboards);
      setPins(result.pins);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setDashboards(null);
      setPins(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, context, enabled]);

  const refetch = useCallback(async () => {
    await fetchPinnedDashboards();
  }, [fetchPinnedDashboards]);

  useEffect(() => {
    if (enabled && context) {
      void fetchPinnedDashboards();
    }
  }, [enabled, context, fetchPinnedDashboards]);

  return {
    dashboards,
    pins,
    isLoading,
    error,
    refetch,
  };
}
