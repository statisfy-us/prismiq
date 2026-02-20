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

/**
 * Check if an operator accepts multiple values.
 */
function isMultiValueOperator(op: FilterOperator): boolean {
  return op === 'in_' || op === 'not_in' || op === 'in_or_null';
}

// ============================================================================
// Tag styles for multi-value input
// ============================================================================

const tagContainerStyles: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px',
  padding: '4px 8px',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-sm)',
  backgroundColor: 'var(--prismiq-color-background)',
  minHeight: '32px',
  cursor: 'text',
  flex: 1,
};

const tagStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '1px 6px',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-sm)',
  fontSize: 'var(--prismiq-font-size-sm)',
  lineHeight: '20px',
  whiteSpace: 'nowrap',
};

const tagRemoveStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '14px',
  height: '14px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  padding: 0,
  fontSize: '12px',
  lineHeight: 1,
  color: 'var(--prismiq-color-text-muted)',
  borderRadius: '50%',
};

const tagInputStyles: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'none',
  flex: 1,
  minWidth: '80px',
  fontSize: 'var(--prismiq-font-size-sm)',
  padding: '2px 0',
  color: 'var(--prismiq-color-text)',
};

const multiOptionCheckStyles: React.CSSProperties = {
  marginRight: '6px',
  color: 'var(--prismiq-color-primary)',
  fontWeight: 700,
  fontSize: '12px',
};

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
  const isMulti = isMultiValueOperator(operator);

  // State for sample values
  const [sampleValues, setSampleValues] = useState<string[]>([]);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const fetchedRef = useRef<string | null>(null);
  const fetchSeqRef = useRef(0);

  // Combobox state for dropdown (must be declared before conditional returns)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Multi-value: text being typed before committing as a tag
  const [multiInputText, setMultiInputText] = useState('');

  // Reset multi-input text when operator changes (e.g. from in_ to eq)
  useEffect(() => {
    setMultiInputText('');
  }, [operator]);

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

  // Current selected values as string array (for multi-value operators)
  const selectedValues: string[] = isMulti && Array.isArray(value)
    ? value
        .filter((v: unknown) => v !== null && v !== undefined)
        .map((v: unknown) => String(v))
    : [];

  // Filter sample values based on current input
  const currentValueStr = isMulti ? multiInputText : formatValue(value);
  const filteredOptions = isMulti
    ? sampleValues.filter(
        (v) =>
          v.toLowerCase().includes(multiInputText.toLowerCase()) &&
          !selectedValues.includes(v)
      )
    : sampleValues.filter((v) =>
        v.toLowerCase().includes(currentValueStr.toLowerCase())
      );

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    const el = isMulti ? containerRef.current : inputRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isMulti]);

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

  // Single-value: select from dropdown
  const handleOptionSelect = useCallback(
    (optionValue: string) => {
      onChange(parseValue(optionValue, dataType));
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    },
    [onChange, dataType]
  );

  // Multi-value: add a value to the array
  const addMultiValue = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      if (selectedValues.includes(trimmed)) return;
      const newValues = [...selectedValues, trimmed].map((v) => parseValue(v, dataType));
      onChange(newValues);
      setMultiInputText('');
    },
    [selectedValues, onChange, dataType]
  );

  // Multi-value: remove a value from the array
  const removeMultiValue = useCallback(
    (val: string) => {
      const newValues = selectedValues.filter((v) => v !== val).map((v) => parseValue(v, dataType));
      onChange(newValues.length > 0 ? newValues : []);
    },
    [selectedValues, onChange, dataType]
  );

  // Multi-value: select from dropdown (toggle)
  const handleMultiOptionSelect = useCallback(
    (optionValue: string) => {
      if (selectedValues.includes(optionValue)) {
        removeMultiValue(optionValue);
      } else {
        addMultiValue(optionValue);
      }
      setMultiInputText('');
      // Keep dropdown open for multi-select
      updateDropdownPosition();
      inputRef.current?.focus();
    },
    [selectedValues, addMultiValue, removeMultiValue, updateDropdownPosition]
  );

  // Multi-value: handle typing with comma/Enter to commit
  const handleMultiInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && multiInputText === '' && selectedValues.length > 0) {
        // Remove last tag
        const lastVal = selectedValues[selectedValues.length - 1];
        if (lastVal !== undefined) removeMultiValue(lastVal);
        return;
      }

      if (isDropdownOpen && filteredOptions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
            return;
          case 'ArrowUp':
            e.preventDefault();
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            return;
          case 'Enter':
            e.preventDefault();
            if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
              handleMultiOptionSelect(filteredOptions[highlightedIndex]);
            } else if (multiInputText.trim()) {
              addMultiValue(multiInputText);
            }
            return;
          case 'Escape':
            setIsDropdownOpen(false);
            return;
        }
      }

      // Comma or Enter commits the current text as a tag
      if (e.key === ',' || e.key === 'Enter') {
        e.preventDefault();
        addMultiValue(multiInputText);
      }
    },
    [
      multiInputText, selectedValues, isDropdownOpen, filteredOptions,
      highlightedIndex, addMultiValue, removeMultiValue, handleMultiOptionSelect,
    ]
  );

  const handleSingleKeyDown = useCallback(
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

  // IN, NOT IN, and IN OR NULL: tag-based multi-select with dropdown
  if (isMulti) {
    return (
      <div className={className} style={containerStyles}>
        <div ref={containerRef} style={comboboxContainerStyles}>
          <div
            style={tagContainerStyles}
            onClick={() => inputRef.current?.focus()}
          >
            {selectedValues.map((val) => (
              <span key={val} style={tagStyles}>
                {val}
                <button
                  type="button"
                  style={tagRemoveStyles}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeMultiValue(val);
                  }}
                  tabIndex={-1}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedValues.length === 0
                ? (isLoadingValues ? 'Loading...' : 'Type or select values')
                : ''}
              value={multiInputText}
              disabled={disabled || isLoadingValues}
              onChange={(e) => {
                setMultiInputText(e.target.value);
                if (sampleValues.length > 0) {
                  updateDropdownPosition();
                  setIsDropdownOpen(true);
                  setHighlightedIndex(-1);
                }
              }}
              onFocus={handleInputFocus}
              onKeyDown={handleMultiInputKeyDown}
              style={tagInputStyles}
            />
          </div>
          {selectedValues.length === 0 && !multiInputText && (
            <div style={{
              fontSize: '11px',
              color: 'var(--prismiq-color-text-muted)',
              marginTop: '2px',
              paddingLeft: '2px',
            }}>
              Press <kbd style={{ padding: '0 3px', border: '1px solid var(--prismiq-color-border)', borderRadius: '3px', fontSize: '10px' }}>,</kbd> or <kbd style={{ padding: '0 3px', border: '1px solid var(--prismiq-color-border)', borderRadius: '3px', fontSize: '10px' }}>Enter</kbd> to add values
            </div>
          )}
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
              {filteredOptions.map((optionValue, index) => {
                const isSelected = selectedValues.includes(optionValue);
                return (
                  <div
                    key={`${optionValue}-${index}`}
                    onClick={() => handleMultiOptionSelect(optionValue)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      ...optionStyles,
                      ...(index === highlightedIndex ? optionHoverStyles : {}),
                      ...(isSelected
                        ? { backgroundColor: 'var(--prismiq-color-surface)', fontWeight: 500 }
                        : {}),
                    }}
                  >
                    <span style={multiOptionCheckStyles}>
                      {isSelected ? '✓' : '\u2003'}
                    </span>
                    {optionValue}
                  </div>
                );
              })}
            </div>,
            document.body
          )}
        </div>
      </div>
    );
  }

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
          onKeyDown={handleSingleKeyDown}
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
