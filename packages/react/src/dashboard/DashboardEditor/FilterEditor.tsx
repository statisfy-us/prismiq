/**
 * Filter editor for creating, editing, and deleting dashboard-level filters.
 *
 * Follows the same full-page pattern as WidgetEditorPage.
 */

import { useState, useCallback, useMemo } from 'react';
import { useTheme } from '../../theme';
import { useSchema } from '../../hooks';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Checkbox } from '../../components/ui/Checkbox';
import { Icon } from '../../components/ui/Icon';
import type {
  DashboardFilter,
  DashboardFilterType,
  NumberRangeValue,
} from '../types';
import type { ColumnSchema } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface FilterEditorProps {
  /** Current filters on the dashboard. */
  filters: DashboardFilter[];
  /** Callback when filters are saved. */
  onSave: (filters: DashboardFilter[]) => void;
  /** Callback when editing is cancelled. */
  onCancel: () => void;
}

interface FilterFormState {
  table: string;
  column: string;
  type: DashboardFilterType;
  label: string;
  dynamic: boolean;
  defaultValue: unknown;
  datePreset: string;
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

/** Convert a snake_case or raw column name to Title Case. */
function toTitleCase(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Suggest a filter type based on the column's PostgreSQL data type. */
function suggestFilterType(dataType: string): DashboardFilterType {
  const dt = dataType.toLowerCase();
  if (dt.includes('timestamp') || dt.includes('date')) return 'date_range';
  if (dt.includes('bool')) return 'select';
  return 'multi_select';
}

/** Get the initial default value for a filter type. */
function getEmptyDefaultValue(type: DashboardFilterType): unknown {
  switch (type) {
    case 'number_range':
      return { min: null, max: null };
    case 'text':
      return '';
    case 'date_range':
      return null; // uses date_preset instead
    case 'multi_select':
    case 'select':
    default:
      return null;
  }
}

const FILTER_TYPE_OPTIONS: { value: DashboardFilterType; label: string }[] = [
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'select', label: 'Single Select' },
  { value: 'date_range', label: 'Date Range' },
  { value: 'text', label: 'Text Search' },
  { value: 'number_range', label: 'Number Range' },
];

const DATE_PRESET_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'No default' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'all_time', label: 'All Time' },
];

const EMPTY_FORM: FilterFormState = {
  table: '',
  column: '',
  type: 'multi_select',
  label: '',
  dynamic: true,
  defaultValue: null,
  datePreset: '',
};

// ============================================================================
// Component
// ============================================================================

