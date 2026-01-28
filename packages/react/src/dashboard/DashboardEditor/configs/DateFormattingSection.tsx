/**
 * DateFormattingSection component for configuring date display formats.
 *
 * Allows setting format strings for each date column in the query.
 */

import { useMemo, useCallback, type CSSProperties } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';
import type { QueryDefinition, DatabaseSchema, ColumnSchema } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface DateFormattingSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Current query for detecting date columns. */
  query: QueryDefinition | null;
  /** Database schema for column type info. */
  schema: DatabaseSchema | null;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DATE_FORMAT_PRESETS = [
  { value: '', label: 'Default' },
  { value: 'yyyy-MM-dd', label: '2024-01-15' },
  { value: 'MMM dd, yyyy', label: 'Jan 15, 2024' },
  { value: 'MMMM dd, yyyy', label: 'January 15, 2024' },
  { value: 'dd/MM/yyyy', label: '15/01/2024' },
  { value: 'MM/dd/yyyy', label: '01/15/2024' },
  { value: 'MMM yyyy', label: 'Jan 2024' },
  { value: 'MMMM yyyy', label: 'January 2024' },
  { value: 'yyyy', label: '2024' },
  { value: "Q'Q' yyyy", label: 'Q1 2024' },
  { value: 'EEE, MMM dd', label: 'Mon, Jan 15' },
  { value: 'yyyy-MM-dd HH:mm', label: '2024-01-15 14:30' },
  { value: 'MMM dd, HH:mm', label: 'Jan 15, 14:30' },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a column is a date/timestamp type.
 */
function isDateType(dataType: string): boolean {
  const type = dataType.toLowerCase();
  return type.includes('date') || type.includes('time') || type.includes('timestamp');
}

// ============================================================================
// Component
// ============================================================================

/**
 * Date formatting configuration section.
 */
export function DateFormattingSection({
  config,
  onChange,
  query,
  schema,
  defaultOpen = false,
}: DateFormattingSectionProps): JSX.Element | null {
  const { theme } = useTheme();

  // Find date columns in the current query
  const dateColumns = useMemo(() => {
    if (!query || !schema) return [];

    const result: { name: string; alias: string }[] = [];

    for (const col of query.columns) {
      const table = query.tables.find((t) => t.id === col.table_id);
      if (!table) continue;

      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      const columnSchema = tableSchema.columns.find((c: ColumnSchema) => c.name === col.column);
      if (!columnSchema) continue;

      if (isDateType(columnSchema.data_type)) {
        const displayName = col.alias || col.column;
        result.push({ name: col.column, alias: displayName });
      }
    }

    return result;
  }, [query, schema]);

  // Handle format change for a column
  const handleFormatChange = useCallback(
    (columnName: string, format: string) => {
      const currentFormats = config.dateFormats || {};
      const newFormats = { ...currentFormats };

      if (format) {
        newFormats[columnName] = format;
      } else {
        delete newFormats[columnName];
      }

      // If no formats left, set to undefined
      const hasFormats = Object.keys(newFormats).length > 0;
      onChange('dateFormats', hasFormats ? newFormats : undefined);
    },
    [config.dateFormats, onChange]
  );

  // Don't render if no date columns
  if (dateColumns.length === 0) {
    return null;
  }

  const fieldStyle: CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const columnNameStyle: CSSProperties = {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  };

  return (
    <CollapsibleSection title="Date Formatting" defaultOpen={defaultOpen}>
      {dateColumns.map((col) => (
        <div key={col.name} style={fieldStyle}>
          <label style={labelStyle}>
            <span style={columnNameStyle}>{col.alias}</span>
          </label>
          <Select
            value={config.dateFormats?.[col.name] || ''}
            onChange={(value) => handleFormatChange(col.name, value)}
            options={DATE_FORMAT_PRESETS}
          />
        </div>
      ))}
    </CollapsibleSection>
  );
}
