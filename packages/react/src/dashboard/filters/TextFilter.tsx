/**
 * Text filter component with debouncing.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import type { TextFilterProps } from '../types';

/**
 * Text input filter with debounced updates.
 */
export function TextFilter({
  filter,
  value,
  onChange,
  debounceMs = 300,
}: TextFilterProps): JSX.Element {
  const { theme } = useTheme();
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Debounce the onChange call
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    paddingLeft: theme.spacing.lg,
    paddingRight: localValue ? theme.spacing.lg : theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    minWidth: '150px',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: theme.spacing.sm,
    color: theme.colors.textMuted,
    pointerEvents: 'none' as const,
  };

  const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: theme.spacing.xs,
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
      <Icon name="search" size={14} style={iconStyle} />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={filter.label}
        style={inputStyle}
        aria-label={filter.label}
      />
      {localValue && (
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
