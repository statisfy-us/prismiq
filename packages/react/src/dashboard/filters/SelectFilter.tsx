/**
 * Select filter component.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import type { SelectFilterProps } from '../types';

/**
 * Single select dropdown filter.
 */
export function SelectFilter({
  filter,
  value,
  onChange,
}: SelectFilterProps): JSX.Element {
  const { theme } = useTheme();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value || null;
      onChange(newValue);
    },
    [onChange]
  );

  const selectStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    paddingRight: theme.spacing.lg,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    minWidth: '150px',
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    cursor: 'pointer',
  };

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      style={selectStyle}
      aria-label={filter.label}
    >
      <option value="">All</option>
      {filter.options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
