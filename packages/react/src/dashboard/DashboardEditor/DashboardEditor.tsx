/**
 * Dashboard editor component for creating and editing dashboards.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../theme';
import { useAnalytics } from '../../context';
import { useSchema } from '../../hooks';
import { DashboardLayout } from '../DashboardLayout';
import { Widget, WidgetContainer } from '../Widget';
import { EditorToolbar } from './EditorToolbar';
import { WidgetEditorPage } from './WidgetEditorPage';
import { FilterEditor } from './FilterEditor';
import {
  dashboardCache,
  CACHE_TTL_MS,
  inflightFetches,
} from '../dashboardCache';
import { applyFiltersToQuery } from '../applyFiltersToQuery';
import type {
  Dashboard,
  DashboardFilter,
  FilterValue,
  Widget as WidgetType,
  WidgetType as WidgetTypeEnum,
  WidgetPosition,
  DashboardEditorProps,
} from '../types';
import type { QueryResult } from '../../types';

/**
 * Generate a unique ID (UUID v4).
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get default position for a new widget.
 */
function getDefaultPosition(
  widgets: WidgetType[],
  widgetType: WidgetTypeEnum
): WidgetPosition {
  // Find the next available Y position
  const maxY = widgets.reduce(
    (max, w) => Math.max(max, w.position.y + w.position.h),
    0
  );

  // Default sizes based on widget type
  const sizes: Record<WidgetTypeEnum, { w: number; h: number }> = {
    metric: { w: 3, h: 2 },
    bar_chart: { w: 6, h: 4 },
    line_chart: { w: 6, h: 4 },
    area_chart: { w: 6, h: 4 },
    pie_chart: { w: 4, h: 4 },
    scatter_chart: { w: 6, h: 4 },
    table: { w: 12, h: 4 },
    text: { w: 4, h: 2 },
  };

  const size = sizes[widgetType] || { w: 4, h: 4 };

  return {
    x: 0,
    y: maxY,
    w: size.w,
    h: size.h,
    minW: 2,
    minH: 2,
  };
}

/**
 * Dashboard editor for creating and editing dashboards.
 *
 * @example
 * ```tsx
 * <DashboardEditor
 *   dashboardId="my-dashboard"
 *   onSave={(dashboard) => console.log('Saved:', dashboard)}
 *   onCancel={() => navigate('/dashboards')}
 * />
 * ```
 */
const DEFAULT_BATCH_SIZE = 4;

