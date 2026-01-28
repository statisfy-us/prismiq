/**
 * PivotConfigSection component for configuring pivot table mode.
 *
 * Allows users to:
 * - Enable/disable pivot mode
 * - Select pivot column (values become new columns)
 * - Select value column (values to aggregate)
 */

import { useMemo } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';
import type { QueryDefinition, DatabaseSchema } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface PivotConfigSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Current query (to get column options). */
  query: QueryDefinition | null;
  /** Database schema (to determine column types). */
  schema: DatabaseSchema | null;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Pivot table configuration section.
 */
export function PivotConfigSection({
  config,
  onChange,
  query,
  schema,
  defaultOpen = false,
}: PivotConfigSectionProps): JSX.Element {
  const { theme } = useTheme();

  const isPivotEnabled = !!config.pivot_column;

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  };

  const previewStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  };

  // Get column options from query
  const columnOptions = useMemo(() => {
    if (!query?.columns) return [];
    return query.columns.map((col) => ({
      value: col.column,
      label: col.column,
    }));
  }, [query]);

  // Get categorical columns for pivot (text-like columns)
  const categoricalColumns = useMemo(() => {
    if (!query?.columns || !schema) return columnOptions;

    // Try to filter to categorical/text columns
    const textTypes = ['text', 'varchar', 'character varying', 'char', 'string'];
    const categoricalCols = query.columns.filter((col) => {
      // Find table and column in schema
      const tableName = query.tables[0]?.name;
      const tableSchema = schema.tables.find((t) => t.name === tableName);
      const colSchema = tableSchema?.columns.find((c) => c.name === col.column);

      if (!colSchema) return true; // Include if unknown
      return textTypes.some((t) => colSchema.data_type.toLowerCase().includes(t));
    });

    // If no categorical columns found, return all columns
    if (categoricalCols.length === 0) return columnOptions;

    return categoricalCols.map((col) => ({
      value: col.column,
      label: col.column,
    }));
  }, [query, schema, columnOptions]);

  // Get numeric columns for value
  const numericColumns = useMemo(() => {
    if (!query?.columns || !schema) return columnOptions;

    // Filter to numeric columns
    const numericTypes = [
      'int',
      'integer',
      'bigint',
      'smallint',
      'numeric',
      'decimal',
      'float',
      'double',
      'real',
      'number',
    ];
    const numericCols = query.columns.filter((col) => {
      const tableName = query.tables[0]?.name;
      const tableSchema = schema.tables.find((t) => t.name === tableName);
      const colSchema = tableSchema?.columns.find((c) => c.name === col.column);

      if (!colSchema) return true; // Include if unknown
      return numericTypes.some((t) => colSchema.data_type.toLowerCase().includes(t));
    });

    // If no numeric columns found, return all columns
    if (numericCols.length === 0) return columnOptions;

    return numericCols.map((col) => ({
      value: col.column,
      label: col.column,
    }));
  }, [query, schema, columnOptions]);

  const handleEnableChange = (enabled: boolean) => {
    if (!enabled) {
      onChange('pivot_column', undefined);
      onChange('value_column', undefined);
    } else {
      // Set defaults if columns are available
      const defaultPivot = categoricalColumns[0]?.value;
      const defaultValue = numericColumns[0]?.value;
      if (defaultPivot) onChange('pivot_column', defaultPivot);
      if (defaultValue) onChange('value_column', defaultValue);
    }
  };

  // Determine dimension columns (all except pivot and value)
  const dimensionColumns = useMemo(() => {
    if (!query?.columns || !config.pivot_column || !config.value_column) return [];
    return query.columns
      .filter(
        (col) =>
          col.column !== config.pivot_column && col.column !== config.value_column
      )
      .map((col) => col.column);
  }, [query, config.pivot_column, config.value_column]);

  return (
    <CollapsibleSection
      title="Pivot Table"
      defaultOpen={defaultOpen || isPivotEnabled}
    >
      <div style={fieldStyle}>
        <Checkbox
          label="Enable Pivot Mode"
          checked={isPivotEnabled}
          onChange={(e) => handleEnableChange(e.target.checked)}
        />
      </div>

      {isPivotEnabled && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Pivot Column</label>
            <Select
              value={config.pivot_column ?? ''}
              onChange={(value) => onChange('pivot_column', value || undefined)}
              options={[
                { value: '', label: 'Select column...' },
                ...categoricalColumns,
              ]}
            />
            <div style={helpTextStyle}>
              Unique values in this column become new columns
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Value Column</label>
            <Select
              value={config.value_column ?? ''}
              onChange={(value) => onChange('value_column', value || undefined)}
              options={[{ value: '', label: 'Select column...' }, ...numericColumns]}
            />
            <div style={helpTextStyle}>
              Values to distribute across the pivot columns
            </div>
          </div>

          {config.pivot_column && config.value_column && (
            <div style={previewStyle}>
              <strong>Pivot Preview:</strong>
              <br />
              Rows:{' '}
              {dimensionColumns.length > 0 ? dimensionColumns.join(', ') : '(all rows)'}
              <br />
              Columns: Unique values from <code>{config.pivot_column}</code>
              <br />
              Values: <code>{config.value_column}</code>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
