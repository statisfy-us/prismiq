/**
 * Filter bar component for dashboard filters.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import { Button } from '../../components/ui';
import { DateRangeFilter } from './DateRangeFilter';
import { SelectFilter } from './SelectFilter';
import { MultiSelectFilter } from './MultiSelectFilter';
import { TextFilter } from './TextFilter';
import type { FilterBarProps, DashboardFilter, FilterValue, DateRangeValue } from '../types';

/**
 * Get filter value from values array.
 */
function getFilterValue(filterId: string, values: FilterValue[]): unknown {
  const filterValue = values.find((fv) => fv.filter_id === filterId);
  return filterValue?.value;
}

/**
 * FilterBar component displays all dashboard filters.
 */
export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  className = '',
}: FilterBarProps): JSX.Element | null {
  const { theme } = useTheme();

  const handleReset = useCallback(() => {
    onReset?.();
  }, [onReset]);

  if (filters.length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  };

  const filterGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    fontWeight: 500,
    color: theme.colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const actionsStyle: React.CSSProperties = {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'flex-end',
  };

  return (
    <div className={`prismiq-filter-bar ${className}`} style={containerStyle}>
      {filters.map((filter) => (
        <div key={filter.id} style={filterGroupStyle}>
          <label style={labelStyle}>{filter.label}</label>
          {renderFilter(filter, values, onChange)}
        </div>
      ))}

      {onReset && (
        <div style={actionsStyle}>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Render the appropriate filter component based on type.
 */
function renderFilter(
  filter: DashboardFilter,
  values: FilterValue[],
  onChange: (filterId: string, value: unknown) => void
): JSX.Element {
  const value = getFilterValue(filter.id, values);

  switch (filter.type) {
    case 'date_range':
      return (
        <DateRangeFilter
          filter={filter}
          value={(value as DateRangeValue | string | null) ?? null}
          onChange={(v) => onChange(filter.id, v)}
        />
      );

    case 'select':
      return (
        <SelectFilter
          filter={filter}
          value={(value as string | null) ?? null}
          onChange={(v) => onChange(filter.id, v)}
        />
      );

    case 'multi_select':
      return (
        <MultiSelectFilter
          filter={filter}
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(filter.id, v)}
        />
      );

    case 'text':
      return (
        <TextFilter
          filter={filter}
          value={(value as string) ?? ''}
          onChange={(v) => onChange(filter.id, v)}
        />
      );

    case 'number_range':
      // Fallback to text filter for now
      return (
        <TextFilter
          filter={filter}
          value={(value as string) ?? ''}
          onChange={(v) => onChange(filter.id, v)}
        />
      );

    default:
      return <div>Unknown filter type</div>;
  }
}