export function DashboardEditor({
  dashboardId,
  onSave,
  onCancel,
  batchSize = DEFAULT_BATCH_SIZE,
  className = '',
}: DashboardEditorProps): JSX.Element {
  const { theme } = useTheme();
  const { client } = useAnalytics();
  const { schema } = useSchema();

  // Dashboard state
  const [currentDashboardId, setCurrentDashboardId] = useState<string | undefined>(dashboardId);

  // Keep currentDashboardId in sync when the prop changes
  useEffect(() => {
    setCurrentDashboardId(dashboardId);
  }, [dashboardId]);

  const [dashboard, setDashboard] = useState<Dashboard>({
    id: dashboardId || generateId(),
    name: 'New Dashboard',
    description: '',
    layout: {
      columns: 12,
      row_height: 60,
      margin: [16, 16],
      compact_type: 'vertical',
    },
    widgets: [],
    filters: [],
    is_public: false,
  });

  const [isLoading, setIsLoading] = useState(!!dashboardId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Widget results (for preview)
  const [widgetResults, setWidgetResults] = useState<
    Record<string, QueryResult>
  >({});
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [widgetErrors, setWidgetErrors] = useState<Record<string, Error>>({});
  const [widgetRefreshTimes, setWidgetRefreshTimes] = useState<Record<string, number>>({});
  const [refreshingWidgets, setRefreshingWidgets] = useState<Set<string>>(new Set());

  // Filter values - initialized from dashboard filter defaults, used to apply filters to widget queries
  const [filterValues, setFilterValues] = useState<FilterValue[]>([]);

  // UI state - editingWidget can be 'new' for new widget, a Widget for editing, or null
  const [editingWidget, setEditingWidget] = useState<WidgetType | 'new' | null>(null);
  const [editingFilters, setEditingFilters] = useState(false);

  // Track changes explicitly with a dirty flag (more reliable than JSON comparison)
  const [isDirty, setIsDirty] = useState(false);

  // Track if initial layout has been set (react-grid-layout fires onLayoutChange on mount)
  // Use a counter instead of boolean to ignore multiple initial layout events
  const initialLayoutCountRef = useRef(0);
  const INITIAL_LAYOUT_IGNORE_COUNT = 3; // Ignore first N layout changes after load

  // Store client in ref so effect doesn't re-run when client reference changes
  const clientRef = useRef(client);
  clientRef.current = client;

  // Track which dashboard has been loaded to prevent duplicate loads
  const loadedDashboardRef = useRef<string | null>(null);


  // Helper to execute widget queries - can be called from multiple paths
  // Note: We don't cancel widget query results - they're harmless to set even after unmount
  // and StrictMode would otherwise prevent results from ever being shown
  const executeWidgetQueries = useCallback(async (
    widgets: WidgetType[],
    currentClient: typeof client,
    currentDashboard: Dashboard,
    currentFilterValues: FilterValue[]
  ) => {
    const widgetsWithQueries = widgets.filter(
      (w) => w.query || (w.config?.data_source_mode === 'sql' && w.config?.raw_sql)
    );
    if (widgetsWithQueries.length === 0) return;

    for (let i = 0; i < widgetsWithQueries.length; i += batchSize) {
      const batch = widgetsWithQueries.slice(i, i + batchSize);

      setWidgetLoading((prev) => {
        const next = { ...prev };
        batch.forEach((w) => { next[w.id] = true; });
        return next;
      });

      await Promise.all(
        batch.map(async (widget) => {
          try {
            const isSqlMode = widget.config?.data_source_mode === 'sql' && widget.config?.raw_sql;
            let result;
            if (isSqlMode) {
              result = await currentClient.executeSQL(widget.config.raw_sql!);
            } else {
              // Apply dashboard filters to the widget query
              const query = applyFiltersToQuery(widget.query!, currentDashboard, currentFilterValues);
              result = await currentClient.executeQuery(query);
            }
            setWidgetResults((prev) => ({ ...prev, [widget.id]: result }));
            setWidgetRefreshTimes((prev) => ({ ...prev, [widget.id]: Math.floor(Date.now() / 1000) }));
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Query failed';
            setWidgetErrors((prev) => ({
              ...prev,
              [widget.id]: new Error(`${widget.title}: ${errorMessage}`),
            }));
          } finally {
            setWidgetLoading((prev) => ({ ...prev, [widget.id]: false }));
          }
        })
      );
    }
  }, [batchSize]);

  // Compute default filter values from dashboard filter definitions
  const getDefaultFilterValues = useCallback((data: Dashboard): FilterValue[] => {
    return data.filters
      .filter((f) => f.default_value !== undefined)
      .map((f) => ({ filter_id: f.id, value: f.default_value }));
  }, []);

  // Load existing dashboard - only re-run when dashboardId changes
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
      loadedDashboardRef.current = dashboardId;
      setDashboard(cached.data);
      const defaults = getDefaultFilterValues(cached.data);
      setFilterValues(defaults);
      setIsDirty(false);
      initialLayoutCountRef.current = 0;
      setIsLoading(false);
      // Execute widget queries with cached data and filter defaults applied
      executeWidgetQueries(cached.data.widgets, currentClient, cached.data, defaults);
      return;
    }

    // Check if there's already an in-flight fetch
    const inflightFetch = inflightFetches.get(dashboardId);
    if (inflightFetch) {
      loadedDashboardRef.current = dashboardId;
      setIsLoading(true);
      inflightFetch
        .then((data) => {
          setDashboard(data);
          const defaults = getDefaultFilterValues(data);
          setFilterValues(defaults);
          setIsDirty(false);
          initialLayoutCountRef.current = 0;
          setIsLoading(false);
          executeWidgetQueries(data.widgets, currentClient, data, defaults);
        })
        .catch((err) => {
          console.error(`[DashboardEditor] In-flight fetch error:`, err);
          setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
          setIsLoading(false);
        });
      return;
    }

    // Start a new fetch
    loadedDashboardRef.current = dashboardId;

    const fetchPromise = (async (): Promise<Dashboard> => {
      setIsLoading(true);
      setError(null);

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
        setDashboard(data);
        const defaults = getDefaultFilterValues(data);
        setFilterValues(defaults);
        setIsDirty(false);
        initialLayoutCountRef.current = 0;
        setIsLoading(false);
        executeWidgetQueries(data.widgets, currentClient, data, defaults);
      })
      .catch((err) => {
        inflightFetches.delete(dashboardId);
        setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
        setIsLoading(false);
      });
  }, [dashboardId, batchSize, executeWidgetQueries, getDefaultFilterValues]); // Removed client - using ref instead

  // Execute widget queries for preview
  // Accepts optional widget parameter to avoid stale closure issues when widget was just added
  const refreshWidget = useCallback(
    async (widgetId: string, widgetOverride?: WidgetType) => {
      const widget = widgetOverride ?? dashboard.widgets.find((w) => w.id === widgetId);
      const isSqlMode = widget?.config?.data_source_mode === 'sql' && widget?.config?.raw_sql;
      if ((!widget?.query && !isSqlMode) || !client) return;

      setWidgetLoading((prev) => ({ ...prev, [widgetId]: true }));
      setRefreshingWidgets((prev) => new Set(prev).add(widgetId));

      try {
        let result;
        if (isSqlMode) {
          result = await client.executeSQL(widget!.config.raw_sql!);
        } else {
          // Apply dashboard filters to the widget query
          const query = applyFiltersToQuery(widget!.query!, dashboard, filterValues);
          // Pass bypassCache=true to force fresh data on manual refresh
          result = await client.executeQuery(query, true);
        }
        setWidgetResults((prev) => ({ ...prev, [widgetId]: result }));
        setWidgetRefreshTimes((prev) => ({ ...prev, [widgetId]: Math.floor(Date.now() / 1000) }));
        setWidgetErrors((prev) => {
          const next = { ...prev };
          delete next[widgetId];
          return next;
        });
      } catch (err) {
        setWidgetErrors((prev) => ({
          ...prev,
          [widgetId]: err instanceof Error ? err : new Error('Query failed'),
        }));
      } finally {
        setWidgetLoading((prev) => ({ ...prev, [widgetId]: false }));
        setRefreshingWidgets((prev) => {
          const next = new Set(prev);
          next.delete(widgetId);
          return next;
        });
      }
    },
    [dashboard, filterValues, client]
  );

  // Add new widget - opens the full-page editor
  const handleAddWidget = useCallback(() => {
    setEditingWidget('new');
  }, []);

  // Update widget
  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetType>) => {
    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, ...updates } : w
      ),
    }));
    setIsDirty(true);
  }, []);

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (positions: Record<string, WidgetPosition>) => {
      // Skip initial layout changes fired by react-grid-layout on mount/load
      // react-grid-layout can fire multiple onLayoutChange events during initial render
      if (initialLayoutCountRef.current < INITIAL_LAYOUT_IGNORE_COUNT) {
        initialLayoutCountRef.current++;
        return;
      }

      setDashboard((prev) => ({
        ...prev,
        widgets: prev.widgets.map((widget) => ({
          ...widget,
          position: positions[widget.id] || widget.position,
        })),
      }));
      setIsDirty(true);
    },
    []
  );

  // Save dashboard
  const handleSave = useCallback(async () => {
    if (!client) return;

    setIsSaving(true);
    setError(null);
    try {
      let savedDashboard: Dashboard;

      if (currentDashboardId) {
        // Update existing dashboard
        await client.patch(`/dashboards/${currentDashboardId}`, dashboard);
        // Reload to get canonical state — non-fatal if it fails
        try {
          savedDashboard = await client.get<Dashboard>(`/dashboards/${currentDashboardId}`);
        } catch (reloadErr) {
          console.warn('[DashboardEditor] Reload after save failed, using local state:', reloadErr);
          savedDashboard = dashboard;
        }
        // Refresh shared cache so other components see canonical state
        dashboardCache.set(currentDashboardId, {
          data: savedDashboard,
          timestamp: Date.now(),
        });
        inflightFetches.delete(currentDashboardId);
      } else {
        // Create new dashboard - use the response which contains the server-generated ID
        savedDashboard = await client.post<Dashboard>('/dashboards', dashboard);
        // Persist the canonical ID so subsequent saves use PUT/PATCH
        setCurrentDashboardId(savedDashboard.id);
        // Update the shared cache with the canonical response
        dashboardCache.set(savedDashboard.id, {
          data: savedDashboard,
          timestamp: Date.now(),
        });
        // Clear any inflight fetch entry for the new ID
        inflightFetches.delete(savedDashboard.id);
      }

      setDashboard(savedDashboard);
      initialLayoutCountRef.current = 0;
      setIsDirty(false);
      onSave?.(savedDashboard);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save dashboard'));
    } finally {
      setIsSaving(false);
    }
  }, [client, currentDashboardId, dashboard, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onCancel?.();
  }, [isDirty, onCancel]);

  // Handle widget save from editor (new or existing)
  const handleWidgetSave = useCallback((widget: WidgetType) => {
    // Check if this is a new widget or editing existing
    const existingWidget = dashboard.widgets.find((w) => w.id === widget.id);

    let savedWidget: WidgetType;
    if (existingWidget) {
      // Update existing widget
      updateWidget(widget.id, widget);
      savedWidget = widget;
    } else {
      // Add new widget with proper position
      const position = getDefaultPosition(dashboard.widgets, widget.type);
      savedWidget = { ...widget, position };
      setDashboard((prev) => ({
        ...prev,
        widgets: [...prev.widgets, savedWidget],
      }));
    }

    setIsDirty(true); // Mark as dirty when widget is added/edited
    setEditingWidget(null);

    // Refresh widget data if it has a query
    // Pass the widget directly to avoid stale closure issues
    if (savedWidget.query) {
      refreshWidget(savedWidget.id, savedWidget);
    }
  }, [dashboard.widgets, updateWidget, refreshWidget]);

  // Handle widget delete
  const handleDeleteWidget = useCallback((widgetId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this widget?');
    if (!confirmed) return;

    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));

    // Clean up per-widget caches
    setWidgetResults((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
    setWidgetLoading((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
    setWidgetErrors((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
    setWidgetRefreshTimes((prev) => { const next = { ...prev }; delete next[widgetId]; return next; });
    setRefreshingWidgets((prev) => {
      const next = new Set(prev);
      next.delete(widgetId);
      return next;
    });

    setIsDirty(true);
  }, []);

  // Handle widget duplicate
  const handleDuplicateWidget = useCallback((widgetId: string) => {
    let duplicatedWidget: WidgetType | null = null;

    setDashboard((prev) => {
      const widget = prev.widgets.find((w) => w.id === widgetId);
      if (!widget) {
        console.warn(`[DashboardEditor] Cannot duplicate widget: '${widgetId}' not found`);
        return prev;
      }

      const newWidget: WidgetType = {
        ...widget,
        id: generateId(),
        title: `${widget.title} (copy)`,
        position: getDefaultPosition(prev.widgets, widget.type),
      };
      duplicatedWidget = newWidget;

      return { ...prev, widgets: [...prev.widgets, newWidget] };
    });

    if (duplicatedWidget) {
      setIsDirty(true);
      // Execute query for duplicated widget if it has one
      // Pass the widget directly to avoid stale closure issues
      if ((duplicatedWidget as WidgetType).query) {
        refreshWidget((duplicatedWidget as WidgetType).id, duplicatedWidget as WidgetType);
      }
    }
  }, [refreshWidget]);

  // Render widget for layout
  const renderWidget = useCallback(
    (widget: WidgetType) => (
      <WidgetContainer
        widget={widget}
        dashboardId={dashboard.id}
        editable={true}
        onEdit={(w) => setEditingWidget(w)}
        onDelete={handleDeleteWidget}
        onDuplicate={handleDuplicateWidget}
      >
        <Widget
          widget={widget}
          result={widgetResults[widget.id] ?? null}
          isLoading={widgetLoading[widget.id] ?? false}
          error={widgetErrors[widget.id]}
          lastRefreshed={widgetRefreshTimes[widget.id]}
          isRefreshing={refreshingWidgets.has(widget.id)}
          onRefresh={() => refreshWidget(widget.id)}
        />
      </WidgetContainer>
    ),
    [dashboard.id, widgetResults, widgetLoading, widgetErrors, widgetRefreshTimes, refreshingWidgets, refreshWidget, handleDeleteWidget, handleDuplicateWidget]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    fontFamily: theme.fonts.sans,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
    width: '100%',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textMuted,
  };

  const errorStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: theme.spacing.md,
    color: theme.colors.error || '#ef4444',
  };

  const errorBannerStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.error ? `${theme.colors.error}20` : '#fef2f2',
    borderBottom: `1px solid ${theme.colors.error || '#ef4444'}`,
    color: theme.colors.error || '#ef4444',
    fontSize: theme.fontSizes.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: theme.spacing.xl,
    textAlign: 'center',
  };

  if (isLoading) {
    return (
      <div className={`prismiq-dashboard-editor ${className}`} style={containerStyle}>
        <div style={loadingStyle}>Loading dashboard...</div>
      </div>
    );
  }

  // Show error state for load failures
  if (error && !dashboard.widgets.length) {
    return (
      <div className={`prismiq-dashboard-editor ${className}`} style={containerStyle}>
        <div style={errorStyle}>
          <div style={{ fontSize: theme.fontSizes.lg, fontWeight: 500 }}>
            Failed to load dashboard
          </div>
          <div style={{ color: theme.colors.textMuted }}>
            {error.message}
          </div>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              // Trigger reload by toggling a dependency
              window.location.reload();
            }}
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: theme.radius.md,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If editing filters, show the filter editor
  if (editingFilters) {
    return (
      <FilterEditor
        filters={dashboard.filters}
        onSave={(filters: DashboardFilter[]) => {
          const updatedDashboard = { ...dashboard, filters };
          setDashboard(updatedDashboard);
          setIsDirty(true);
          setEditingFilters(false);

          // Compute new filter values from updated defaults and re-execute all widget queries
          const newFilterValues = getDefaultFilterValues(updatedDashboard);
          setFilterValues(newFilterValues);
          if (client && updatedDashboard.widgets.length > 0) {
            executeWidgetQueries(updatedDashboard.widgets, client, updatedDashboard, newFilterValues);
          }
        }}
        onCancel={() => setEditingFilters(false)}
      />
    );
  }

  // If editing a widget, show the full-page editor instead
  if (editingWidget !== null) {
    return (
      <WidgetEditorPage
        widget={editingWidget === 'new' ? null : editingWidget}
        schema={schema}
        onSave={handleWidgetSave}
        onCancel={() => setEditingWidget(null)}
      />
    );
  }

  return (
    <div className={`prismiq-dashboard-editor ${className}`} style={containerStyle}>
      <EditorToolbar
        dashboardName={dashboard.name}
        onNameChange={(name) => {
          setDashboard((prev) => ({ ...prev, name }));
          setIsDirty(true);
        }}
        hasChanges={isDirty}
        isSaving={isSaving}
        onAddWidget={handleAddWidget}
        onEditFilters={() => setEditingFilters(true)}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {error && (
        <div style={errorBannerStyle}>
          <span>{error.message}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: theme.spacing.xs,
              color: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={contentStyle}>
        {dashboard.widgets.length === 0 ? (
          <div style={emptyStyle}>
            <div
              style={{
                fontSize: '48px',
                marginBottom: theme.spacing.md,
                opacity: 0.5,
              }}
            >
              +
            </div>
            <div
              style={{
                fontSize: theme.fontSizes.lg,
                color: theme.colors.text,
                marginBottom: theme.spacing.sm,
              }}
            >
              No widgets yet
            </div>
            <div
              style={{
                fontSize: theme.fontSizes.sm,
                color: theme.colors.textMuted,
                marginBottom: theme.spacing.lg,
              }}
            >
              Click &quot;Add Widget&quot; to get started
            </div>
          </div>
        ) : (
          <DashboardLayout
            widgets={dashboard.widgets}
            layout={dashboard.layout}
            editable={true}
            onLayoutChange={handleLayoutChange}
            renderWidget={renderWidget}
          />
        )}
      </div>
    </div>
  );
}
