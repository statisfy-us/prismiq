/**
 * Dashboard editor component for creating and editing dashboards.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '../../theme';
import { useAnalytics } from '../../context';
import { useSchema } from '../../hooks';
import { DashboardLayout } from '../DashboardLayout';
import { Widget } from '../Widget';
import { EditorToolbar } from './EditorToolbar';
import { WidgetPalette } from './WidgetPalette';
import { WidgetEditor } from './WidgetEditor';
import type {
  Dashboard,
  Widget as WidgetType,
  WidgetType as WidgetTypeEnum,
  WidgetPosition,
  DashboardEditorProps,
} from '../types';
import type { QueryResult } from '../../types';

/**
 * Generate a unique ID for new widgets.
 */
function generateId(): string {
  return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  const [originalDashboard, setOriginalDashboard] = useState<Dashboard | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(!!dashboardId);
  const [isSaving, setIsSaving] = useState(false);
  const [, setError] = useState<Error | null>(null);

  // Widget results (for preview)
  const [widgetResults, setWidgetResults] = useState<
    Record<string, QueryResult>
  >({});
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [widgetErrors, setWidgetErrors] = useState<Record<string, Error>>({});

  // UI state
  const [showPalette, setShowPalette] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetType | null>(null);

  // Track changes
  const hasChanges = useMemo(() => {
    if (!originalDashboard) return dashboard.widgets.length > 0;
    return JSON.stringify(dashboard) !== JSON.stringify(originalDashboard);
  }, [dashboard, originalDashboard]);

  // Load existing dashboard
  useEffect(() => {
    if (!dashboardId || !client) return;

    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        const data = await client.get<Dashboard>(`/dashboards/${dashboardId}`);
        setDashboard(data);
        setOriginalDashboard(data);
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

      try {
        const result = await client.executeQuery(widget.query);
        setWidgetResults((prev) => ({ ...prev, [widgetId]: result }));
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
      }
    },
    [dashboard.widgets, client]
  );

  // Add new widget
  const addWidget = useCallback((type: WidgetTypeEnum) => {
    const newWidget: WidgetType = {
      id: generateId(),
      type,
      title: `New ${type.replace('_', ' ')}`,
      query: null,
      position: getDefaultPosition(dashboard.widgets, type),
      config: {},
    };

    setDashboard((prev) => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));

    setShowPalette(false);
    setEditingWidget(newWidget);
  }, [dashboard.widgets]);

  // Update widget
  const updateWidget = useCallback((widgetId: string, updates: Partial<WidgetType>) => {
    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, ...updates } : w
      ),
    }));
  }, []);

  // Remove widget
  const removeWidget = useCallback((widgetId: string) => {
    setDashboard((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));
  }, []);

  // Duplicate widget
  const duplicateWidget = useCallback((widgetId: string) => {
    const widget = dashboard.widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const newWidget: WidgetType = {
      ...widget,
      id: generateId(),
      title: `${widget.title} (copy)`,
      position: {
        ...widget.position,
        y: widget.position.y + widget.position.h,
      },
    };

    setDashboard((prev) => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));
  }, [dashboard.widgets]);

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (positions: Record<string, WidgetPosition>) => {
      setDashboard((prev) => ({
        ...prev,
        widgets: prev.widgets.map((widget) => ({
          ...widget,
          position: positions[widget.id] || widget.position,
        })),
      }));
    },
    []
  );

  // Save dashboard
  const handleSave = useCallback(async () => {
    if (!client) return;

    setIsSaving(true);
    try {
      if (dashboardId) {
        await client.put(`/dashboards/${dashboardId}`, dashboard);
      } else {
        await client.post('/dashboards', dashboard);
      }
      setOriginalDashboard(dashboard);
      onSave?.(dashboard);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save dashboard'));
    } finally {
      setIsSaving(false);
    }
  }, [client, dashboardId, dashboard, onSave]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (hasChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to cancel?'
      );
      if (!confirmed) return;
    }
    onCancel?.();
  }, [hasChanges, onCancel]);

  // Handle widget save from editor
  const handleWidgetSave = useCallback((widget: WidgetType) => {
    updateWidget(widget.id, widget);
    setEditingWidget(null);

    // Refresh widget data if it has a query
    if (widget.query) {
      refreshWidget(widget.id);
    }
  }, [updateWidget, refreshWidget]);

  // Render widget for layout
  const renderWidget = useCallback(
    (widget: WidgetType) => (
      <Widget
        widget={widget}
        result={widgetResults[widget.id] ?? null}
        isLoading={widgetLoading[widget.id] ?? false}
        error={widgetErrors[widget.id]}
        editable={true}
        onEdit={() => setEditingWidget(widget)}
        onRemove={() => removeWidget(widget.id)}
        onDuplicate={() => duplicateWidget(widget.id)}
        onRefresh={() => refreshWidget(widget.id)}
      />
    ),
    [widgetResults, widgetLoading, widgetErrors, removeWidget, duplicateWidget, refreshWidget]
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

  const emptyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: theme.spacing.xl,
    textAlign: 'center',
  };

  const paletteOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  };

  if (isLoading) {
    return (
      <div className={`prismiq-dashboard-editor ${className}`} style={containerStyle}>
        <div style={loadingStyle}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`prismiq-dashboard-editor ${className}`} style={containerStyle}>
      <EditorToolbar
        dashboardName={dashboard.name}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onAddWidget={() => setShowPalette(true)}
        onSave={handleSave}
        onCancel={handleCancel}
      />

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

      {/* Widget palette overlay */}
      {showPalette && (
        <div style={paletteOverlayStyle} onClick={() => setShowPalette(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <WidgetPalette onAddWidget={addWidget} />
          </div>
        </div>
      )}

      {/* Widget editor modal */}
      {editingWidget && schema && (
        <WidgetEditor
          widget={editingWidget}
          schema={schema}
          onSave={handleWidgetSave}
          onCancel={() => setEditingWidget(null)}
        />
      )}
    </div>
  );
}
