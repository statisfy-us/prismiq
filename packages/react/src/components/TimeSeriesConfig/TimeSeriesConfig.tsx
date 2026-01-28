/**
 * TimeSeriesConfig component for configuring time series queries.
 *
 * Provides controls for:
 * - Time bucket interval (minute, hour, day, week, month, quarter, year)
 * - Fill missing time buckets toggle
 * - Fill value for missing buckets
 */

import { useMemo, type ChangeEvent } from 'react';
import { useTheme } from '../../theme';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import type {
  DatabaseSchema,
  QueryTable,
  TimeSeriesConfig as TimeSeriesConfigType,
  TimeSeriesInterval,
} from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface TimeSeriesConfigProps {
  /** Database schema for column type detection. */
  schema: DatabaseSchema;
  /** Tables in the current query. */
  tables: QueryTable[];
  /** Current time series configuration (can be undefined). */
  config: TimeSeriesConfigType | undefined;
  /** Callback when configuration changes. */
  onChange: (config: TimeSeriesConfigType | undefined) => void;
  /** Pre-selected date column (from group by selection). */
  selectedDateColumn?: {
    table_id: string;
    column: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const INTERVAL_OPTIONS: { value: TimeSeriesInterval; label: string }[] = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
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

/**
 * Parse a column reference in "tableId.column" format.
 * Returns null if the format is invalid, with a console warning.
 */
function parseColumnRef(
  ref: string,
  defaultTableId: string
): { tableId: string; column: string } | null {
  if (!ref || ref.trim() === '') {
    return null;
  }

  if (!ref.includes('.')) {
    // Simple column name without table prefix
    return { tableId: defaultTableId, column: ref };
  }

  const parts = ref.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.warn(`Invalid column reference format: "${ref}". Expected "tableId.column"`);
    return null;
  }

  return { tableId: parts[0], column: parts[1] };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Time series configuration component for date-based charts.
 */
export function TimeSeriesConfig({
  schema,
  tables,
  config,
  onChange,
  selectedDateColumn,
}: TimeSeriesConfigProps): JSX.Element {
  const { theme } = useTheme();

  // Find all date columns from selected tables
  const dateColumnOptions = useMemo(() => {
    const options: { value: string; label: string; tableId: string }[] = [];

    for (const table of tables) {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      for (const col of tableSchema.columns) {
        if (isDateType(col.data_type)) {
          options.push({
            value: `${table.id}.${col.name}`,
            label:
              tables.length > 1
                ? `${table.alias ?? table.name}.${col.name}`
                : col.name,
            tableId: table.id,
          });
        }
      }
    }

    return options;
  }, [tables, schema.tables]);

  // Determine current values
  const isEnabled = config !== undefined;
  const currentDateColumn = config
    ? `${config.table_id}.${config.date_column}`
    : selectedDateColumn
      ? `${selectedDateColumn.table_id}.${selectedDateColumn.column}`
      : dateColumnOptions[0]?.value ?? '';
  const currentInterval = config?.interval ?? 'day';
  const fillMissing = config?.fill_missing ?? false;
  const fillValue = config?.fill_value ?? 0;

  // Handle enabling/disabling time series
  const handleToggle = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.checked) {
      onChange(undefined);
      return;
    }

    if (!currentDateColumn) {
      console.warn('Cannot enable time series: no date column available');
      return;
    }

    const parsed = parseColumnRef(currentDateColumn, 't1');
    if (!parsed) {
      console.warn('Cannot enable time series: invalid date column reference');
      return;
    }

    onChange({
      table_id: parsed.tableId,
      date_column: parsed.column,
      interval: 'day',
      fill_missing: false,
    });
  };

  // Handle date column change
  const handleDateColumnChange = (value: string) => {
    if (!config || !value) return;

    const parsed = parseColumnRef(value, config.table_id);
    if (!parsed) {
      return;
    }

    onChange({
      ...config,
      table_id: parsed.tableId,
      date_column: parsed.column,
    });
  };

  // Handle interval change
  const handleIntervalChange = (value: string) => {
    if (!config) return;
    onChange({
      ...config,
      interval: value as TimeSeriesInterval,
    });
  };

  // Handle fill missing toggle
  const handleFillMissingChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    onChange({
      ...config,
      fill_missing: e.target.checked,
      fill_value: e.target.checked ? (config.fill_value ?? 0) : undefined,
    });
  };

  // Handle fill value change
  const handleFillValueChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    const value = parseFloat(e.target.value);
    onChange({
      ...config,
      fill_value: isNaN(value) ? 0 : value,
    });
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
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

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  };

  // No date columns available
  if (dateColumnOptions.length === 0) {
    return (
      <div style={containerStyle}>
        <span style={helpTextStyle}>
          No date/timestamp columns available in selected tables
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Enable Time Series Toggle */}
      <Checkbox
        label="Enable Time Series Mode"
        checked={isEnabled}
        onChange={handleToggle}
      />
      <span style={helpTextStyle}>
        Automatically bucket dates and optionally fill missing time periods
      </span>

      {isEnabled && (
        <>
          {/* Date Column Selection */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Date Column</label>
            <Select
              value={currentDateColumn}
              onChange={handleDateColumnChange}
              options={dateColumnOptions}
            />
          </div>

          {/* Interval Selection */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Time Interval</label>
            <Select
              value={currentInterval}
              onChange={handleIntervalChange}
              options={INTERVAL_OPTIONS}
            />
            <span style={helpTextStyle}>
              Group data into buckets of this size
            </span>
          </div>

          {/* Fill Missing Toggle */}
          <Checkbox
            label="Fill Missing Periods"
            checked={fillMissing}
            onChange={handleFillMissingChange}
          />

          {/* Fill Value (when fill missing is enabled) */}
          {fillMissing && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Fill Value</label>
              <div style={rowStyle}>
                <Input
                  type="number"
                  value={String(fillValue)}
                  onChange={handleFillValueChange}
                  style={{ width: '100px' }}
                />
                <span style={helpTextStyle}>
                  Value for missing time periods
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
