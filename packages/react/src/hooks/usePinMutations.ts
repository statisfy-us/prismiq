/**
 * usePinMutations hook.
 *
 * Provides functions for pin/unpin/reorder operations.
 */

import { useCallback, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { PinnedDashboard } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Mutation state for pin operations.
 */
export interface PinMutationState {
  /** Whether a mutation is in progress. */
  isLoading: boolean;
  /** Error that occurred during the last mutation, if any. */
  error: Error | null;
}

/**
 * Result of the usePinMutations hook.
 */
export interface UsePinMutationsResult {
  /** Current mutation state. */
  state: PinMutationState;
  /**
   * Pin a dashboard to a context.
   * @param dashboardId - Dashboard ID to pin.
   * @param context - Context to pin to (e.g., "accounts").
   * @param position - Optional position in the list.
   * @returns The created pin entry.
   */
  pin: (
    dashboardId: string,
    context: string,
    position?: number
  ) => Promise<PinnedDashboard>;
  /**
   * Unpin a dashboard from a context.
   * @param dashboardId - Dashboard ID to unpin.
   * @param context - Context to unpin from.
   */
  unpin: (dashboardId: string, context: string) => Promise<void>;
  /**
   * Reorder pinned dashboards in a context.
   * @param context - Context to reorder pins in.
   * @param dashboardIds - Ordered list of dashboard IDs.
   */
  reorder: (context: string, dashboardIds: string[]) => Promise<void>;
  /** Clear the error state. */
  clearError: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for pin/unpin/reorder operations.
 *
 * @example
 * ```tsx
 * function PinButton({ dashboardId }: { dashboardId: string }) {
 *   const { pin, unpin, state } = usePinMutations();
 *   const [isPinned, setIsPinned] = useState(false);
 *
 *   const handleClick = async () => {
 *     if (isPinned) {
 *       await unpin(dashboardId, 'accounts');
 *       setIsPinned(false);
 *     } else {
 *       await pin(dashboardId, 'accounts');
 *       setIsPinned(true);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={state.isLoading}>
 *       {isPinned ? 'Unpin' : 'Pin'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePinMutations(): UsePinMutationsResult {
  const { client } = useAnalytics();

  const [state, setState] = useState<PinMutationState>({
    isLoading: false,
    error: null,
  });

  const pin = useCallback(
    async (
      dashboardId: string,
      context: string,
      position?: number
    ): Promise<PinnedDashboard> => {
      setState({ isLoading: true, error: null });

      try {
        const result = await client.pinDashboard(dashboardId, context, position);
        setState({ isLoading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ isLoading: false, error });
        throw error;
      }
    },
    [client]
  );

  const unpin = useCallback(
    async (dashboardId: string, context: string): Promise<void> => {
      setState({ isLoading: true, error: null });

      try {
        await client.unpinDashboard(dashboardId, context);
        setState({ isLoading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ isLoading: false, error });
        throw error;
      }
    },
    [client]
  );

  const reorder = useCallback(
    async (context: string, dashboardIds: string[]): Promise<void> => {
      setState({ isLoading: true, error: null });

      try {
        await client.reorderPins(context, dashboardIds);
        setState({ isLoading: false, error: null });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ isLoading: false, error });
        throw error;
      }
    },
    [client]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    pin,
    unpin,
    reorder,
    clearError,
  };
}
