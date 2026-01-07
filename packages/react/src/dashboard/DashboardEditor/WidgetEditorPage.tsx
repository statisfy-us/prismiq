/**
 * Full-page widget editor for creating and editing widgets.
 *
 * Replaces the modal-based widget editor with a comprehensive full-page layout
 * that provides:
 * - Widget type selection (changeable after creation)
 * - Configuration options based on widget type
 * - Data source: saved query or inline query builder
 * - Live preview with actual data
 */

import { useState, useCallback, useEffect, useMemo, type ChangeEvent } from 'react';
import { useTheme } from '../../theme';
import { useAnalytics } from '../../context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Icon } from '../../components/ui/Icon';
import { SavedQueryPicker } from '../../components/SavedQueryPicker';
import { QueryBuilder } from '../../components/QueryBuilder';
import { WidgetTypeSelector } from './WidgetTypeSelector';
import { WidgetPreview } from './WidgetPreview';
import { GuidedDataConfig } from './GuidedDataConfig';
import type { Widget, WidgetConfig, WidgetType } from '../types';
import type {
  DatabaseSchema,
  QueryDefinition,
  QueryResult,
  SavedQuery,
  TableSchema,
  ColumnSchema,
} from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface WidgetEditorPageProps {
  /** Widget being edited, or null for new widget. */
  widget: Widget | null;
  /** Database schema for query building. */
  schema: DatabaseSchema | null;
  /** Callback when save is clicked. */
  onSave: (widget: Widget) => void;
  /** Callback when cancel is clicked. */
  onCancel: () => void;
}

type DataSourceMode = 'guided' | 'advanced' | 'saved';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get default config for a widget type.
 */
