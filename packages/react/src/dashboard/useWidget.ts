/**
 * Hook to access a single widget's state.
 */

import { useMemo } from 'react';
import { useDashboard } from './useDashboard';
import type { Widget } from './types';
import type { QueryResult } from '../types';

/**
 * Result of the useWidget hook.
 */
export interface UseWidgetResult {
  /** The widget definition. */
  widget: Widget;
  /** Query result for this widget (null if not yet loaded or text widget). */
  result: QueryResult | null;
  /** Whether the widget query is loading. */
  isLoading: boolean;
  /** Error if the query failed. */
  error: Error | null;
  /** Refresh this widget's data. */
  refresh: () => Promise<void>;
}

/**
 * Hook to access a single widget's state.
 *
 * Provides the widget definition, query result, loading state, and refresh function.
 *
 * @param widgetId - ID of the widget to access
 * @returns Widget state and refresh function
 * @throws Error if widget not found
 *
 * @example
 * ```tsx
 * function WidgetDisplay({ widgetId }: { widgetId: string }) {
 *   const { widget, result, isLoading, error, refresh } = useWidget(widgetId);
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <div>
 *       <h3>{widget.title}</h3>
 *       <Chart type={widget.type} data={result} />
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWidget(widgetId: string): UseWidgetResult {
  const {
    dashboard,
    widgetResults,
    widgetErrors,
    widgetLoading,
    refreshWidget,
  } = useDashboard();

  // Find the widget
  const widget = useMemo(() => {
    const found = dashboard?.widgets.find((w) => w.id === widgetId);
    if (!found) {
      throw new Error(`Widget with id "${widgetId}" not found`);
    }
    return found;
  }, [dashboard, widgetId]);

  // Get result, error, and loading state
  const result = widgetResults[widgetId] || null;
  const error = widgetErrors[widgetId] || null;
  const isLoading = widgetLoading[widgetId] || false;

  // Create refresh function
  const refresh = useMemo(() => {
    return () => refreshWidget(widgetId);
  }, [refreshWidget, widgetId]);

  return useMemo(
    () => ({
      widget,
      result,
      isLoading,
      error,
      refresh,
    }),
    [widget, result, isLoading, error, refresh]
  );
}
