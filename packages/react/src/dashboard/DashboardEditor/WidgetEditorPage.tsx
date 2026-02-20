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
import { Tooltip } from '../../components/ui/Tooltip';
import { SavedQueryPicker } from '../../components/SavedQueryPicker';
import { QueryBuilder } from '../../components/QueryBuilder';
import { CustomSQLEditor } from '../../components/CustomSQLEditor';
import { ChatPanel } from '../../components/ChatPanel';
import { SchemaExplorer } from '../../components/SchemaExplorer';
import { useLLMStatus } from '../../hooks/useLLMStatus';
import { WidgetTypeSelector } from './WidgetTypeSelector';
import { WidgetPreview } from './WidgetPreview';
import { GuidedDataConfig } from './GuidedDataConfig';
import { ValueFormattingSection } from './configs/ValueFormattingSection';
import { DisplayConfigSection } from './configs/DisplayConfigSection';
import { DateFormattingSection } from './configs/DateFormattingSection';
import { TrendConfigSection } from './configs/TrendConfigSection';
import { HyperlinkSection } from './configs/HyperlinkSection';
import { ReferenceLinesSection } from './configs/ReferenceLinesSection';
import { TextFormattingSection } from './configs/TextFormattingSection';
import { PivotConfigSection } from './configs/PivotConfigSection';
import { LayoutConstraintsSection } from './configs/LayoutConstraintsSection';
import { CrossFilterSection } from './configs/CrossFilterSection';
import type { Widget, WidgetConfig, WidgetType, WidgetHyperlink, WidgetPosition } from '../types';
import type {
  DatabaseSchema,
  QueryDefinition,
  QueryResult,
  SavedQuery,
  TableSchema,
  ColumnSchema,
  WidgetContext,
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

type DataSourceMode = 'guided' | 'advanced' | 'saved' | 'sql';

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
 * Generate a unique ID (UUID v4).
 */
function generateId(): string {
  return crypto.randomUUID();
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
  const { enabled: llmEnabled, isLoading: llmStatusLoading } = useLLMStatus();

  // Determine if this is a new widget
  const isNew = widget === null;

  // Widget state
  const [type, setType] = useState<WidgetType>(widget?.type ?? 'bar_chart');
  const [title, setTitle] = useState(widget?.title ?? 'New Widget');
  const [config, setConfig] = useState<WidgetConfig>(
    widget?.config ?? getDefaultConfig(widget?.type ?? 'bar_chart')
  );
  const [query, setQuery] = useState<QueryDefinition | null>(widget?.query ?? null);
  const [hyperlink, setHyperlink] = useState<WidgetHyperlink | undefined>(widget?.hyperlink);
  const [position, setPosition] = useState<WidgetPosition>(
    widget?.position ?? { x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 }
  );

  // Raw SQL for SQL mode
  const [rawSql, setRawSql] = useState<string>(widget?.config?.raw_sql ?? '');
  const [schemaOpen, setSchemaOpen] = useState(true);

  // Data source mode - restore saved mode for existing widgets, default to 'guided' for new ones
  const [dataSourceMode, setDataSourceMode] = useState<DataSourceMode>(
    isNew ? 'guided' : (widget?.config?.data_source_mode ?? 'guided')
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
    // SQL mode: use executeSQL
    if (dataSourceMode === 'sql') {
      if (!rawSql.trim() || !client) {
        setPreviewResult(null);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const result = await client.executeSQL(rawSql);
        setPreviewResult(result);
      } catch (err) {
        setPreviewError(err instanceof Error ? err : new Error('SQL execution failed'));
        setPreviewResult(null);
      } finally {
        setPreviewLoading(false);
      }
      return;
    }

    // Query mode: use executeQuery
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
  }, [query, rawSql, dataSourceMode, client]);

  // Refresh preview when query changes
  useEffect(() => {
    if (dataSourceMode === 'sql') {
      // Don't auto-refresh on every keystroke; user must execute manually
      return;
    }
    if (query) {
      void refreshPreview();
    } else {
      setPreviewResult(null);
      setPreviewError(null);
    }
  }, [query, dataSourceMode, refreshPreview]);

  // Check if query uses advanced features not representable in guided mode
  const queryHasAdvancedFeatures = useCallback((q: QueryDefinition | null): boolean => {
    if (!q) return false;
    // Multiple tables with joins
    if (q.tables && q.tables.length > 1 && q.joins && q.joins.length > 0) return true;
    // Calculated fields
    if (q.calculated_fields && q.calculated_fields.length > 0) return true;
    // Explicit group_by (guided mode auto-derives grouping)
    if (q.group_by && q.group_by.length > 0) return true;
    // Custom sort orders
    if (q.order_by && q.order_by.length > 0) return true;
    // Pagination settings
    if (q.limit != null) return true;
    if (q.offset != null) return true;
    // Time series configuration
    if (q.time_series) return true;
    return false;
  }, []);

  // Handle mode switch with confirmation for advanced → guided
  const handleModeSwitch = useCallback((newMode: DataSourceMode) => {
    if (newMode === 'guided' && (dataSourceMode === 'advanced' || dataSourceMode === 'saved') && queryHasAdvancedFeatures(query)) {
      const confirmed = window.confirm(
        'This query uses advanced features (e.g. joins, calculated fields, grouping, sorting, pagination, time series) ' +
        'that Guided mode may not fully represent. ' +
        'The query will be preserved but some settings may not be editable in Guided mode.\n\n' +
        'Switch to Guided mode?'
      );
      if (!confirmed) return;
    }
    setDataSourceMode(newMode);
  }, [dataSourceMode, query, queryHasAdvancedFeatures]);

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

  // Handle applying SQL from the chat panel
  const handleApplySql = useCallback((sql: string) => {
    setRawSql(sql);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const savedConfig = { ...config, data_source_mode: dataSourceMode };

    // SQL mode: store raw_sql in config, clear query
    if (dataSourceMode === 'sql') {
      savedConfig.raw_sql = rawSql.trim() || undefined;
    }

    const savedWidget: Widget = {
      id: widget?.id ?? generateId(),
      type,
      title,
      config: savedConfig,
      query: dataSourceMode === 'sql' ? null : query,
      position,
      hyperlink,
    };
    onSave(savedWidget);
  }, [widget, type, title, config, query, rawSql, position, hyperlink, dataSourceMode, onSave]);

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

  // Build widget context for the LLM chat assistant
  const widgetContext = useMemo((): WidgetContext => ({
    widget_type: type,
    x_axis: config.x_axis as string | undefined,
    y_axis: config.y_axis as string[] | undefined,
    series_column: config.series_column as string | undefined,
    last_error: previewError?.message,
  }), [type, config.x_axis, config.y_axis, config.series_column, previewError]);

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
    flexShrink: 0,
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
    overflow: 'auto',
    display: 'grid',
    gridTemplateColumns: '360px 1fr',
  };

  const leftPanelStyle: React.CSSProperties = {
    borderRight: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  };

  const mainPanelStyle: React.CSSProperties = {
    minWidth: 0,
  };

  const previewPanelStyle: React.CSSProperties = {
    height: '440px',
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  };

  const dataSourcePanelStyle: React.CSSProperties = {};

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
    padding: theme.spacing.md,
    paddingBottom: '200px', // Extra padding to create scroll room for filters
  };

  const sectionStyle: React.CSSProperties = {
    // Note: Parent has flex gap for spacing between sections
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

  // Render config fields based on widget type
  const renderConfigFields = () => {
    switch (type) {
      case 'metric':
        return (
          <>
            <ValueFormattingSection
              config={config}
              onChange={updateConfig}
              showCurrency={true}
              showCompact={true}
              defaultOpen={true}
            />
            <TrendConfigSection
              config={config}
              onChange={updateConfig}
              query={query}
              schema={schema}
              defaultOpen={false}
            />
          </>
        );

      case 'bar_chart':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>X-Axis Column</label>
              <Select
                value={config.x_axis || ''}
                onChange={(value) => updateConfig('x_axis', value || undefined)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <DisplayConfigSection
              widgetType={type}
              config={config}
              onChange={updateConfig}
              defaultOpen={true}
            />
            <ValueFormattingSection
              config={config}
              onChange={updateConfig}
              showCurrency={true}
              showCompact={true}
              defaultOpen={false}
            />
            <ReferenceLinesSection
              lines={config.referenceLines ?? []}
              onChange={(lines) => updateConfig('referenceLines', lines.length > 0 ? lines : undefined)}
              defaultOpen={false}
            />
            <CrossFilterSection
              config={config}
              onChange={updateConfig}
              query={query}
              defaultOpen={false}
            />
            <DateFormattingSection
              config={config}
              onChange={updateConfig}
              query={query}
              schema={schema}
              defaultOpen={false}
            />
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
                onChange={(value) => updateConfig('x_axis', value || undefined)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <DisplayConfigSection
              widgetType={type}
              config={config}
              onChange={updateConfig}
              defaultOpen={true}
            />
            <ValueFormattingSection
              config={config}
              onChange={updateConfig}
              showCurrency={true}
              showCompact={true}
              defaultOpen={false}
            />
            <ReferenceLinesSection
              lines={config.referenceLines ?? []}
              onChange={(lines) => updateConfig('referenceLines', lines.length > 0 ? lines : undefined)}
              defaultOpen={false}
            />
            <CrossFilterSection
              config={config}
              onChange={updateConfig}
              query={query}
              defaultOpen={false}
            />
            <DateFormattingSection
              config={config}
              onChange={updateConfig}
              query={query}
              schema={schema}
              defaultOpen={false}
            />
          </>
        );

      case 'pie_chart':
        return (
          <>
            <DisplayConfigSection
              widgetType={type}
              config={config}
              onChange={updateConfig}
              defaultOpen={true}
            />
            <CrossFilterSection
              config={config}
              onChange={updateConfig}
              query={query}
              defaultOpen={false}
            />
          </>
        );

      case 'scatter_chart':
        return (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>X-Axis Column</label>
              <Select
                value={config.x_axis || ''}
                onChange={(value) => updateConfig('x_axis', value || undefined)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Y-Axis Column</label>
              <Select
                value={config.y_axis?.[0] || ''}
                onChange={(value) => updateConfig('y_axis', value ? [value] : undefined)}
                options={[{ value: '', label: 'Auto-detect' }, ...columnSelectOptions]}
              />
            </div>
            <DisplayConfigSection
              widgetType={type}
              config={config}
              onChange={updateConfig}
              defaultOpen={true}
            />
            <ValueFormattingSection
              config={config}
              onChange={updateConfig}
              showCurrency={true}
              showCompact={true}
              defaultOpen={false}
            />
          </>
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
            <PivotConfigSection
              config={config}
              onChange={updateConfig}
              query={query}
              schema={schema}
              defaultOpen={false}
            />
            <DateFormattingSection
              config={config}
              onChange={updateConfig}
              query={query}
              schema={schema}
              defaultOpen={false}
            />
          </>
        );

      case 'text':
        return <TextFormattingSection config={config} onChange={updateConfig} />;

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

          {/* Hyperlink */}
          <HyperlinkSection
            hyperlink={hyperlink}
            onChange={setHyperlink}
            defaultOpen={!!hyperlink}
          />

          {/* Layout Constraints */}
          <LayoutConstraintsSection
            position={position}
            onChange={setPosition}
            defaultOpen={false}
          />
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
              rawSql={dataSourceMode === 'sql' ? rawSql : undefined}
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
                <Tooltip
                  content="Quick setup: pick columns from dropdowns to build your chart"
                  position="bottom"
                  style={{ whiteSpace: 'normal' }}
                >
                  <button
                    type="button"
                    data-testid="data-source-mode-guided"
                    style={tabStyle(dataSourceMode === 'guided')}
                    onClick={() => handleModeSwitch('guided')}
                  >
                    Guided
                  </button>
                </Tooltip>
                <Tooltip
                  content="Full control: combine tables, add filters, and create custom calculations"
                  position="bottom"
                  style={{ whiteSpace: 'normal' }}
                >
                  <button
                    type="button"
                    data-testid="data-source-mode-advanced"
                    style={tabStyle(dataSourceMode === 'advanced')}
                    onClick={() => handleModeSwitch('advanced')}
                  >
                    Advanced
                  </button>
                </Tooltip>
                <Tooltip
                  content="Write raw SQL queries directly, with optional AI assistance"
                  position="bottom"
                  style={{ whiteSpace: 'normal' }}
                >
                  <button
                    type="button"
                    data-testid="data-source-mode-sql"
                    style={tabStyle(dataSourceMode === 'sql')}
                    onClick={() => handleModeSwitch('sql')}
                  >
                    SQL
                  </button>
                </Tooltip>
                {/* Saved Query tab hidden for now - uncomment when feature is ready
                <button
                  type="button"
                  style={tabStyle(dataSourceMode === 'saved')}
                  onClick={() => setDataSourceMode('saved')}
                >
                  Saved Query
                </button>
                */}
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

                {dataSourceMode === 'sql' && (
                  <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: '400px' }}>
                    {/* Schema Reference Panel */}
                    <div data-testid="schema-panel" style={{
                      width: schemaOpen ? '220px' : '36px',
                      flexShrink: 0,
                      transition: 'width 0.2s ease',
                      borderRight: `1px solid ${theme.colors.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}>
                      {schemaOpen ? (
                        <SchemaExplorer
                          searchable
                          collapsible
                          onColumnSelect={(table, col) => {
                            const ref = `"${table.name}"."${col.name}"`;
                            setRawSql(prev => prev ? `${prev} ${ref}` : ref);
                          }}
                          headerAction={
                            <button
                              type="button"
                              onClick={() => setSchemaOpen(false)}
                              title="Collapse schema panel"
                              data-testid="schema-toggle-open"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '22px',
                                height: '22px',
                                backgroundColor: 'transparent',
                                border: `1px solid ${theme.colors.border}`,
                                borderRadius: theme.radius.sm,
                                cursor: 'pointer',
                                color: theme.colors.textMuted,
                                flexShrink: 0,
                              }}
                            >
                              <Icon name="chevron-left" size={12} />
                            </button>
                          }
                          style={{ flex: 1, border: 'none', borderRadius: 0 }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSchemaOpen(true)}
                          title="Show schema browser"
                          data-testid="schema-toggle-collapsed"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            paddingTop: theme.spacing.sm,
                            width: '100%',
                            height: '100%',
                            backgroundColor: theme.colors.surface,
                            border: 'none',
                            cursor: 'pointer',
                            color: theme.colors.textMuted,
                            fontFamily: theme.fonts.sans,
                          }}
                        >
                          <Icon name="table" size={16} />
                          <span style={{
                            writingMode: 'vertical-rl',
                            fontSize: '11px',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                          }}>
                            Schema
                          </span>
                        </button>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }} data-testid="sql-editor">
                      <CustomSQLEditor
                        initialSql={rawSql}
                        onSqlChange={setRawSql}
                        onExecute={() => void refreshPreview()}
                        showResults={false}
                        placeholder="Write your SQL query here..."
                      />
                    </div>
                    {!llmStatusLoading && llmEnabled && (
                      <div style={{ width: '340px', flexShrink: 0 }} data-testid="chat-panel">
                        <ChatPanel
                          currentSql={rawSql || null}
                          onApplySql={handleApplySql}
                          widgetContext={widgetContext}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