function getDefaultConfig(type: WidgetType): WidgetConfig {
  switch (type) {
    case 'metric':
      return { format: 'number' };
    case 'bar_chart':
      return { orientation: 'vertical', show_legend: true };
    case 'line_chart':
    case 'area_chart':
      return { show_legend: true, show_data_labels: false };
    case 'pie_chart':
      return { show_legend: true, show_data_labels: true };
    case 'scatter_chart':
      return { show_legend: true };
    case 'table':
      return { page_size: 10, sortable: true };
    case 'text':
      return { content: '', markdown: true };
    default:
      return {};
  }
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
  return `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Full-page widget editor.
 *
 * @example
 * ```tsx
 * <WidgetEditorPage
 *   widget={existingWidget}
 *   schema={schema}
 *   onSave={(widget) => updateDashboard(widget)}
 *   onCancel={() => setEditingWidget(null)}
 * />
 * ```
 */
export function WidgetEditorPage({
  widget,
  schema,
  onSave,
  onCancel,
}: WidgetEditorPageProps): JSX.Element {
  const { theme } = useTheme();
  const { client } = useAnalytics();

  // Determine if this is a new widget
  const isNew = widget === null;

  // Widget state
  const [type, setType] = useState<WidgetType>(widget?.type ?? 'bar_chart');
  const [title, setTitle] = useState(widget?.title ?? 'New Widget');
  const [config, setConfig] = useState<WidgetConfig>(
    widget?.config ?? getDefaultConfig(widget?.type ?? 'bar_chart')
  );
  const [query, setQuery] = useState<QueryDefinition | null>(widget?.query ?? null);

  // Data source mode - default to guided for new widgets
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>(
    widget?.query ? 'saved' : 'guided'
  );

  // Preview state
  const [previewResult, setPreviewResult] = useState<QueryResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<Error | null>(null);

  // Update config when type changes (preserve shared settings)
  const handleTypeChange = useCallback(
    (newType: WidgetType) => {
      setType(newType);
      // Merge new default config with existing (preserve x_axis, y_axis, etc.)
      setConfig((prev) => ({
        ...getDefaultConfig(newType),
        x_axis: prev.x_axis,
        y_axis: prev.y_axis,
      }));
    },
    []
  );

  // Update config field
  const updateConfig = useCallback(
    <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Execute query for preview
  const refreshPreview = useCallback(async () => {
    if (!query || !client) {
      setPreviewResult(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const result = await client.executeQuery({ ...query, limit: 100 });
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err : new Error('Query failed'));
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [query, client]);

  // Refresh preview when query changes
  useEffect(() => {
    if (query) {
      void refreshPreview();
    } else {
      setPreviewResult(null);
      setPreviewError(null);
    }
  }, [query, refreshPreview]);

  // Handle saved query selection
  const handleSavedQuerySelect = useCallback((savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
  }, []);

  // Handle query builder change
  const handleQueryChange = useCallback((newQuery: QueryDefinition) => {
    setQuery(newQuery);
  }, []);

  // Handle clear query
  const handleClearQuery = useCallback(() => {
    setQuery(null);
    setPreviewResult(null);
    setPreviewError(null);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const savedWidget: Widget = {
      id: widget?.id ?? generateId(),
      type,
      title,
      config,
      query,
      position: widget?.position ?? { x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
    };
    onSave(savedWidget);
  }, [widget, type, title, config, query, onSave]);

  // Column select options for config
  const columnSelectOptions = useMemo(() => {
    if (!schema) return [];
    return schema.tables.flatMap((table: TableSchema) =>
      table.columns.map((col: ColumnSchema) => ({
        value: `${table.name}.${col.name}`,
        label: `${table.name}.${col.name}`,
      }))
    );
  }, [schema]);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    fontFamily: theme.fonts.sans,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  };

  const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  };

  const backButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
  };

  const headerTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
  };

  const headerActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  };

  const leftPanelStyle: React.CSSProperties = {
    width: '320px',
    flexShrink: 0,
    borderRight: `1px solid ${theme.colors.border}`,
    overflow: 'auto',
    padding: theme.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  };

  const mainPanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const previewPanelStyle: React.CSSProperties = {
    height: '300px',
    flexShrink: 0,
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const dataSourcePanelStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0, // Important for flex children to overflow properly
  };

  const dataSourceHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: isActive ? theme.colors.primary : 'transparent',
    color: isActive ? '#fff' : theme.colors.text,
    border: `1px solid ${isActive ? theme.colors.primary : theme.colors.border}`,
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    transition: 'all 0.15s ease',
  });

  const dataSourceContentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.md,
    minHeight: 0, // Important for flex children to overflow properly
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  };

  // Render config fields based on widget type
  const renderConfigFields = () => {
    switch (type) {
      case 'metric':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Format</label>
              <Select
                value={config.format || 'number'}
                onChange={(value) => updateConfig('format', value as WidgetConfig['format'])}
                options={[
                  { value: 'number', label: 'Number' },
                  { value: 'currency', label: 'Currency' },
                  { value: 'percent', label: 'Percentage' },
                  { value: 'compact', label: 'Compact' },
                ]}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Trend Comparison</label>
              <Select
                value={config.trend_comparison || ''}
                onChange={(value) => updateConfig('trend_comparison', value || undefined)}
                options={[{ value: '', label: 'None' }, ...columnSelectOptions]}
              />
            </div>
          </>
        );

      case 'bar_chart':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>X-Axis Column</label>
              <Select
                value={config.x_axis || ''}
                onChange={(value) => updateConfig('x_axis', value)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Orientation</label>
              <Select
                value={config.orientation || 'vertical'}
                onChange={(value) =>
                  updateConfig('orientation', value as 'vertical' | 'horizontal')
                }
                options={[
                  { value: 'vertical', label: 'Vertical' },
                  { value: 'horizontal', label: 'Horizontal' },
                ]}
              />
            </div>
            <div style={rowStyle}>
              <Checkbox
                label="Show Legend"
                checked={config.show_legend ?? true}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateConfig('show_legend', e.target.checked)
                }
              />
              <Checkbox
                label="Stacked"
                checked={config.stacked ?? false}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateConfig('stacked', e.target.checked)
                }
              />
            </div>
          </>
        );

      case 'line_chart':
      case 'area_chart':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>X-Axis Column</label>
              <Select
                value={config.x_axis || ''}
                onChange={(value) => updateConfig('x_axis', value)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <div style={rowStyle}>
              <Checkbox
                label="Show Legend"
                checked={config.show_legend ?? true}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateConfig('show_legend', e.target.checked)
                }
              />
              <Checkbox
                label="Data Labels"
                checked={config.show_data_labels ?? false}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateConfig('show_data_labels', e.target.checked)
                }
              />
            </div>
          </>
        );

      case 'pie_chart':
        return (
          <div style={rowStyle}>
            <Checkbox
              label="Show Legend"
              checked={config.show_legend ?? true}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateConfig('show_legend', e.target.checked)
              }
            />
            <Checkbox
              label="Show Labels"
              checked={config.show_data_labels ?? true}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateConfig('show_data_labels', e.target.checked)
              }
            />
          </div>
        );

      case 'table':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Page Size</label>
              <Select
                value={String(config.page_size || 10)}
                onChange={(value) => updateConfig('page_size', parseInt(value, 10))}
                options={[
                  { value: '5', label: '5 rows' },
                  { value: '10', label: '10 rows' },
                  { value: '25', label: '25 rows' },
                  { value: '50', label: '50 rows' },
                ]}
              />
            </div>
            <Checkbox
              label="Sortable Columns"
              checked={config.sortable ?? true}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateConfig('sortable', e.target.checked)
              }
            />
          </>
        );

      case 'text':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>Content</label>
              <textarea
                value={config.content || ''}
                onChange={(e) => updateConfig('content', e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: theme.spacing.sm,
                  fontSize: theme.fontSizes.sm,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  fontFamily: config.markdown ? theme.fonts.mono : theme.fonts.sans,
                  resize: 'vertical',
                }}
              />
            </div>
            <Checkbox
              label="Enable Markdown"
              checked={config.markdown ?? true}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateConfig('markdown', e.target.checked)
              }
            />
          </>
        );

      default:
        return null;
    }
  };

  // Render current query summary
  const renderQuerySummary = () => {
    if (!query) return null;

    return (
      <div
        style={{
          padding: theme.spacing.md,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.colors.border}`,
          marginBottom: theme.spacing.md,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.spacing.sm,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <Icon name="table" size={16} />
            <span style={{ fontWeight: 500, color: theme.colors.text }}>Query configured</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClearQuery}>
            <Icon name="x" size={16} />
          </Button>
        </div>
        <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.textMuted }}>
          {query.tables?.length || 0} table(s), {query.columns?.length || 0} column(s)
          {query.filters && query.filters.length > 0 && `, ${query.filters.length} filter(s)`}
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle} className="prismiq-widget-editor-page">
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <button type="button" style={backButtonStyle} onClick={onCancel}>
            <Icon name="chevron-left" size={16} />
            <span>Back</span>
          </button>
          <span style={headerTitleStyle}>{isNew ? 'Add Widget' : 'Edit Widget'}</span>
        </div>
        <div style={headerActionsStyle}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {isNew ? 'Add Widget' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Left Panel - Type & Config */}
        <div style={leftPanelStyle}>
          {/* Widget Type */}
          <div style={sectionStyle}>
            <WidgetTypeSelector value={type} onChange={handleTypeChange} />
          </div>

          {/* Basic Info */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Basic Info</h3>
            <div style={fieldStyle}>
              <label style={labelStyle}>Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Widget title"
              />
            </div>
          </div>

          {/* Configuration */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Configuration</h3>
            {renderConfigFields()}
          </div>
        </div>

        {/* Main Panel - Preview & Data Source */}
        <div style={mainPanelStyle}>
          {/* Preview */}
          <div style={previewPanelStyle}>
            <WidgetPreview
              type={type}
              title={title}
              config={config}
              query={query}
              result={previewResult}
              isLoading={previewLoading}
              error={previewError}
            />
          </div>

          {/* Data Source */}
          {type !== 'text' && schema && (
            <div style={dataSourcePanelStyle}>
              <div style={dataSourceHeaderStyle}>
                <span style={{ fontSize: theme.fontSizes.sm, fontWeight: 500, marginRight: 'auto' }}>
                  Data Source
                </span>
                <button
                  type="button"
                  style={tabStyle(dataSourceMode === 'guided')}
                  onClick={() => setDataSourceMode('guided')}
                >
                  Guided
                </button>
                <button
                  type="button"
                  style={tabStyle(dataSourceMode === 'advanced')}
                  onClick={() => setDataSourceMode('advanced')}
                >
                  Advanced
                </button>
                <button
                  type="button"
                  style={tabStyle(dataSourceMode === 'saved')}
                  onClick={() => setDataSourceMode('saved')}
                >
                  Saved Query
                </button>
              </div>

              <div style={dataSourceContentStyle}>
                {dataSourceMode === 'saved' && renderQuerySummary()}

                {dataSourceMode === 'guided' && (
                  <GuidedDataConfig
                    widgetType={type}
                    schema={schema}
                    query={query}
                    onChange={handleQueryChange}
                  />
                )}

                {dataSourceMode === 'advanced' && (
                  <QueryBuilder
                    initialQuery={query ?? undefined}
                    onQueryChange={handleQueryChange}
                    showSqlPreview={true}
                    showResultsTable={false}
                    showSavedQueries={false}
                    layout="horizontal"
                  />
                )}

                {dataSourceMode === 'saved' && (
                  <SavedQueryPicker
                    currentQuery={query}
                    onSelect={handleSavedQuerySelect}
                    showSave={false}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
