/**
 * Select filter component with dynamic option loading.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import { useDynamicFilterOptions } from './useDynamicFilterOptions';
import type { SelectFilterProps } from '../types';

/**
 * Single select dropdown filter.
 *
 * Supports dynamic option loading when filter.dynamic is true.
 */
export function SelectFilter({
  filter,
  value,
  onChange,
}: SelectFilterProps): JSX.Element {
  const { theme } = useTheme();

  // Load dynamic options if filter.dynamic is true
  const { isLoading, options } = useDynamicFilterOptions(filter);

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
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
  };

  return (
    <select
      value={value ?? ''}
      onChange={handleChange}
      style={selectStyle}
      aria-label={filter.label}
      disabled={isLoading}
    >
      <option value="">{isLoading ? 'Loading...' : 'All'}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
