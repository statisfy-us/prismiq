/**
 * Dashboard context provider for managing dashboard state.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAnalytics } from '../context';
import type {
  Dashboard,
  DashboardContextValue,
  DashboardProviderProps,
  FilterValue,
  Widget,
} from './types';
import type { FilterDefinition, QueryDefinition, QueryResult } from '../types';

/**
 * Dashboard context.
 */
export const DashboardContext = createContext<DashboardContextValue | null>(null);

/**
 * Generate a unique ID for tracking purposes.
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Apply dashboard filter values to a widget query.
 */
function applyFiltersToQuery(
  query: QueryDefinition,
  dashboard: Dashboard,
  filterValues: FilterValue[]
): QueryDefinition {
  // Map filter values by filter ID
  const valueMap = new Map(
    filterValues.map((fv) => [fv.filter_id, fv.value])
  );

  // Build filter definitions from dashboard filters
  const additionalFilters: FilterDefinition[] = [];

  for (const filter of dashboard.filters) {
    const value = valueMap.get(filter.id);
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Find the table ID that matches this filter
    let tableId = query.tables[0]?.id || 't1';
    if (filter.table) {
      const matchingTable = query.tables.find((t) => t.name === filter.table);
      if (matchingTable) {
        tableId = matchingTable.id;
      }
    }

    // Convert filter value to FilterDefinition based on filter type
    switch (filter.type) {
      case 'date_range': {
        const dateValue = value as { start: string; end: string } | string;
        if (typeof dateValue === 'object' && dateValue.start && dateValue.end) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'between',
            value: [dateValue.start, dateValue.end],
          });
        }
        break;
      }
      case 'select':
        additionalFilters.push({
          table_id: tableId,
          column: filter.field,
          operator: 'eq',
          value,
        });
        break;
      case 'multi_select':
        if (Array.isArray(value) && value.length > 0) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'in_',
            value,
          });
        }
        break;
      case 'text':
        additionalFilters.push({
          table_id: tableId,
          column: filter.field,
          operator: 'ilike',
          value: `%${value}%`,
        });
        break;
      case 'number_range': {
        const rangeValue = value as { min: number | null; max: number | null };
        if (rangeValue.min !== null && rangeValue.max !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'between',
            value: [rangeValue.min, rangeValue.max],
          });
        } else if (rangeValue.min !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'gte',
            value: rangeValue.min,
          });
        } else if (rangeValue.max !== null) {
          additionalFilters.push({
            table_id: tableId,
            column: filter.field,
            operator: 'lte',
            value: rangeValue.max,
          });
        }
        break;
      }
    }
  }

  // Merge with existing query filters
  return {
    ...query,
    filters: [...(query.filters || []), ...additionalFilters],
  };
}

/**
 * Provider component for dashboard state management.
 */
export function DashboardProvider({
  dashboardId,
  refreshInterval,
  children,
}: DashboardProviderProps): JSX.Element {
  const { client } = useAnalytics();

  // Dashboard state
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Filter values
  const [filterValues, setFilterValues] = useState<FilterValue[]>([]);

  // Widget results
  const [widgetResults, setWidgetResults] = useState<Record<string, QueryResult>>({});
  const [widgetErrors, setWidgetErrors] = useState<Record<string, Error>>({});
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({});

  // Track request IDs to avoid stale updates
  const requestIdRef = useRef<string>('');

  /**
   * Load dashboard metadata.
   */
  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch dashboard from API using generic get method
      const response = await client.get<Dashboard>(`/dashboards/${dashboardId}`);
      setDashboard(response);

      // Initialize filter values with defaults
      const defaults: FilterValue[] = response.filters
        .filter((f) => f.default_value !== undefined)
        .map((f) => ({
          filter_id: f.id,
          value: f.default_value,
        }));
      setFilterValues(defaults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
    } finally {
      setIsLoading(false);
    }
  }, [client, dashboardId]);

  /**
   * Execute a single widget query.
   */
  const executeWidgetQuery = useCallback(
    async (widget: Widget, currentDashboard: Dashboard, currentFilters: FilterValue[]) => {
      if (!widget.query) {
        // Text widgets don't have queries
        return;
      }

      setWidgetLoading((prev) => ({ ...prev, [widget.id]: true }));
      setWidgetErrors((prev) => {
        const next = { ...prev };
        delete next[widget.id];
        return next;
      });

      try {
        // Apply dashboard filters to widget query
        const filteredQuery = applyFiltersToQuery(
          widget.query,
          currentDashboard,
          currentFilters
        );

        const result = await client.executeQuery(filteredQuery);
        setWidgetResults((prev) => ({ ...prev, [widget.id]: result }));
      } catch (err) {
        setWidgetErrors((prev) => ({
          ...prev,
          [widget.id]: err instanceof Error ? err : new Error('Query failed'),
        }));
      } finally {
        setWidgetLoading((prev) => ({ ...prev, [widget.id]: false }));
      }
    },
    [client]
  );

  /**
   * Execute all widget queries.
   */
  const executeAllWidgets = useCallback(
    async (currentDashboard: Dashboard, currentFilters: FilterValue[]) => {
      const requestId = generateId();
      requestIdRef.current = requestId;

      // Execute all queries in parallel
      await Promise.all(
        currentDashboard.widgets.map((widget) =>
          executeWidgetQuery(widget, currentDashboard, currentFilters)
        )
      );
    },
    [executeWidgetQuery]
  );

  /**
   * Refresh the entire dashboard.
   */
  const refreshDashboard = useCallback(async () => {
    if (!dashboard) return;
    await executeAllWidgets(dashboard, filterValues);
  }, [dashboard, filterValues, executeAllWidgets]);

  /**
   * Refresh a single widget.
   */
  const refreshWidget = useCallback(
    async (widgetId: string) => {
      if (!dashboard) return;

      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget) return;

      await executeWidgetQuery(widget, dashboard, filterValues);
    },
    [dashboard, filterValues, executeWidgetQuery]
  );

  /**
   * Set a filter value.
   */
  const setFilterValue = useCallback((filterId: string, value: unknown) => {
    setFilterValues((prev) => {
      const existing = prev.find((fv) => fv.filter_id === filterId);
      if (existing) {
        return prev.map((fv) =>
          fv.filter_id === filterId ? { ...fv, value } : fv
        );
      }
      return [...prev, { filter_id: filterId, value }];
    });
  }, []);

  // Load dashboard on mount
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Execute widget queries when dashboard loads or filters change
  useEffect(() => {
    if (dashboard && !isLoading) {
      executeAllWidgets(dashboard, filterValues);
    }
  }, [dashboard, filterValues, isLoading, executeAllWidgets]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || !dashboard) return;

    const intervalId = setInterval(() => {
      refreshDashboard();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, dashboard, refreshDashboard]);

  // Context value
  const contextValue = useMemo<DashboardContextValue>(
    () => ({
      dashboard,
      isLoading,
      error,
      filterValues,
      widgetResults,
      widgetErrors,
      widgetLoading,
      setFilterValue,
      refreshDashboard,
      refreshWidget,
    }),
    [
      dashboard,
      isLoading,
      error,
      filterValues,
      widgetResults,
      widgetErrors,
      widgetLoading,
      setFilterValue,
      refreshDashboard,
      refreshWidget,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}
