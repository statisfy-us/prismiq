/**
 * Per-column value formatting for table widgets.
 *
 * Allows setting format (currency, percent, compact) per numeric column.
 */

import { useMemo, useCallback } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';
import type { QueryDefinition, DatabaseSchema } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface ColumnValueFormattingSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Current query for detecting numeric columns. */
  query: QueryDefinition | null;
  /** Database schema for column type info. */
  schema: DatabaseSchema | null;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS = [
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency ($)' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'compact', label: 'Compact (K/M/B)' },
];

const DECIMAL_OPTIONS = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

// ============================================================================
// Helpers
// ============================================================================

function isNumericType(dataType: string): boolean {
  const t = dataType.toLowerCase();
  return (
    t === 'number' ||
    t.includes('int') ||
    t.includes('numeric') ||
    t.includes('decimal') ||
    t.includes('float') ||
    t.includes('double') ||
    t.includes('real')
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Per-column value formatting for table widgets.
 */
export function ColumnValueFormattingSection({
  config,
  onChange,
  query,
  schema,
  defaultOpen = false,
}: ColumnValueFormattingSectionProps): JSX.Element | null {
  const { theme } = useTheme();

  // Find numeric columns from the query
  const numericColumns = useMemo(() => {
    if (!query || !schema) return [];
    const result: { name: string; dataType: string }[] = [];

    for (const col of query.columns) {
      // Use alias if set, otherwise column name
      const displayName = col.alias || col.column;

      // If aggregated, it's numeric
      if (col.aggregation && col.aggregation !== 'none') {
        result.push({ name: displayName, dataType: 'number' });
        continue;
      }

      // Check schema for the column's data type
      const table = query.tables.find((t) => t.id === col.table_id);
      if (!table) continue;
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;
      const colSchema = tableSchema.columns.find((c) => c.name === col.column);
      if (colSchema && isNumericType(colSchema.data_type)) {
        result.push({ name: displayName, dataType: colSchema.data_type });
      }
    }

    return result;
  }, [query, schema]);

  const columnFormats = config.columnFormats ?? {};

  const updateColumnFormat = useCallback(
    (columnName: string, key: string, value: unknown) => {
      const current = columnFormats[columnName] ?? { format: 'number' as const };
      const updated = { ...current, [key]: value };
      // If format is reset to 'number' with default decimals, remove the entry
      if (updated.format === 'number' && (updated.decimalDigits === undefined || updated.decimalDigits === 2)) {
        const { [columnName]: _, ...rest } = columnFormats;
        onChange('columnFormats', Object.keys(rest).length > 0 ? rest : undefined);
      } else {
        onChange('columnFormats', { ...columnFormats, ...{ [columnName]: updated } });
      }
    },
    [columnFormats, onChange]
  );

  if (numericColumns.length === 0) return null;

  const columnRowStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  };

  const columnNameStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  };

  return (
    <CollapsibleSection title="Column Formatting" defaultOpen={defaultOpen}>
      {numericColumns.map((col) => {
        const fmt = columnFormats[col.name];
        const format = fmt?.format ?? 'number';
        const isCurrency = format === 'currency';

        return (
          <div key={col.name} style={columnRowStyle}>
            <div style={columnNameStyle}>{col.name}</div>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <Select
                  value={format}
                  onChange={(v) => updateColumnFormat(col.name, 'format', v)}
                  options={FORMAT_OPTIONS}
                  size="sm"
                />
              </div>
              {isCurrency && (
                <div style={{ width: '60px' }}>
                  <Input
                    inputSize="sm"
                    value={fmt?.currencySymbol ?? '$'}
                    onChange={(e) => updateColumnFormat(col.name, 'currencySymbol', e.target.value)}
                    placeholder="$"
                  />
                </div>
              )}
              <div style={{ width: '60px' }}>
                <Select
                  value={String(fmt?.decimalDigits ?? 2)}
                  onChange={(v) => updateColumnFormat(col.name, 'decimalDigits', parseInt(v, 10))}
                  options={DECIMAL_OPTIONS}
                  size="sm"
                />
              </div>
            </div>
          </div>
        );
      })}
    </CollapsibleSection>
  );
}
