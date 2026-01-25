/**
 * Dashboard editor component for creating and editing dashboards.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../theme';
import { useAnalytics } from '../../context';
import { useSchema } from '../../hooks';
import { DashboardLayout } from '../DashboardLayout';
import { Widget } from '../Widget';
import { EditorToolbar } from './EditorToolbar';
import { WidgetEditorPage } from './WidgetEditorPage';
import type {
  Dashboard,
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
export function DashboardEditor({
  dashboardId,
  onSave,
  onCancel,
  className = '',
}: DashboardEditorProps): JSX.Element {
  const { theme } = useTheme();
  const { client } = useAnalytics();
  const { schema } = useSchema();

  // Dashboard state
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

  // UI state - editingWidget can be 'new' for new widget, a Widget for editing, or null
  const [editingWidget, setEditingWidget] = useState<WidgetType | 'new' | null>(null);

  // Track changes explicitly with a dirty flag (more reliable than JSON comparison)
  const [isDirty, setIsDirty] = useState(false);

  // Track if initial layout has been set (react-grid-layout fires onLayoutChange on mount)
  const isInitialLayoutRef = useRef(true);

  // Load existing dashboard
  useEffect(() => {
    if (!dashboardId || !client) return;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await client.get<Dashboard>(`/dashboards/${dashboardId}`);
        setDashboard(data);
        setIsDirty(false);
        isInitialLayoutRef.current = true;

        // Execute queries for all widgets in parallel
        const widgetsWithQueries = data.widgets.filter((w) => w.query);
        if (widgetsWithQueries.length > 0) {
          // Set all to loading
          setWidgetLoading((prev) => {
            const next = { ...prev };
            widgetsWithQueries.forEach((w) => { next[w.id] = true; });
            return next;
          });

          // Execute all queries in parallel
          await Promise.all(
            widgetsWithQueries.map(async (widget) => {
              try {
                const result = await client.executeQuery(widget.query!);
                setWidgetResults((prev) => ({ ...prev, [widget.id]: result }));
                setWidgetRefreshTimes((prev) => ({ ...prev, [widget.id]: Math.floor(Date.now() / 1000) }));
              } catch (err) {
                setWidgetErrors((prev) => ({
                  ...prev,
                  [widget.id]: err instanceof Error ? err : new Error('Query failed'),
                }));
              } finally {
                setWidgetLoading((prev) => ({ ...prev, [widget.id]: false }));
              }
            })
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [dashboardId, client]);

  // Execute widget queries for preview
  const refreshWidget = useCallback(
    async (widgetId: string) => {
      const widget = dashboard.widgets.find((w) => w.id === widgetId);
      if (!widget?.query || !client) return;

      setWidgetLoading((prev) => ({ ...prev, [widgetId]: true }));
      setRefreshingWidgets((prev) => new Set(prev).add(widgetId));

      try {
        const result = await client.executeQuery(widget.query);
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
    [dashboard.widgets, client]
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
      // Skip the initial layout change fired by react-grid-layout on mount
      if (isInitialLayoutRef.current) {
        isInitialLayoutRef.current = false;
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
      const id = dashboardId || dashboard.id;
      if (dashboardId) {
        await client.patch(`/dashboards/${dashboardId}`, dashboard);
      } else {
        await client.post('/dashboards', dashboard);
      }

      // Reload from server to get canonical state (separate try-catch)
      try {
        const savedDashboard = await client.get<Dashboard>(`/dashboards/${id}`);
        setDashboard(savedDashboard);
        isInitialLayoutRef.current = true;
        onSave?.(savedDashboard);
      } catch {
        // Reload failed but save succeeded - use local state
        onSave?.(dashboard);
      }
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save dashboard'));
    } finally {
      setIsSaving(false);
    }
  }, [client, dashboardId, dashboard, onSave]);

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

    if (existingWidget) {
      // Update existing widget
      updateWidget(widget.id, widget);
    } else {
      // Add new widget with proper position
      const position = getDefaultPosition(dashboard.widgets, widget.type);
      const newWidget = { ...widget, position };
      setDashboard((prev) => ({
        ...prev,
        widgets: [...prev.widgets, newWidget],
      }));
    }

    setIsDirty(true); // Mark as dirty when widget is added/edited
    setEditingWidget(null);

    // Refresh widget data if it has a query
    if (widget.query) {
      refreshWidget(widget.id);
    }
  }, [dashboard.widgets, updateWidget, refreshWidget]);

  // Render widget for layout
  const renderWidget = useCallback(
    (widget: WidgetType) => (
      <Widget
        widget={widget}
        result={widgetResults[widget.id] ?? null}
        isLoading={widgetLoading[widget.id] ?? false}
        error={widgetErrors[widget.id]}
        lastRefreshed={widgetRefreshTimes[widget.id]}
        isRefreshing={refreshingWidgets.has(widget.id)}
        onRefresh={() => refreshWidget(widget.id)}
      />
    ),
    [widgetResults, widgetLoading, widgetErrors, widgetRefreshTimes, refreshingWidgets, refreshWidget]
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
        hasChanges={isDirty}
        isSaving={isSaving}
        onAddWidget={handleAddWidget}
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
