/**
 * useDashboardPinStatus hook.
 *
 * Fetches the pin status of a dashboard across contexts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useDashboardPinStatus hook.
 */
export interface UseDashboardPinStatusOptions {
  /**
   * Dashboard ID to check pin status for.
   */
  dashboardId: string;
  /**
   * Optional list of contexts to check.
   * If not provided, fetches all contexts where the dashboard is pinned.
   */
  contexts?: string[];
  /**
   * Whether to automatically fetch on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of the useDashboardPinStatus hook.
 */
export interface UseDashboardPinStatusResult {
  /** List of contexts where the dashboard is pinned, or null if not yet loaded. */
  pinnedContexts: string[] | null;
  /**
   * Check if the dashboard is pinned to a specific context.
   * @param context - Context to check.
   * @returns true if pinned to the context, false otherwise.
   */
  isPinned: (context: string) => boolean;
  /** Whether the data is currently loading. */
  isLoading: boolean;
  /** Error that occurred during fetch, if any. */
  error: Error | null;
  /** Function to manually refresh the pin status. */
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for checking the pin status of a dashboard.
 *
 * @param options - Configuration options including the dashboard ID.
 *
 * @example
 * ```tsx
 * function DashboardPinMenu({ dashboardId }: { dashboardId: string }) {
 *   const { pinnedContexts, isPinned, isLoading } = useDashboardPinStatus({
 *     dashboardId,
 *   });
 *
 *   if (isLoading) return <Loading />;
 *
 *   return (
 *     <ul>
 *       <li>
 *         <Checkbox checked={isPinned('accounts')} />
 *         Accounts
 *       </li>
 *       <li>
 *         <Checkbox checked={isPinned('dashboard')} />
 *         Dashboard
 *       </li>
 *     </ul>
 *   );
 * }
 * ```
 */
export function useDashboardPinStatus(
  options: UseDashboardPinStatusOptions
): UseDashboardPinStatusResult {
  const { dashboardId, enabled = true } = options;

  const { client } = useAnalytics();

  const [pinnedContexts, setPinnedContexts] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPinStatus = useCallback(async () => {
    if (!enabled || !dashboardId) return;

    setIsLoading(true);
    setError(null);

    try {
      const contexts = await client.getDashboardPinContexts(dashboardId);
      setPinnedContexts(contexts);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setPinnedContexts(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, dashboardId, enabled]);

  const refetch = useCallback(async () => {
    await fetchPinStatus();
  }, [fetchPinStatus]);

  const isPinned = useMemo(() => {
    const contextSet = new Set(pinnedContexts ?? []);
    return (context: string): boolean => contextSet.has(context);
  }, [pinnedContexts]);

  useEffect(() => {
    if (enabled && dashboardId) {
      void fetchPinStatus();
    }
  }, [enabled, dashboardId, fetchPinStatus]);

  return {
    pinnedContexts,
    isPinned,
    isLoading,
    error,
    refetch,
  };
}