export function FilterEditor({
  filters: initialFilters,
  onSave,
  onCancel,
}: FilterEditorProps): JSX.Element {
  const { theme } = useTheme();
  const { tables, getDisplayName } = useSchema();

  // Local copy of filters that we mutate before "Done"
  const [filters, setFilters] = useState<DashboardFilter[]>(initialFilters);

  // Form state for adding/editing a filter
  const [formState, setFormState] = useState<FilterFormState>(EMPTY_FORM);
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Table options for the dropdown
  const tableOptions = useMemo(
    () =>
      tables.map((t) => ({
        value: t.name,
        label: getDisplayName(t.name),
      })),
    [tables, getDisplayName]
  );

  // Column options for the selected table
  const columnOptions = useMemo(() => {
    if (!formState.table) return [];
    const table = tables.find((t) => t.name === formState.table);
    if (!table) return [];
    return table.columns
      .filter((col: ColumnSchema) => !col.is_primary_key)
      .map((col: ColumnSchema) => ({
        value: col.name,
        label: col.name,
      }));
  }, [formState.table, tables]);

  // Get column schema for the currently selected column
  const selectedColumnSchema = useMemo(() => {
    if (!formState.table || !formState.column) return null;
    const table = tables.find((t) => t.name === formState.table);
    return table?.columns.find((c: ColumnSchema) => c.name === formState.column) ?? null;
  }, [formState.table, formState.column, tables]);

  // Handle table selection — reset column when table changes
  const handleTableChange = useCallback((value: string) => {
    setFormState((prev) => ({
      ...prev,
      table: value,
      column: '',
      label: '',
      defaultValue: null,
      datePreset: '',
    }));
  }, []);

  // Handle column selection — auto-fill label and type
  const handleColumnChange = useCallback(
    (value: string) => {
      const table = tables.find((t) => t.name === formState.table);
      const col = table?.columns.find((c: ColumnSchema) => c.name === value);
      const suggestedType = col ? suggestFilterType(col.data_type) : 'multi_select';
      const isDynamic = suggestedType === 'multi_select' || suggestedType === 'select';

      setFormState((prev) => ({
        ...prev,
        column: value,
        type: suggestedType,
        label: prev.label || toTitleCase(value),
        dynamic: isDynamic,
        defaultValue: getEmptyDefaultValue(suggestedType),
        datePreset: '',
      }));
    },
    [formState.table, tables]
  );

  // Handle type change — reset default value to match new type
  const handleTypeChange = useCallback((value: DashboardFilterType) => {
    const isDynamic = value === 'multi_select' || value === 'select';
    setFormState((prev) => ({
      ...prev,
      type: value,
      dynamic: isDynamic,
      defaultValue: getEmptyDefaultValue(value),
      datePreset: value === 'date_range' ? prev.datePreset : '',
    }));
  }, []);

  // Reset form and open for adding
  const handleAddClick = useCallback(() => {
    setFormState(EMPTY_FORM);
    setEditingFilterId(null);
    setShowForm(true);
  }, []);

  // Load existing filter into form for editing
  const handleEditClick = useCallback((filter: DashboardFilter) => {
    setFormState({
      table: filter.table ?? '',
      column: filter.field,
      type: filter.type,
      label: filter.label,
      dynamic: filter.dynamic ?? false,
      defaultValue: filter.default_value ?? getEmptyDefaultValue(filter.type),
      datePreset: filter.date_preset ?? '',
    });
    setEditingFilterId(filter.id);
    setShowForm(true);
  }, []);

  // Delete a filter
  const handleDeleteFilter = useCallback((filterId: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== filterId));
    if (editingFilterId === filterId) {
      setShowForm(false);
      setEditingFilterId(null);
    }
  }, [editingFilterId]);

  // Save the form (add new or update existing)
  const handleFormSave = useCallback(() => {
    if (!formState.column || !formState.label) return;

    const filterDef: DashboardFilter = {
      id: editingFilterId ?? generateId(),
      type: formState.type,
      label: formState.label,
      field: formState.column,
      table: formState.table || undefined,
      dynamic: formState.dynamic || undefined,
      default_value: formState.defaultValue ?? undefined,
      date_preset: formState.datePreset || undefined,
    };

    if (editingFilterId) {
      setFilters((prev) =>
        prev.map((f) => (f.id === editingFilterId ? filterDef : f))
      );
    } else {
      setFilters((prev) => [...prev, filterDef]);
    }

    setShowForm(false);
    setEditingFilterId(null);
    setFormState(EMPTY_FORM);
  }, [formState, editingFilterId]);

  // Cancel the form
  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingFilterId(null);
    setFormState(EMPTY_FORM);
  }, []);

  // Save all and go back
  const handleDone = useCallback(() => {
    onSave(filters);
  }, [filters, onSave]);

  // Whether the form is valid
  const isFormValid = formState.column !== '' && formState.label.trim() !== '';

  // ============================================================================
  // Default Value Renderers
  // ============================================================================

  const renderDefaultValueFields = () => {
    switch (formState.type) {
      case 'date_range':
        return (
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Date Range</label>
            <Select
              value={formState.datePreset || null}
              onChange={(value) =>
                setFormState((prev) => ({ ...prev, datePreset: value }))
              }
              options={DATE_PRESET_OPTIONS}
              placeholder="Select a preset..."
            />
            <span style={hintStyle}>
              Users can override this when viewing the dashboard
            </span>
          </div>
        );

      case 'number_range': {
        const rangeVal = (formState.defaultValue as NumberRangeValue) ?? {
          min: null,
          max: null,
        };
        return (
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Range</label>
            <div style={rangeRowStyle}>
              <Input
                type="number"
                placeholder="Min"
                value={rangeVal.min ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setFormState((prev) => ({
                    ...prev,
                    defaultValue: {
                      ...(prev.defaultValue as NumberRangeValue),
                      min: val,
                    },
                  }));
                }}
              />
              <span style={rangeSeparatorStyle}>to</span>
              <Input
                type="number"
                placeholder="Max"
                value={rangeVal.max ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setFormState((prev) => ({
                    ...prev,
                    defaultValue: {
                      ...(prev.defaultValue as NumberRangeValue),
                      max: val,
                    },
                  }));
                }}
              />
            </div>
            <span style={hintStyle}>
              Leave blank for no default range restriction
            </span>
          </div>
        );
      }

      case 'text':
        return (
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Search Text</label>
            <Input
              value={(formState.defaultValue as string) ?? ''}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  defaultValue: e.target.value || null,
                }))
              }
              placeholder="Leave blank for no default"
            />
          </div>
        );

      case 'multi_select':
      case 'select':
        // For dynamic filters: options are loaded at runtime from DB,
        // default is "All" (no restriction). No default value config needed.
        // For static filters: user could configure static options, but
        // that's an advanced use case handled by the dynamic checkbox.
        return (
          <span style={hintStyle}>
            {formState.dynamic
              ? 'Options will be loaded from the database. Default: show all values.'
              : 'Static options are not supported yet. Enable "Load options dynamically" above.'}
          </span>
        );

      default:
        return null;
    }
  };

  // ============================================================================
  // Styles
  // ============================================================================

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
    padding: theme.spacing.lg,
    maxWidth: '700px',
  };

  const filterListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  };

  const filterItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  };

  const filterItemInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  };

  const filterItemNameStyle: React.CSSProperties = {
    fontWeight: 500,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  };

  const filterItemMetaStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  };

  const filterItemActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  };

  const formContainerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  };

  const formTitleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  };

  const hintStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  };

  const rangeRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const rangeSeparatorStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    flexShrink: 0,
  };

  const formActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end',
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
  };

  // Helper to format default value for display in the filter list
  const formatDefaultDisplay = (filter: DashboardFilter): string => {
    if (filter.type === 'date_range' && filter.date_preset) {
      const preset = DATE_PRESET_OPTIONS.find((p) => p.value === filter.date_preset);
      return preset ? preset.label : filter.date_preset;
    }
    if (filter.type === 'number_range' && filter.default_value) {
      const range = filter.default_value as NumberRangeValue;
      if (range.min != null || range.max != null) {
        const min = range.min != null ? String(range.min) : '∞';
        const max = range.max != null ? String(range.max) : '∞';
        return `${min} – ${max}`;
      }
    }
    if (filter.type === 'text' && filter.default_value) {
      return `"${filter.default_value}"`;
    }
    return '';
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={containerStyle} className="prismiq-filter-editor">
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerLeftStyle}>
          <button type="button" style={backButtonStyle} onClick={onCancel}>
            <Icon name="chevron-left" size={16} />
            <span>Back</span>
          </button>
          <span style={headerTitleStyle}>Dashboard Filters</span>
        </div>
        <div style={headerActionsStyle}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleDone}>
            Done
          </Button>
        </div>
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Existing filters list */}
        {filters.length > 0 && (
          <div style={filterListStyle}>
            {filters.map((filter) => {
              const defaultDisplay = formatDefaultDisplay(filter);
              return (
                <div key={filter.id} style={filterItemStyle}>
                  <div style={filterItemInfoStyle}>
                    <span style={filterItemNameStyle}>{filter.label}</span>
                    <span style={filterItemMetaStyle}>
                      {filter.table ? `${filter.table}.` : ''}
                      {filter.field} &middot; {filter.type.replace(/_/g, ' ')}
                      {filter.dynamic ? ' · dynamic' : ''}
                      {defaultDisplay ? ` · default: ${defaultDisplay}` : ''}
                    </span>
                  </div>
                  <div style={filterItemActionsStyle}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(filter)}
                    >
                      <Icon name="edit" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFilter(filter.id)}
                    >
                      <Icon name="trash" size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filters.length === 0 && !showForm && (
          <div style={emptyStyle}>
            <p>No filters yet. Add a filter to enable dashboard-level filtering across all widgets.</p>
          </div>
        )}

        {/* Add/Edit form */}
        {showForm && (
          <div style={formContainerStyle}>
            <div style={formTitleStyle}>
              {editingFilterId ? 'Edit Filter' : 'Add Filter'}
            </div>

            {/* Table selection */}
            <div style={fieldStyle}>
              <label style={labelStyle}>Table</label>
              <Select
                value={formState.table || null}
                onChange={handleTableChange}
                options={tableOptions}
                placeholder="Select a table..."
              />
            </div>

            {/* Column selection */}
            {formState.table && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Column</label>
                <Select
                  value={formState.column || null}
                  onChange={handleColumnChange}
                  options={columnOptions}
                  placeholder="Select a column..."
                />
              </div>
            )}

            {/* Filter type + config */}
            {formState.column && (
              <>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Filter Type</label>
                  <Select
                    value={formState.type}
                    onChange={handleTypeChange}
                    options={FILTER_TYPE_OPTIONS}
                  />
                  {selectedColumnSchema && (
                    <span style={hintStyle}>
                      Column type: {selectedColumnSchema.data_type}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div style={fieldStyle}>
                  <label style={labelStyle}>Label</label>
                  <Input
                    value={formState.label}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    placeholder="Filter label"
                  />
                </div>

                {/* Dynamic checkbox for select types */}
                {(formState.type === 'multi_select' ||
                  formState.type === 'select') && (
                  <Checkbox
                    label="Load options dynamically from database"
                    checked={formState.dynamic}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        dynamic: (e.target as HTMLInputElement).checked,
                      }))
                    }
                  />
                )}

                {/* Default value / range / preset */}
                {renderDefaultValueFields()}
              </>
            )}

            {/* Form actions */}
            <div style={formActionsStyle}>
              <Button variant="ghost" size="sm" onClick={handleFormCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleFormSave}
                disabled={!isFormValid}
              >
                {editingFilterId ? 'Update Filter' : 'Add Filter'}
              </Button>
            </div>
          </div>
        )}

        {/* Add filter button */}
        {!showForm && (
          <Button variant="secondary" onClick={handleAddClick}>
            <Icon name="plus" size={16} />
            <span style={{ marginLeft: theme.spacing.xs }}>Add Filter</span>
          </Button>
        )}
      </div>
    </div>
  );
}
