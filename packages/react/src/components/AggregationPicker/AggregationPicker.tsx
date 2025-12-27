/**
 * AggregationPicker component for selecting column aggregations.
 */

import { useMemo } from 'react';

import type { AggregationType } from '../../types';
import { Icon, Select, Tooltip, type SelectOption, type IconName } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface AggregationPickerProps {
  /** Current aggregation value. */
  value: AggregationType;
  /** Callback when aggregation changes. */
  onChange: (aggregation: AggregationType) => void;
  /** Column data type for filtering applicable aggregations. */
  columnType: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Constants
// ============================================================================

interface AggregationInfo {
  value: AggregationType;
  label: string;
  description: string;
  icon: IconName;
}

const aggregationInfo: AggregationInfo[] = [
  {
    value: 'none',
    label: 'None',
    description: 'Return raw values without aggregation',
    icon: 'minus',
  },
  {
    value: 'sum',
    label: 'Sum',
    description: 'Calculate the sum of all values',
    icon: 'plus',
  },
  {
    value: 'avg',
    label: 'Average',
    description: 'Calculate the average (mean) of all values',
    icon: 'minus',
  },
  {
    value: 'count',
    label: 'Count',
    description: 'Count the number of rows',
    icon: 'column',
  },
  {
    value: 'count_distinct',
    label: 'Count Distinct',
    description: 'Count the number of unique values',
    icon: 'column',
  },
  {
    value: 'min',
    label: 'Min',
    description: 'Find the minimum value',
    icon: 'chevron-down',
  },
  {
    value: 'max',
    label: 'Max',
    description: 'Find the maximum value',
    icon: 'chevron-up',
  },
];

/**
 * Get available aggregations based on column data type.
 */
function getAvailableAggregations(dataType: string): AggregationType[] {
  const type = dataType.toLowerCase();

  // Numeric types - all aggregations available
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  ) {
    return ['none', 'sum', 'avg', 'count', 'count_distinct', 'min', 'max'];
  }

  // Date/time types - count, count_distinct, min, max
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return ['none', 'count', 'count_distinct', 'min', 'max'];
  }

  // Boolean - count, count_distinct
  if (type === 'boolean' || type === 'bool') {
    return ['none', 'count', 'count_distinct'];
  }

  // String/other - count, count_distinct
  return ['none', 'count', 'count_distinct'];
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Dropdown picker for selecting column aggregation functions.
 *
 * @example
 * ```tsx
 * <AggregationPicker
 *   value={column.aggregation}
 *   onChange={(agg) => updateColumn({ ...column, aggregation: agg })}
 *   columnType="integer"
 * />
 * ```
 */
export function AggregationPicker({
  value,
  onChange,
  columnType,
  disabled = false,
  size = 'sm',
  className,
  style,
}: AggregationPickerProps): JSX.Element {
  // Get available aggregations for this column type
  const availableAggregations = useMemo(
    () => getAvailableAggregations(columnType),
    [columnType]
  );

  // Build options with tooltips
  const options: SelectOption<AggregationType>[] = useMemo(
    () =>
      aggregationInfo
        .filter((info) => availableAggregations.includes(info.value))
        .map((info) => ({
          value: info.value,
          label: info.label,
        })),
    [availableAggregations]
  );

  // Get current aggregation info
  const currentInfo = aggregationInfo.find((info) => info.value === value);

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <Tooltip
        content={currentInfo?.description ?? 'Select aggregation'}
        position="top"
        delay={300}
      >
        <span style={{ display: 'inline-flex' }}>
          <Icon
            name={currentInfo?.icon ?? 'minus'}
            size={14}
            style={{ color: 'var(--prismiq-color-text-muted)' }}
          />
        </span>
      </Tooltip>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        size={size}
      />
    </div>
  );
}
