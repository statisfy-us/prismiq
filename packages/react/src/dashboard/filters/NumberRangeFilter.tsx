/**
 * Number range filter component with min/max inputs.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import type { NumberRangeFilterProps } from '../types';

/**
 * Number range filter with min and max inputs.
 */
export function NumberRangeFilter({
  filter,
  value,
  onChange,
  debounceMs = 500,
}: NumberRangeFilterProps & { debounceMs?: number }): JSX.Element {
  const { theme } = useTheme();
  const [localMin, setLocalMin] = useState<string>(
    value?.min != null ? String(value.min) : ''
  );
  const [localMax, setLocalMax] = useState<string>(
    value?.max != null ? String(value.max) : ''
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local values when prop changes
  useEffect(() => {
    setLocalMin(value?.min != null ? String(value.min) : '');
    setLocalMax(value?.max != null ? String(value.max) : '');
  }, [value?.min, value?.max]);

  const emitChange = useCallback(
    (min: string, max: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange({
          min: min !== '' ? Number(min) : null,
          max: max !== '' ? Number(max) : null,
        });
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalMin(val);
      emitChange(val, localMax);
    },
    [emitChange, localMax]
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalMax(val);
      emitChange(localMin, val);
    },
    [emitChange, localMin]
  );

  const handleClear = useCallback(() => {
    setLocalMin('');
    setLocalMax('');
    onChange({ min: null, max: null });
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const hasValue = localMin !== '' || localMax !== '';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
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
    width: '80px',
  };

  const separatorStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
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
        type="number"
        value={localMin}
        onChange={handleMinChange}
        placeholder="Min"
        style={inputStyle}
        aria-label={`${filter.label} minimum`}
      />
      <span style={separatorStyle}>–</span>
      <input
        type="number"
        value={localMax}
        onChange={handleMaxChange}
        placeholder="Max"
        style={inputStyle}
        aria-label={`${filter.label} maximum`}
      />
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
