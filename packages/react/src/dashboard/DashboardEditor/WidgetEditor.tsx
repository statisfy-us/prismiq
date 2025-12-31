/**
 * Widget editor modal for configuring widget properties.
 */

import { useState, useCallback, type ChangeEvent } from 'react';
import { useTheme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Icon } from '../../components/ui/Icon';
import { SavedQueryPicker } from '../../components/SavedQueryPicker';
import type { Widget, WidgetConfig, WidgetEditorProps } from '../types';
import type { QueryDefinition, TableSchema, ColumnSchema, SavedQuery } from '../../types';

/**
 * Default widget configurations by type.
 */
function getDefaultConfig(type: Widget['type']): WidgetConfig {
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
 * Widget editor for configuring widget properties.
 */
export function WidgetEditor({
  widget,
  schema,
  onSave,
  onCancel,
}: WidgetEditorProps): JSX.Element {
  const { theme } = useTheme();

  // Local state for editing
  const [title, setTitle] = useState(widget.title);
  const [config, setConfig] = useState<WidgetConfig>(
    widget.config || getDefaultConfig(widget.type)
  );
  const [query, setQuery] = useState<QueryDefinition | null>(widget.query);
  const [queryName, setQueryName] = useState<string | null>(null);

  // Update config field
  const updateConfig = useCallback(
    <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Handle saved query selection
  const handleSelectSavedQuery = useCallback((savedQuery: SavedQuery) => {
    setQuery(savedQuery.query);
    setQueryName(savedQuery.name);
  }, []);

  // Handle clear query
  const handleClearQuery = useCallback(() => {
    setQuery(null);
    setQueryName(null);
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    const updatedWidget: Widget = {
      ...widget,
      title,
      config,
      query,
    };
    onSave(updatedWidget);
  }, [widget, title, config, query, onSave]);

  // Styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadows.lg,
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    padding: theme.spacing.md,
    overflowY: 'auto',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.lg,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
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

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
  };

  const columnSelectOptions = schema
    ? schema.tables.flatMap((table: TableSchema) =>
        table.columns.map((col: ColumnSchema) => ({
          value: `${table.name}.${col.name}`,
          label: `${table.name}.${col.name}`,
        }))
      )
    : [];

  // Render config fields based on widget type
  const renderConfigFields = () => {
    switch (widget.type) {
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
              <label style={labelStyle}>Trend Comparison Field</label>
              <Select
                value={config.trend_comparison || ''}
                onChange={(value) => updateConfig('trend_comparison', value || undefined)}
                options={[
                  { value: '', label: 'None' },
                  ...columnSelectOptions,
                ]}
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
                options={[{ value: '', label: 'Select column' }, ...columnSelectOptions]}
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
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_legend', e.target.checked)}
              />
              <Checkbox
                label="Stacked"
                checked={config.stacked ?? false}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('stacked', e.target.checked)}
              />
              <Checkbox
                label="Show Data Labels"
                checked={config.show_data_labels ?? false}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_data_labels', e.target.checked)}
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
                options={[{ value: '', label: 'Select column' }, ...columnSelectOptions]}
              />
            </div>
            <div style={rowStyle}>
              <Checkbox
                label="Show Legend"
                checked={config.show_legend ?? true}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_legend', e.target.checked)}
              />
              <Checkbox
                label="Show Data Labels"
                checked={config.show_data_labels ?? false}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_data_labels', e.target.checked)}
              />
            </div>
          </>
        );

      case 'pie_chart':
        return (
          <>
            <div style={rowStyle}>
              <Checkbox
                label="Show Legend"
                checked={config.show_legend ?? true}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_legend', e.target.checked)}
              />
              <Checkbox
                label="Show Data Labels"
                checked={config.show_data_labels ?? true}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('show_data_labels', e.target.checked)}
              />
            </div>
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
                  { value: '100', label: '100 rows' },
                ]}
              />
            </div>
            <Checkbox
              label="Sortable Columns"
              checked={config.sortable ?? true}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('sortable', e.target.checked)}
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
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateConfig('markdown', e.target.checked)}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Edit Widget</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <Icon name="x" size={20} />
          </Button>
        </div>

        <div style={bodyStyle}>
          {/* Basic Info */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Basic Information</h3>
            <div style={fieldStyle}>
              <label style={labelStyle}>Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Widget title"
              />
            </div>
          </div>

          {/* Widget-specific config */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Configuration</h3>
            {renderConfigFields()}
          </div>

          {/* Query section */}
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Data Source</h3>
            {query ? (
              <div
                style={{
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.background,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border}`,
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
                    <span style={{ fontWeight: 500, color: theme.colors.text }}>
                      {queryName || 'Custom Query'}
                    </span>
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
            ) : (
              <div
                style={{
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.background,
                  borderRadius: theme.radius.md,
                  border: `1px dashed ${theme.colors.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                <div style={{ textAlign: 'center', color: theme.colors.textMuted }}>
                  <Icon name="table" size={24} style={{ marginBottom: theme.spacing.xs }} />
                  <div>Select a saved query to power this widget</div>
                </div>
                <SavedQueryPicker
                  currentQuery={null}
                  onSelect={handleSelectSavedQuery}
                  showSave={false}
                />
              </div>
            )}
          </div>
        </div>

        <div style={footerStyle}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Widget
          </Button>
        </div>
      </div>
    </div>
  );
}
