/**
 * Date range filter component.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import { useAnalytics } from '../../context';
import { Icon } from '../../components/ui';
import type { DateRangeFilterProps, DateRangeValue } from '../types';
import { DATE_PRESET_LABELS, resolveDatePreset } from '../datePresets';

/**
 * Date range filter with start/end date inputs.
 *
 * A value carrying only a `preset` (e.g. from the filter's `date_preset`
 * default) shows the dates that preset resolves to on the tenant's fiscal
 * calendar, so the inputs always reflect the window actually being queried.
 * Editing either date drops the preset and keeps the explicit range.
 */
export function DateRangeFilter({
  filter,
  value,
  onChange,
}: DateRangeFilterProps): JSX.Element {
  const { theme } = useTheme();
  const { fiscalYearStartMonth } = useAnalytics();

  // Parse value
  const dateValue: DateRangeValue = typeof value === 'object' && value
    ? value
    : { start: '', end: '' };

  const activePreset =
    dateValue.preset && !dateValue.start && !dateValue.end ? dateValue.preset : null;

  // Dates shown in the inputs: explicit values, or what the preset resolves to.
  const resolved = activePreset
    ? resolveDatePreset(activePreset, fiscalYearStartMonth)
    : null;
  const shownStart = resolved?.start ?? dateValue.start ?? '';
  const shownEnd = resolved?.end ?? dateValue.end ?? '';

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ start: e.target.value, end: shownEnd });
    },
    [shownEnd, onChange]
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ start: shownStart, end: e.target.value });
    },
    [shownStart, onChange]
  );

  const handleClear = useCallback(() => {
    onChange({ start: '', end: '' });
  }, [onChange]);

  const hasValue = shownStart !== '' || shownEnd !== '';

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

  const presetLabelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
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
      <input
        type="date"
        value={shownStart}
        onChange={handleStartChange}
        style={inputStyle}
        aria-label={`${filter.label} start date`}
      />
      <span style={separatorStyle}>to</span>
      <input
        type="date"
        value={shownEnd}
        onChange={handleEndChange}
        style={inputStyle}
        aria-label={`${filter.label} end date`}
      />
      {activePreset && (
        <span style={presetLabelStyle}>
          {DATE_PRESET_LABELS[activePreset] ?? activePreset}
        </span>
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
