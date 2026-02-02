/**
 * Multi-select filter component with dynamic option loading.
 *
 * Features:
 * - "All" option at top (visually selects/deselects all options)
 * - Deferred apply (changes only apply on "Apply" button click)
 * - Search functionality
 * - Item count display
 * - "clear all" link
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import { useDynamicFilterOptions } from './useDynamicFilterOptions';
import type { MultiSelectFilterProps } from '../types';

/**
 * Multi-select dropdown filter with deferred apply.
 *
 * Supports dynamic option loading when filter.dynamic is true.
 *
 * Note: External value [] means "no filter" (show all data).
 * Internally, we track actual selections. When all options are selected,
 * we send [] to the backend (no filter needed).
 */
export function MultiSelectFilter({
  filter,
  value,
  onChange,
}: MultiSelectFilterProps): JSX.Element {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Local state for pending selections (before Apply)
  // Stores actual selected option values
  const [pendingValue, setPendingValue] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load dynamic options if filter.dynamic is true
  const { isLoading, options } = useDynamicFilterOptions(filter);

  // Sync pending value when external value or options change
  // External [] means "all" → set pendingValue to all option values
  // External [specific values] → use those values
  useEffect(() => {
    if (options.length === 0) return; // Wait for options to load

    if (value.length === 0) {
      // External "all" (no filter) → select all options internally
      setPendingValue(options.map((o) => o.value));
    } else {
      setPendingValue(value);
    }
  }, [value, options]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Helper to get the "all selected" state for current options
  const getAllSelectedValue = useCallback(() => {
    return options.map((o) => o.value);
  }, [options]);

  // Close when clicking outside (without applying)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset pending to current value (discard changes)
        if (value.length === 0) {
          // External "all" → reset to all options selected
          setPendingValue(getAllSelectedValue());
        } else {
          setPendingValue(value);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, getAllSelectedValue]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Check if "All" is selected (all options are in pendingValue)
  const isAllSelected = options.length > 0 && pendingValue.length === options.length;

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Toggle all selection
  const handleAllClick = useCallback(() => {
    if (isAllSelected) {
      // Deselect all
      setPendingValue([]);
    } else {
      // Select all
      setPendingValue(options.map((o) => o.value));
    }
  }, [isAllSelected, options]);

  const handleOptionClick = useCallback((optionValue: string) => {
    setPendingValue((prev) => {
      if (prev.includes(optionValue)) {
        return prev.filter((v) => v !== optionValue);
      }
      return [...prev, optionValue];
    });
  }, []);

  // Clear all selections (deselect everything)
  const handleClearAll = useCallback(() => {
    setPendingValue([]);
  }, []);

  const handleApply = useCallback(() => {
    // If all options are selected, send [] to backend (no filter)
    // Otherwise send the actual selection
    const valueToSend = pendingValue.length === options.length ? [] : pendingValue;
    onChange(valueToSend);
    setIsOpen(false);
  }, [onChange, pendingValue, options.length]);

  // Styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    minWidth: '180px',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
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
    minWidth: '250px',
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    boxShadow: theme.shadows.md,
    zIndex: 1000,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const searchContainerStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.sans,
    outline: 'none',
  };

  const optionsContainerStyle: React.CSSProperties = {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: theme.spacing.xs,
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
    width: '18px',
    height: '18px',
    border: `2px solid ${theme.colors.border}`,
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    flexShrink: 0,
  };

  const footerStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
  };

  const applyButtonStyle: React.CSSProperties = {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: '#fff',
    backgroundColor: theme.colors.primary,
    border: 'none',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    fontFamily: theme.fonts.sans,
  };

  const clearAllStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    fontFamily: theme.fonts.sans,
  };

  const countStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  };

  // Display text for button
  // External value [] means "All", otherwise show count or single value
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
          {/* Header with label and clear all */}
          <div style={headerStyle}>
            <span style={countStyle}>{options.length} items</span>
            <button
              type="button"
              style={clearAllStyle}
              onClick={handleClearAll}
            >
              clear all
            </button>
          </div>

          {/* Search input */}
          <div style={searchContainerStyle}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
              autoFocus
            />
          </div>

          {/* Options list */}
          <div style={optionsContainerStyle}>
            {/* "All" option */}
            <div
              onClick={handleAllClick}
              style={{
                ...optionStyle,
                backgroundColor: isAllSelected ? theme.colors.surfaceHover : 'transparent',
              }}
            >
              <div
                style={{
                  ...checkboxStyle,
                  backgroundColor: isAllSelected ? theme.colors.primary : theme.colors.background,
                  borderColor: isAllSelected ? theme.colors.primary : theme.colors.border,
                }}
              >
                {isAllSelected && (
                  <Icon name="check" size={12} style={{ color: '#fff' }} />
                )}
              </div>
              <span>All</span>
            </div>

            {/* Individual options */}
            {filteredOptions.map((option) => {
              const isSelected = pendingValue.includes(option.value);
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
                    {isSelected && (
                      <Icon name="check" size={12} style={{ color: '#fff' }} />
                    )}
                  </div>
                  <span>{option.label}</span>
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div style={{ ...optionStyle, color: theme.colors.textMuted, cursor: 'default' }}>
                No results found
              </div>
            )}
          </div>

          {/* Footer with Apply button */}
          <div style={footerStyle}>
            <button
              type="button"
              style={applyButtonStyle}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
