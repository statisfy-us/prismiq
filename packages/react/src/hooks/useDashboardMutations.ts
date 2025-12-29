/**
 * useDashboardMutations hook.
 *
 * Provides mutation functions for creating, updating, and deleting dashboards and widgets.
 */

import { useCallback, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type {
  Dashboard,
  DashboardCreate,
  DashboardUpdate,
  Widget,
  WidgetCreate,
  WidgetPositionUpdate,
  WidgetUpdate,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * State for a mutation operation.
 */
export interface MutationState {
  /** Whether a mutation is in progress. */
  isLoading: boolean;
  /** Error from the last mutation, if any. */
  error: Error | null;
}

/**
 * Result of the useDashboardMutations hook.
 */
export interface UseDashboardMutationsResult {
  /** Current mutation state. */
  state: MutationState;

  // Dashboard mutations
  /** Create a new dashboard. */
  createDashboard: (data: DashboardCreate) => Promise<Dashboard>;
  /** Update an existing dashboard. */
  updateDashboard: (id: string, data: DashboardUpdate) => Promise<Dashboard>;
  /** Delete a dashboard. */
  deleteDashboard: (id: string) => Promise<void>;

  // Widget mutations
  /** Add a widget to a dashboard. */
  addWidget: (dashboardId: string, data: WidgetCreate) => Promise<Widget>;
  /** Update a widget. */
  updateWidget: (
    dashboardId: string,
    widgetId: string,
    data: WidgetUpdate
  ) => Promise<Widget>;
  /** Delete a widget. */
  deleteWidget: (dashboardId: string, widgetId: string) => Promise<void>;
  /** Update widget positions in a dashboard. */
  updateLayout: (
    dashboardId: string,
    positions: WidgetPositionUpdate[]
  ) => Promise<Dashboard>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for dashboard and widget mutations.
 *
 * All mutation functions return promises and update the shared loading/error state.
 *
 * @example
 * ```tsx
 * function DashboardActions() {
 *   const { state, createDashboard, deleteDashboard } = useDashboardMutations();
 *   const { refetch } = useDashboards();
 *
 *   const handleCreate = async () => {
 *     try {
 *       await createDashboard({ name: 'New Dashboard' });
 *       await refetch();
 *     } catch (error) {
 *       // Error is also available in state.error
 *       console.error('Failed to create dashboard:', error);
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleCreate} disabled={state.isLoading}>
 *       {state.isLoading ? 'Creating...' : 'Create Dashboard'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useDashboardMutations(): UseDashboardMutationsResult {
  const { client } = useAnalytics();

  const [state, setState] = useState<MutationState>({
    isLoading: false,
    error: null,
  });

  /**
   * Wrapper for mutation operations that handles loading/error state.
   */
  const withMutation = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setState({ isLoading: true, error: null });
      try {
        const result = await operation();
        setState({ isLoading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ isLoading: false, error });
        throw error;
      }
    },
    []
  );

  // Dashboard mutations
  const createDashboard = useCallback(
    async (data: DashboardCreate): Promise<Dashboard> => {
      return withMutation(() => client.createDashboard(data));
    },
    [client, withMutation]
  );

  const updateDashboard = useCallback(
    async (id: string, data: DashboardUpdate): Promise<Dashboard> => {
      return withMutation(() => client.updateDashboard(id, data));
    },
    [client, withMutation]
  );

  const deleteDashboard = useCallback(
    async (id: string): Promise<void> => {
      return withMutation(() => client.deleteDashboard(id));
    },
    [client, withMutation]
  );

  // Widget mutations
  const addWidget = useCallback(
    async (dashboardId: string, data: WidgetCreate): Promise<Widget> => {
      return withMutation(() => client.addWidget(dashboardId, data));
    },
    [client, withMutation]
  );

  const updateWidget = useCallback(
    async (
      dashboardId: string,
      widgetId: string,
      data: WidgetUpdate
    ): Promise<Widget> => {
      return withMutation(() =>
        client.updateWidget(dashboardId, widgetId, data)
      );
    },
    [client, withMutation]
  );

  const deleteWidget = useCallback(
    async (dashboardId: string, widgetId: string): Promise<void> => {
      return withMutation(() => client.deleteWidget(dashboardId, widgetId));
    },
    [client, withMutation]
  );

  const updateLayout = useCallback(
    async (
      dashboardId: string,
      positions: WidgetPositionUpdate[]
    ): Promise<Dashboard> => {
      return withMutation(() => client.updateLayout(dashboardId, positions));
    },
    [client, withMutation]
  );

  return {
    state,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    addWidget,
    updateWidget,
    deleteWidget,
    updateLayout,
  };
}
