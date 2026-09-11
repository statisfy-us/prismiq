/**
 * Date range filter component.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import type { DateRangeFilterProps, DateRangeValue } from '../types';

/** Human-readable labels for relative date presets. */
const PRESET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  last_quarter: 'Last Quarter',
  this_year: 'This Year',
  last_year: 'Last Year',
  all_time: 'All Time',
};

/**
 * Date range filter with start/end date inputs.
 *
 * A value carrying only a `preset` (e.g. from the filter's `date_preset`
 * default) renders as a labeled chip; the backend resolves the preset to
 * concrete dates against the tenant's fiscal calendar. Picking an explicit
 * date replaces the preset.
 */
export function DateRangeFilter({
  filter,
  value,
  onChange,
}: DateRangeFilterProps): JSX.Element {
  const { theme } = useTheme();

  // Parse value
  const dateValue: DateRangeValue = typeof value === 'object' && value
    ? value
    : { start: '', end: '' };

  const isPreset = Boolean(dateValue.preset) && !dateValue.start && !dateValue.end;

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue: DateRangeValue = {
        start: e.target.value,
        end: dateValue.end ?? '',
      };
      onChange(newValue);
    },
    [dateValue.end, onChange]
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue: DateRangeValue = {
        start: dateValue.start ?? '',
        end: e.target.value,
      };
      onChange(newValue);
    },
    [dateValue.start, onChange]
  );

  const handleClear = useCallback(() => {
    onChange({ start: '', end: '' });
  }, [onChange]);

  const hasValue = isPreset || dateValue.start !== '' || dateValue.end !== '';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  };

  const inputStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    minWidth: '130px',
  };

  const separatorStyle: React.CSSProperties = {
    color: theme.colors.textMuted,
  };

  const presetChipStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    whiteSpace: 'nowrap',
  };

  const clearButtonStyle: React.CSSProperties = {
    padding: theme.spacing.xs,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={containerStyle}>
      {isPreset ? (
        <span style={presetChipStyle} aria-label={`${filter.label} preset`}>
          {PRESET_LABELS[dateValue.preset ?? ''] ?? dateValue.preset}
        </span>
      ) : (
        <>
          <input
            type="date"
            value={dateValue.start ?? ''}
            onChange={handleStartChange}
            style={inputStyle}
            aria-label={`${filter.label} start date`}
          />
          <span style={separatorStyle}>to</span>
          <input
            type="date"
            value={dateValue.end ?? ''}
            onChange={handleEndChange}
            style={inputStyle}
            aria-label={`${filter.label} end date`}
          />
        </>
      )}
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          style={clearButtonStyle}
          aria-label="Clear filter"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}
