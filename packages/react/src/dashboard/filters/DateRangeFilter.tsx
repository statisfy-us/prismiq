/**
 * Date range filter component.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import type { DateRangeFilterProps, DateRangeValue } from '../types';

/**
 * Date range filter with start/end date inputs.
 */
export function DateRangeFilter({
  filter,
  value,
  onChange,
}: DateRangeFilterProps): JSX.Element {
  const { theme } = useTheme();

  // Parse value
  const dateValue = typeof value === 'object' && value
    ? value
    : { start: '', end: '' };

  const handleStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue: DateRangeValue = {
        start: e.target.value,
        end: dateValue.end,
      };
      onChange(newValue);
    },
    [dateValue.end, onChange]
  );

  const handleEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue: DateRangeValue = {
        start: dateValue.start,
        end: e.target.value,
      };
      onChange(newValue);
    },
    [dateValue.start, onChange]
  );

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

  return (
    <div style={containerStyle}>
      <input
        type="date"
        value={dateValue.start}
        onChange={handleStartChange}
        style={inputStyle}
        aria-label={`${filter.label} start date`}
      />
      <span style={separatorStyle}>to</span>
      <input
        type="date"
        value={dateValue.end}
        onChange={handleEndChange}
        style={inputStyle}
        aria-label={`${filter.label} end date`}
      />
    </div>
  );
}
