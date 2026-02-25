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
  LazyLoadingConfig,
  Widget,
} from './types';
import type { FilterDefinition, QueryDefinition, QueryResult } from '../types';
import {
  dashboardCache,
  CACHE_TTL_MS,
  inflightFetches,
} from './dashboardCache';
import { applyFiltersToQuery } from './applyFiltersToQuery';

/**
 * Dashboard context.
 */
export const DashboardContext = createContext<DashboardContextValue | null>(null);

/**
 * Default batch size for loading widgets.
 */
const DEFAULT_BATCH_SIZE = 8;

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
 * Default lazy loading configuration.
 */
const DEFAULT_LAZY_LOADING: LazyLoadingConfig = {
  enabled: true,
  rootMargin: '200px',
};

/**
 * Provider component for dashboard state management.
 */
export function DashboardProvider({
  dashboardId,
  batchSize = DEFAULT_BATCH_SIZE,
  lazyLoading = DEFAULT_LAZY_LOADING,
  children,
}: DashboardProviderProps): JSX.Element {
  const { client } = useAnalytics();
  const crossFilterContext = useCrossFilterOptional();

  // Lazy loading config with defaults
  const lazyLoadingEnabled = lazyLoading.enabled ?? true;

  // Store lazy loading enabled in ref so setDashboardData can access it
  const lazyLoadingEnabledRef = useRef(lazyLoadingEnabled);
  lazyLoadingEnabledRef.current = lazyLoadingEnabled;

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

  // Visibility tracking for lazy loading
  const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(new Set());
  const [everVisibleWidgets, setEverVisibleWidgets] = useState<Set<string>>(new Set());

  // Track request IDs to avoid stale updates
  const requestIdRef = useRef<string>('');

  // Store client in ref so effect doesn't re-run when client reference changes
  const clientRef = useRef(client);
  clientRef.current = client;

  // Track which dashboard has been loaded to prevent duplicate loads
  const loadedDashboardRef = useRef<string | null>(null);

  // AbortController for canceling in-flight widget queries
  // This prevents connection pool exhaustion when navigating between dashboards
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Helper to set dashboard data and initialize filter defaults.
   */
  const setDashboardData = useCallback((data: Dashboard) => {
    setDashboard(data);
    // Initialize filter values with defaults
    const defaults: FilterValue[] = data.filters
      .filter((f) => f.default_value !== undefined)
      .map((f) => ({
        filter_id: f.id,
        value: f.default_value,
      }));
    setFilterValues(defaults);

    // When lazy loading is DISABLED: Initialize all widgets with loading state
    // so they show spinners until their queries are executed (instead of showing "No Data")
    // When lazy loading is ENABLED: Don't pre-set loading state - let LazyWidget
    // show placeholder until widget becomes visible, then the effect will trigger loading
    if (!lazyLoadingEnabledRef.current) {
      const initialLoadingState: Record<string, boolean> = {};
      data.widgets.forEach((widget) => {
        // Only mark widgets with queries or raw SQL as loading (text widgets don't need it)
        const isSqlMode = widget.config?.data_source_mode === 'sql' && widget.config?.raw_sql;
        if (widget.query || isSqlMode) {
          initialLoadingState[widget.id] = true;
        }
      });
      setWidgetLoading(initialLoadingState);
    }
  }, []);

  /**
   * Execute a single widget query.
   *
   * @param widget - Widget to execute query for
   * @param currentDashboard - Current dashboard
   * @param currentFilters - Current filter values
   * @param currentCrossFilters - Current cross-filter values
   * @param bypassCache - If true, bypass cache and force fresh data
   * @param signal - Optional AbortSignal for cancellation
   */
  const executeWidgetQuery = useCallback(
    async (
      widget: Widget,
      currentDashboard: Dashboard,
      currentFilters: FilterValue[],
      currentCrossFilters: CrossFilter[],
      bypassCache: boolean = false,
      signal?: AbortSignal
    ) => {
      // SQL-mode widgets: use executeSQL with raw_sql
      const isSqlMode = widget.config?.data_source_mode === 'sql' && widget.config?.raw_sql;

      if (!widget.query && !isSqlMode) {
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
        let result;

        if (isSqlMode) {
          // Execute raw SQL for SQL-mode widgets
          result = await client.executeSQL(widget.config.raw_sql!);
        } else {
          // Apply dashboard filters to widget query
          let query = applyFiltersToQuery(
            widget.query!,
            currentDashboard,
            currentFilters
          );

          // Apply cross-filters from other widgets
          query = applyCrossFiltersToQuery(query, currentCrossFilters, widget.id);

          result = await client.executeQuery(query, bypassCache, signal);
        }

        // Don't update state if request was aborted
        if (signal?.aborted) return;

        setWidgetResults((prev) => ({ ...prev, [widget.id]: result }));

        // Update refresh time from cache metadata or current time
        const refreshTime = result.cached_at ?? Date.now() / 1000;
        setWidgetRefreshTimes((prev) => ({ ...prev, [widget.id]: refreshTime }));
      } catch (err) {
        // Don't update state for aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setWidgetErrors((prev) => ({
          ...prev,
          [widget.id]: err instanceof Error ? err : new Error('Query failed'),
        }));
      } finally {
        // Don't update loading state if aborted
        if (signal?.aborted) return;

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
   *
   * @param signal - Optional AbortSignal for cancellation
   */
  const executeWidgetsInBatches = useCallback(
    async (
      widgets: Widget[],
      currentDashboard: Dashboard,
      currentFilters: FilterValue[],
      currentCrossFilters: CrossFilter[],
      bypassCache: boolean = false,
      currentBatchSize: number = batchSize,
      signal?: AbortSignal
    ) => {
      // Filter to widgets that have queries or raw SQL
      const widgetsWithQueries = widgets.filter(
        (w) => w.query !== null || (w.config?.data_source_mode === 'sql' && w.config?.raw_sql)
      );

      // Process in batches
      for (let i = 0; i < widgetsWithQueries.length; i += currentBatchSize) {
        // Check if aborted before processing next batch
        if (signal?.aborted) return;

        const batch = widgetsWithQueries.slice(i, i + currentBatchSize);

        // Execute batch in parallel
        await Promise.all(
          batch.map((widget) =>
            executeWidgetQuery(
              widget,
              currentDashboard,
              currentFilters,
              currentCrossFilters,
              bypassCache,
              signal
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

      // Use the existing abort controller (created per dashboard)
      const signal = abortControllerRef.current?.signal;

      await executeWidgetsInBatches(
        currentDashboard.widgets,
        currentDashboard,
        currentFilters,
        currentCrossFilters,
        false, // Don't bypass cache on initial load
        batchSize,
        signal
      );
    },
    [executeWidgetsInBatches, batchSize]
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

  /**
   * Register a widget's visibility state (for lazy loading).
   */
  const registerVisibility = useCallback((widgetId: string, isVisible: boolean) => {
    if (isVisible) {
      setVisibleWidgets((prev) => {
        if (prev.has(widgetId)) return prev;
        return new Set(prev).add(widgetId);
      });
      setEverVisibleWidgets((prev) => {
        if (prev.has(widgetId)) return prev;
        return new Set(prev).add(widgetId);
      });
    } else {
      setVisibleWidgets((prev) => {
        if (!prev.has(widgetId)) return prev;
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }
  }, []);

  /**
   * Unregister a widget when unmounted (for lazy loading).
   */
  const unregisterVisibility = useCallback((widgetId: string) => {
    setVisibleWidgets((prev) => {
      if (!prev.has(widgetId)) return prev;
      const next = new Set(prev);
      next.delete(widgetId);
      return next;
    });
  }, []);

  // Load dashboard on mount - with safeguards to prevent duplicate requests
  useEffect(() => {
    const currentClient = clientRef.current;

    if (!dashboardId || !currentClient) {
      return;
    }

    // Skip if already loaded this dashboard (instance-level check)
    if (loadedDashboardRef.current === dashboardId) {
      return;
    }

    const now = Date.now();

    // Check module-level cache first (survives StrictMode remounts)
    const cached = dashboardCache.get(dashboardId);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      setError(null);
      loadedDashboardRef.current = dashboardId;
      setDashboardData(cached.data);
      setIsLoading(false);
      return;
    }

    // Track if this effect has been cancelled (dashboardId changed or unmounted)
    let isCancelled = false;

    // Check if there's already an in-flight fetch
    const inflightFetch = inflightFetches.get(dashboardId);
    if (inflightFetch) {
      setIsLoading(true);
      setError(null);
      inflightFetch
        .then((data) => {
          if (isCancelled) return;
          loadedDashboardRef.current = dashboardId;
          setDashboardData(data);
          setIsLoading(false);
        })
        .catch((err) => {
          if (isCancelled) return;
          // Don't set loadedDashboardRef on failure - allows retry
          setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
          setIsLoading(false);
        });
      return () => {
        isCancelled = true;
      };
    }

    // Start a new fetch
    setIsLoading(true);
    setError(null);

    const fetchPromise = (async (): Promise<Dashboard> => {
      const data = await currentClient.get<Dashboard>(`/dashboards/${dashboardId}`);
      // Cache the data at module level (survives StrictMode remounts)
      dashboardCache.set(dashboardId, { data, timestamp: Date.now() });
      return data;
    })();

    // Track the in-flight fetch
    inflightFetches.set(dashboardId, fetchPromise);

    fetchPromise
      .then((data) => {
        inflightFetches.delete(dashboardId);
        if (isCancelled) return;
        // Only mark as loaded on success - allows retry on failure
        loadedDashboardRef.current = dashboardId;
        setDashboardData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        inflightFetches.delete(dashboardId);
        if (isCancelled) return;
        // Don't set loadedDashboardRef on failure - allows retry
        setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [dashboardId, setDashboardData]);

  // Execute widget queries when dashboard loads or filters change
  // Also re-execute when cross-filters change
  const crossFilters = crossFilterContext?.filters ?? [];

  // Track previous cross-filters to detect actual changes
  const prevCrossFiltersRef = useRef<string>('');
  const crossFiltersKey = JSON.stringify(crossFilters);

  // When lazy loading is DISABLED: execute all widgets on load/filter change (original behavior)
  useEffect(() => {
    if (!lazyLoadingEnabled && dashboard && !isLoading) {
      // Track cross-filters key for debugging/future optimization
      prevCrossFiltersRef.current = crossFiltersKey;

      // Execute on initial load or when filters change
      executeAllWidgets(dashboard, filterValues, crossFilters);
    }
  }, [lazyLoadingEnabled, dashboard, filterValues, isLoading, executeAllWidgets, crossFiltersKey, crossFilters]);

  // When lazy loading is ENABLED: execute only visible widgets
  useEffect(() => {
    if (!lazyLoadingEnabled || !dashboard || isLoading) return;

    // Find widgets that:
    // 1. Are currently visible
    // 2. Have a query or raw SQL (not text widgets)
    // 3. Haven't been loaded yet
    // 4. Aren't currently loading
    const widgetsToLoad = dashboard.widgets.filter((w) =>
      visibleWidgets.has(w.id) &&
      (w.query !== null || (w.config?.data_source_mode === 'sql' && w.config?.raw_sql)) &&
      !widgetResults[w.id] &&
      !widgetLoading[w.id]
    );

    if (widgetsToLoad.length > 0) {
      // Use the existing abort controller (created per dashboard)
      const signal = abortControllerRef.current?.signal;

      executeWidgetsInBatches(
        widgetsToLoad,
        dashboard,
        filterValues,
        crossFilters,
        false, // Don't bypass cache
        batchSize,
        signal
      );
    }
  }, [
    lazyLoadingEnabled,
    dashboard,
    isLoading,
    visibleWidgets,
    widgetResults,
    widgetLoading,
    filterValues,
    crossFilters,
    executeWidgetsInBatches,
    batchSize,
  ]);

  // When filters change with lazy loading: re-execute all previously visible widgets
  const filterValuesKey = JSON.stringify(filterValues);
  const prevFilterValuesRef = useRef<string>(filterValuesKey);

  useEffect(() => {
    if (!lazyLoadingEnabled || !dashboard || isLoading) return;

    // Check if filters actually changed
    if (prevFilterValuesRef.current === filterValuesKey) return;
    prevFilterValuesRef.current = filterValuesKey;

    // Re-execute widgets that have been visible (they have data that needs refreshing)
    const widgetsToRefresh = dashboard.widgets.filter((w) =>
      everVisibleWidgets.has(w.id) &&
      (w.query !== null || (w.config?.data_source_mode === 'sql' && w.config?.raw_sql)) &&
      widgetResults[w.id] // Only re-execute if previously loaded
    );

    if (widgetsToRefresh.length > 0) {
      // Cancel previous requests when filters change - we need fresh data
      // Create a new controller so new requests aren't immediately aborted
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      executeWidgetsInBatches(
        widgetsToRefresh,
        dashboard,
        filterValues,
        crossFilters,
        false,
        batchSize,
        controller.signal
      );
    }
  }, [
    lazyLoadingEnabled,
    dashboard,
    isLoading,
    filterValuesKey,
    everVisibleWidgets,
    widgetResults,
    filterValues,
    crossFilters,
    executeWidgetsInBatches,
    batchSize,
  ]);

  // Create a single AbortController per dashboard load
  // This controller is used for ALL widget queries and aborted when navigating away
  useEffect(() => {
    // Create new controller for this dashboard
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Cleanup: abort ALL in-flight requests when dashboard changes or component unmounts
    return () => {
      controller.abort();
    };
  }, [dashboardId]);

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
      // Lazy loading
      registerVisibility,
      unregisterVisibility,
      lazyLoadingEnabled,
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
      registerVisibility,
      unregisterVisibility,
      lazyLoadingEnabled,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}
