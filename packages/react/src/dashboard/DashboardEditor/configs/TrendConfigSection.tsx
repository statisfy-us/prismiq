/**
 * TrendConfigSection component for configuring metric trend comparisons.
 *
 * Allows setting:
 * - Show trend indicator toggle
 * - Comparison period (previous period, year, month, week)
 * - Date column to use for comparison
 */

import { useMemo, type ChangeEvent } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';
import type { QueryDefinition, DatabaseSchema } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface TrendConfigSectionProps {
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

const TREND_PERIOD_OPTIONS = [
  { value: 'previous_period', label: 'Previous Period' },
  { value: 'previous_year', label: 'Previous Year' },
  { value: 'previous_month', label: 'Previous Month' },
  { value: 'previous_week', label: 'Previous Week' },
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
 * Trend comparison configuration section.
 */
export function TrendConfigSection({
  config,
  onChange,
  query,
  schema,
  defaultOpen = false,
}: TrendConfigSectionProps): JSX.Element {
  const { theme } = useTheme();

  // Find date columns in the current query's tables
  const dateColumnOptions = useMemo(() => {
    if (!query || !schema) return [];

    const options: { value: string; label: string }[] = [];

    for (const table of query.tables) {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      for (const col of tableSchema.columns) {
        if (isDateType(col.data_type)) {
          options.push({
            value: `${table.id}.${col.name}`,
            label: `${table.alias ?? table.name}.${col.name}`,
          });
        }
      }
    }

    return options;
  }, [query, schema]);

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

  return (
    <CollapsibleSection title="Trend Comparison" defaultOpen={defaultOpen}>
      <div style={fieldStyle}>
        <Checkbox
          label="Show Trend Indicator"
          checked={config.showTrend ?? false}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('showTrend', e.target.checked)
          }
        />
        <div style={helpTextStyle}>
          Compare current value to a previous time period
        </div>
      </div>

      {config.showTrend && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Comparison Period</label>
            <Select
              value={config.trendPeriod || 'previous_period'}
              onChange={(value) =>
                onChange('trendPeriod', value as WidgetConfig['trendPeriod'])
              }
              options={TREND_PERIOD_OPTIONS}
            />
          </div>

          {dateColumnOptions.length > 0 && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Date Column</label>
              <Select
                value={config.trendDateColumn || ''}
                onChange={(value) => onChange('trendDateColumn', value || undefined)}
                options={[
                  { value: '', label: 'Auto-detect' },
                  ...dateColumnOptions,
                ]}
              />
              <div style={helpTextStyle}>
                Column used to determine time periods
              </div>
            </div>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}
