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
import { useAnalytics, useCrossFilterOptional, type CrossFilter } from '../context';
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
 * Default batch size for loading widgets.
 */
const DEFAULT_BATCH_SIZE = 4;

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
 * Apply cross-filters from other widgets to a widget query.
 *
 * Cross-filters are applied only if the widget is not the source of the filter,
 * and if the filter column exists in the widget's query.
 */
function applyCrossFiltersToQuery(
  query: QueryDefinition,
  crossFilters: CrossFilter[],
  widgetId: string
): QueryDefinition {
  // Skip if no cross-filters
  if (crossFilters.length === 0) return query;

  const additionalFilters: FilterDefinition[] = [];

  for (const filter of crossFilters) {
    // Don't apply a widget's own filter to itself
    if (filter.sourceWidgetId === widgetId) continue;

    // Find the table that contains this column
    // First check if filter specifies a table
    let tableId = query.tables[0]?.id || 't1';
    if (filter.table) {
      const matchingTable = query.tables.find((t) => t.name === filter.table);
      if (matchingTable) {
        tableId = matchingTable.id;
      }
    } else if (filter.tableId) {
      // Use provided table ID if available
      tableId = filter.tableId;
    }

    // Build the filter based on value type
    const value = filter.value;
    if (Array.isArray(value) && value.length > 0) {
      additionalFilters.push({
        table_id: tableId,
        column: filter.column,
        operator: 'in_',
        value,
      });
    } else if (value !== null && value !== undefined && value !== '') {
      additionalFilters.push({
        table_id: tableId,
        column: filter.column,
        operator: 'eq',
        value,
      });
    }
  }

  // Merge with existing query filters
  if (additionalFilters.length === 0) return query;

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
  batchSize = DEFAULT_BATCH_SIZE,
  children,
}: DashboardProviderProps): JSX.Element {
  const { client } = useAnalytics();
  const crossFilterContext = useCrossFilterOptional();

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

  // Refresh state
  const [widgetRefreshTimes, setWidgetRefreshTimes] = useState<Record<string, number>>({});
  const [refreshingWidgets, setRefreshingWidgets] = useState<Set<string>>(new Set());

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
   *
   * @param widget - Widget to execute query for
   * @param currentDashboard - Current dashboard
   * @param currentFilters - Current filter values
   * @param currentCrossFilters - Current cross-filter values
   * @param bypassCache - If true, bypass cache and force fresh data
   */
  const executeWidgetQuery = useCallback(
    async (
      widget: Widget,
      currentDashboard: Dashboard,
      currentFilters: FilterValue[],
      currentCrossFilters: CrossFilter[],
      bypassCache: boolean = false
    ) => {
      if (!widget.query) {
        // Text widgets don't have queries
        return;
      }

      // Mark widget as loading (and refreshing if bypassing cache)
      setWidgetLoading((prev) => ({ ...prev, [widget.id]: true }));
      if (bypassCache) {
        setRefreshingWidgets((prev) => new Set(prev).add(widget.id));
      }
      setWidgetErrors((prev) => {
        const next = { ...prev };
        delete next[widget.id];
        return next;
      });

      try {
        // Apply dashboard filters to widget query
        let query = applyFiltersToQuery(
          widget.query,
          currentDashboard,
          currentFilters
        );

        // Apply cross-filters from other widgets
        query = applyCrossFiltersToQuery(query, currentCrossFilters, widget.id);

        const result = await client.executeQuery(query, bypassCache);
        setWidgetResults((prev) => ({ ...prev, [widget.id]: result }));

        // Update refresh time from cache metadata or current time
        const refreshTime = result.cached_at ?? Date.now() / 1000;
        setWidgetRefreshTimes((prev) => ({ ...prev, [widget.id]: refreshTime }));
      } catch (err) {
        setWidgetErrors((prev) => ({
          ...prev,
          [widget.id]: err instanceof Error ? err : new Error('Query failed'),
        }));
      } finally {
        setWidgetLoading((prev) => ({ ...prev, [widget.id]: false }));
        if (bypassCache) {
          setRefreshingWidgets((prev) => {
            const next = new Set(prev);
            next.delete(widget.id);
            return next;
          });
        }
      }
    },
    [client]
  );

  /**
   * Execute widget queries in batches.
   */
  const executeWidgetsInBatches = useCallback(
    async (
      widgets: Widget[],
      currentDashboard: Dashboard,
      currentFilters: FilterValue[],
      currentCrossFilters: CrossFilter[],
      bypassCache: boolean = false,
      currentBatchSize: number = batchSize
    ) => {
      // Filter to widgets that have queries
      const widgetsWithQueries = widgets.filter((w) => w.query !== null);

      // Process in batches
      for (let i = 0; i < widgetsWithQueries.length; i += currentBatchSize) {
        const batch = widgetsWithQueries.slice(i, i + currentBatchSize);

        // Execute batch in parallel
        await Promise.all(
          batch.map((widget) =>
            executeWidgetQuery(
              widget,
              currentDashboard,
              currentFilters,
              currentCrossFilters,
              bypassCache
            )
          )
        );
      }
    },
    [batchSize, executeWidgetQuery]
  );

  /**
   * Execute all widget queries (initial load, uses batching).
   */
  const executeAllWidgets = useCallback(
    async (
      currentDashboard: Dashboard,
      currentFilters: FilterValue[],
      currentCrossFilters: CrossFilter[]
    ) => {
      const requestId = Math.random().toString(36).substring(2, 11);
      requestIdRef.current = requestId;

      await executeWidgetsInBatches(
        currentDashboard.widgets,
        currentDashboard,
        currentFilters,
        currentCrossFilters,
        false // Don't bypass cache on initial load
      );
    },
    [executeWidgetsInBatches]
  );

  /**
   * Refresh the entire dashboard (legacy method, calls refreshAll).
   */
  const refreshDashboard = useCallback(async () => {
    if (!dashboard) return;
    const crossFilters = crossFilterContext?.filters ?? [];
    await executeWidgetsInBatches(
      dashboard.widgets,
      dashboard,
      filterValues,
      crossFilters,
      true, // Bypass cache
      batchSize
    );
  }, [dashboard, filterValues, executeWidgetsInBatches, crossFilterContext?.filters, batchSize]);

  /**
   * Refresh all widgets with configurable batch size (bypasses cache).
   */
  const refreshAll = useCallback(
    async (customBatchSize?: number) => {
      if (!dashboard) return;
      const crossFilters = crossFilterContext?.filters ?? [];
      await executeWidgetsInBatches(
        dashboard.widgets,
        dashboard,
        filterValues,
        crossFilters,
        true, // Bypass cache
        customBatchSize ?? batchSize
      );
    },
    [dashboard, filterValues, executeWidgetsInBatches, crossFilterContext?.filters, batchSize]
  );

  /**
   * Refresh a single widget (bypasses cache).
   */
  const refreshWidget = useCallback(
    async (widgetId: string) => {
      if (!dashboard) return;

      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget) return;

      const crossFilters = crossFilterContext?.filters ?? [];
      await executeWidgetQuery(
        widget,
        dashboard,
        filterValues,
        crossFilters,
        true // Bypass cache
      );
    },
    [dashboard, filterValues, executeWidgetQuery, crossFilterContext?.filters]
  );

  /**
   * Get the oldest widget refresh timestamp.
   */
  const getOldestRefreshTime = useCallback((): number | null => {
    const times = Object.values(widgetRefreshTimes);
    if (times.length === 0) return null;
    return Math.min(...times);
  }, [widgetRefreshTimes]);

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
  // Also re-execute when cross-filters change
  const crossFilters = crossFilterContext?.filters ?? [];
  useEffect(() => {
    if (dashboard && !isLoading) {
      executeAllWidgets(dashboard, filterValues, crossFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, filterValues, isLoading, executeAllWidgets, JSON.stringify(crossFilters)]);

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
      widgetRefreshTimes,
      refreshingWidgets,
      setFilterValue,
      refreshDashboard,
      refreshWidget,
      refreshAll,
      getOldestRefreshTime,
    }),
    [
      dashboard,
      isLoading,
      error,
      filterValues,
      widgetResults,
      widgetErrors,
      widgetLoading,
      widgetRefreshTimes,
      refreshingWidgets,
      setFilterValue,
      refreshDashboard,
      refreshWidget,
      refreshAll,
      getOldestRefreshTime,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}
