/**
 * Multi-select filter component with dynamic option loading.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import { useDynamicFilterOptions } from './useDynamicFilterOptions';
import type { MultiSelectFilterProps } from '../types';

/**
 * Multi-select dropdown filter.
 *
 * Supports dynamic option loading when filter.dynamic is true.
 */
export function MultiSelectFilter({
  filter,
  value,
  onChange,
}: MultiSelectFilterProps): JSX.Element {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load dynamic options if filter.dynamic is true
  const { isLoading, options } = useDynamicFilterOptions(filter);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleOptionClick = useCallback(
    (optionValue: string) => {
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue];
      onChange(newValue);
    },
    [value, onChange]
  );

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    minWidth: '150px',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    cursor: 'pointer',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: theme.spacing.xs,
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    boxShadow: theme.shadows.md,
    zIndex: 1000,
    maxHeight: '200px',
    overflowY: 'auto' as const,
  };

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    cursor: 'pointer',
    borderRadius: theme.radius.sm,
  };

  const checkboxStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  };

  const displayText = isLoading
    ? 'Loading...'
    : value.length === 0
      ? 'All'
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `${value.length} selected`;

  return (
    <div ref={containerRef} style={containerStyle}>
      <button
        type="button"
        onClick={handleToggle}
        style={{
          ...buttonStyle,
          cursor: isLoading ? 'wait' : 'pointer',
          opacity: isLoading ? 0.7 : 1,
        }}
        aria-label={filter.label}
        aria-expanded={isOpen}
        disabled={isLoading}
      >
        <span>{displayText}</span>
        <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} />
      </button>

      {isOpen && !isLoading && (
        <div style={dropdownStyle}>
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <div
                key={option.value}
                onClick={() => handleOptionClick(option.value)}
                style={{
                  ...optionStyle,
                  backgroundColor: isSelected ? theme.colors.surfaceHover : 'transparent',
                }}
              >
                <div
                  style={{
                    ...checkboxStyle,
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.background,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  }}
                >
                  {isSelected && <Icon name="check" size={12} style={{ color: theme.colors.textInverse }} />}
                </div>
                <span>{option.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
