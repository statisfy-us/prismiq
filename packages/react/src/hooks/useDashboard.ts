/**
 * useDashboard hook.
 *
 * Fetches a single dashboard by ID from the Prismiq backend.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { Dashboard } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useDashboard hook.
 */
export interface UseDashboardOptions {
  /**
   * Whether to automatically fetch the dashboard on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of the useDashboard hook.
 */
export interface UseDashboardResult {
  /** The dashboard data, or null if not yet loaded. */
  data: Dashboard | null;
  /** Whether the dashboard is currently loading. */
  isLoading: boolean;
  /** Error that occurred during fetch, if any. */
  error: Error | null;
  /** Function to manually refresh the dashboard. */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching a single dashboard by ID.
 *
 * @param dashboardId - The ID of the dashboard to fetch, or null to skip.
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * function DashboardView({ id }: { id: string }) {
 *   const { data, isLoading, error } = useDashboard(id);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *   if (!data) return null;
 *
 *   return (
 *     <div>
 *       <h1>{data.name}</h1>
 *       <p>{data.description}</p>
 *       {data.widgets.map(widget => (
 *         <Widget key={widget.id} widget={widget} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDashboard(
  dashboardId: string | null,
  options: UseDashboardOptions = {}
): UseDashboardResult {
  const { enabled = true } = options;

  const { client } = useAnalytics();

  const [data, setData] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track previous ID to detect changes
  const previousIdRef = useRef<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!enabled || !dashboardId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.getDashboard(dashboardId);
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, dashboardId, enabled]);

  const refetch = useCallback(async () => {
    await fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    // Reset data when ID changes
    if (dashboardId !== previousIdRef.current) {
      previousIdRef.current = dashboardId;

      if (!dashboardId) {
        setData(null);
        setError(null);
        setIsLoading(false);
        return;
      }
    }

    if (enabled && dashboardId) {
      void fetchDashboard();
    }
  }, [dashboardId, enabled, fetchDashboard]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
