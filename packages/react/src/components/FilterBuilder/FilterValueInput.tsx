/**
 * FilterValueInput component for entering filter values.
 */

import type { FilterOperator } from '../../types';
import { Input } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface FilterValueInputProps {
  /** Filter operator. */
  operator: FilterOperator;
  /** Current value. */
  value: unknown;
  /** Callback when value changes. */
  onChange: (value: unknown) => void;
  /** Column data type. */
  dataType?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  flex: 1,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a value based on data type.
 */
function parseValue(value: string, dataType?: string): unknown {
  if (!value) return undefined;

  const type = dataType?.toLowerCase() ?? '';

  // Numeric types
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  ) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }

  // Boolean
  if (type === 'boolean' || type === 'bool') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    return value;
  }

  return value;
}

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * Get input type based on data type.
 */
function getInputType(dataType?: string): 'text' | 'number' | 'date' {
  const type = dataType?.toLowerCase() ?? '';

  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  ) {
    return 'number';
  }

  if (type.includes('date') && !type.includes('time')) {
    return 'date';
  }

  return 'text';
}

// ============================================================================
// Component
// ============================================================================

/**
 * Input component for filter values that adapts to the operator and data type.
 */
export function FilterValueInput({
  operator,
  value,
  onChange,
  dataType,
  disabled = false,
  className,
}: FilterValueInputProps): JSX.Element {
  const inputType = getInputType(dataType);

  // No input needed for null operators
  if (operator === 'is_null' || operator === 'is_not_null') {
    return <></>;
  }

  // Between operator needs two inputs
  if (operator === 'between') {
    const [min, max] = Array.isArray(value) ? value : [undefined, undefined];

    return (
      <div className={className} style={containerStyles}>
        <Input
          inputSize="sm"
          type={inputType}
          placeholder="Min"
          value={formatValue(min)}
          disabled={disabled}
          onChange={(e) => {
            const newMin = parseValue(e.target.value, dataType);
            onChange([newMin, max]);
          }}
          style={{ flex: 1 }}
        />
        <span style={{ color: 'var(--prismiq-color-text-muted)' }}>and</span>
        <Input
          inputSize="sm"
          type={inputType}
          placeholder="Max"
          value={formatValue(max)}
          disabled={disabled}
          onChange={(e) => {
            const newMax = parseValue(e.target.value, dataType);
            onChange([min, newMax]);
          }}
          style={{ flex: 1 }}
        />
      </div>
    );
  }

  // IN and NOT IN operators need comma-separated values
  if (operator === 'in_' || operator === 'not_in') {
    const handleMultiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const values = e.target.value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => parseValue(v, dataType));
      onChange(values);
    };

    return (
      <div className={className} style={containerStyles}>
        <Input
          inputSize="sm"
          type="text"
          placeholder="value1, value2, ..."
          value={formatValue(value)}
          disabled={disabled}
          onChange={handleMultiChange}
          style={{ flex: 1 }}
        />
      </div>
    );
  }

  // Single value input
  return (
    <div className={className} style={containerStyles}>
      <Input
        inputSize="sm"
        type={inputType}
        placeholder="Value"
        value={formatValue(value)}
        disabled={disabled}
        onChange={(e) => onChange(parseValue(e.target.value, dataType))}
        style={{ flex: 1 }}
      />
    </div>
  );
}
