/**
 * FilterValueInput component for entering filter values.
 *
 * Supports dynamic value loading from database when tableName and columnName are provided.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAnalytics } from '../../context';
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
  /** Table name for fetching sample values. */
  tableName?: string;
  /** Column name for fetching sample values. */
  columnName?: string;
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

const comboboxContainerStyles: React.CSSProperties = {
  position: 'relative',
  flex: 1,
};

const dropdownStyles: React.CSSProperties = {
  position: 'fixed',
  backgroundColor: 'var(--prismiq-color-background)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  boxShadow: 'var(--prismiq-shadow-md)',
  zIndex: 1000,
  maxHeight: '200px',
  overflow: 'auto',
};

const optionStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  cursor: 'pointer',
  fontSize: 'var(--prismiq-font-size-sm)',
  transition: 'background-color 0.1s',
};

const optionHoverStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface-hover)',
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
 * When tableName and columnName are provided, fetches sample values from database.
 */
export function FilterValueInput({
  operator,
  value,
  onChange,
  dataType,
  disabled = false,
  className,
  tableName,
  columnName,
}: FilterValueInputProps): JSX.Element {
  const { client } = useAnalytics();
  const inputType = getInputType(dataType);

  // State for sample values
  const [sampleValues, setSampleValues] = useState<string[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const fetchedRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);

  // Fetch sample values when table and column are available
  useEffect(() => {
    if (!tableName || !columnName || !client) {
      setSampleValues([]);
      setIsLoadingValues(false);
      fetchedRef.current = null;
      return;
    }

    // Avoid refetching for the same column
    const fetchKey = `${tableName}.${columnName}`;
    if (fetchedRef.current === fetchKey) return;
    const fetchSeq = ++fetchSeqRef.current;

    const fetchSamples = async () => {
      setIsLoadingValues(true);
      try {
        const values = await client.getColumnSample(tableName, columnName, 100);
        const stringValues = values
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v));
        if (fetchSeqRef.current !== fetchSeq) return;
        setSampleValues(stringValues);
        fetchedRef.current = fetchKey;
      } catch (err) {
        if (fetchSeqRef.current !== fetchSeq) return;
        console.error('Failed to fetch sample values:', err);
        setSampleValues([]);
        fetchedRef.current = null;
      } finally {
        if (fetchSeqRef.current === fetchSeq) {
          setIsLoadingValues(false);
        }
      }
    };

    fetchSamples();
  }, [client, tableName, columnName]);

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

  // IN, NOT IN, and IN OR NULL operators need comma-separated values
  if (operator === 'in_' || operator === 'not_in' || operator === 'in_or_null') {
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

  // Combobox state for dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter sample values based on current input
  const currentValueStr = formatValue(value);
  const filteredOptions = sampleValues.filter((v) =>
    v.toLowerCase().includes(currentValueStr.toLowerCase())
  );

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);
      if (!isInsideContainer && !isInsideDropdown) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputFocus = useCallback(() => {
    if (sampleValues.length > 0) {
      updateDropdownPosition();
      setIsDropdownOpen(true);
      setHighlightedIndex(-1);
    }
  }, [sampleValues.length, updateDropdownPosition]);

  const handleOptionSelect = useCallback(
    (optionValue: string) => {
      onChange(parseValue(optionValue, dataType));
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    },
    [onChange, dataType]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isDropdownOpen || filteredOptions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleOptionSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsDropdownOpen(false);
          break;
      }
    },
    [isDropdownOpen, filteredOptions, highlightedIndex, handleOptionSelect]
  );

  // Single value input with custom combobox dropdown
  return (
    <div className={className} style={containerStyles}>
      <div ref={containerRef} style={comboboxContainerStyles}>
        <Input
          ref={inputRef}
          inputSize="sm"
          type={inputType}
          placeholder={isLoadingValues ? 'Loading...' : 'Type or select value'}
          value={currentValueStr}
          disabled={disabled || isLoadingValues}
          onChange={(e) => {
            onChange(parseValue(e.target.value, dataType));
            if (sampleValues.length > 0) {
              updateDropdownPosition();
              setIsDropdownOpen(true);
            }
          }}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          style={{ width: '100%' }}
        />
        {isDropdownOpen && filteredOptions.length > 0 && typeof document !== 'undefined' && createPortal(
          <div
            ref={dropdownRef}
            style={{
              ...dropdownStyles,
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {filteredOptions.map((optionValue, index) => (
              <div
                key={`${optionValue}-${index}`}
                onClick={() => handleOptionSelect(optionValue)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  ...optionStyles,
                  ...(index === highlightedIndex ? optionHoverStyles : {}),
                  ...(optionValue === currentValueStr
                    ? { backgroundColor: 'var(--prismiq-color-surface)', fontWeight: 500 }
                    : {}),
                }}
              >
                {optionValue}
              </div>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
