/**
 * Select component.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { Input } from './Input';

// ============================================================================
// Types
// ============================================================================

export interface SelectOption<T> {
  /** Option value. */
  value: T;
  /** Display label. */
  label: string;
  /** Whether the option is disabled. */
  disabled?: boolean;
}

export interface SelectProps<T> {
  /** Currently selected value. */
  value: T | null;
  /** Callback when value changes. */
  onChange: (value: T) => void;
  /** Available options. */
  options: SelectOption<T>[];
  /** Placeholder text when no value selected. */
  placeholder?: string;
  /** Whether the select is disabled. */
  disabled?: boolean;
  /** Whether to show a search input. */
  searchable?: boolean;
  /** Select size. */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: '100%',
};

const triggerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  fontFamily: 'var(--prismiq-font-sans)',
  backgroundColor: 'var(--prismiq-color-background)',
  color: 'var(--prismiq-color-text)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const sizeStyles: Record<NonNullable<SelectProps<unknown>['size']>, React.CSSProperties> = {
  sm: {
    padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
    fontSize: 'var(--prismiq-font-size-sm)',
  },
  md: {
    padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
    fontSize: 'var(--prismiq-font-size-base)',
  },
  lg: {
    padding: 'var(--prismiq-spacing-md) var(--prismiq-spacing-lg)',
    fontSize: 'var(--prismiq-font-size-lg)',
  },
};

const dropdownStyles: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: 'var(--prismiq-spacing-xs)',
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
  transition: 'background-color 0.1s',
};

const optionHoverStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface-hover)',
};

const optionSelectedStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
  fontWeight: 500,
};

const optionDisabledStyles: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const placeholderStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Select component with optional search functionality.
 *
 * @example
 * ```tsx
 * const [value, setValue] = useState<string | null>(null);
 *
 * <Select
 *   value={value}
 *   onChange={setValue}
 *   options={[
 *     { value: 'a', label: 'Option A' },
 *     { value: 'b', label: 'Option B' },
 *   ]}
 *   placeholder="Select an option"
 * />
 * ```
 */
function SelectInner<T>(
  {
    value,
    onChange,
    options,
    placeholder = 'Select...',
    disabled = false,
    searchable = false,
    size = 'md',
    className,
    style,
  }: SelectProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is inside container or dropdown portal
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);

      if (!isInsideContainer && !isInsideDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredOptions.length]);

  // Update dropdown position when opening
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => {
        if (!prev) {
          updateDropdownPosition();
        }
        return !prev;
      });
      setSearch('');
      setHighlightedIndex(-1);
    }
  }, [disabled, updateDropdownPosition]);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (!option.disabled) {
        onChange(option.value);
        setIsOpen(false);
        setSearch('');
      }
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            const option = filteredOptions[highlightedIndex];
            if (option && !option.disabled) {
              handleSelect(option);
            }
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearch('');
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              Math.min(prev + 1, filteredOptions.length - 1)
            );
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Tab':
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [disabled, isOpen, highlightedIndex, filteredOptions, handleSelect]
  );

  return (
    <div
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className={className}
      style={{ ...containerStyles, ...style }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        style={{
          ...triggerStyles,
          ...sizeStyles[size],
          ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        }}
      >
        <span style={selectedOption ? {} : placeholderStyles}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span
          style={{
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid currentColor',
            marginLeft: 'var(--prismiq-spacing-sm)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }}
        />
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...dropdownStyles,
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            marginTop: 0,
            fontSize: sizeStyles[size].fontSize,
          }}
          role="listbox"
        >
          {searchable && (
            <div style={{ padding: 'var(--prismiq-spacing-sm)' }}>
              <Input
                ref={searchInputRef}
                inputSize="sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div
              style={{
                ...optionStyles,
                color: 'var(--prismiq-color-text-muted)',
                cursor: 'default',
              }}
            >
              No options
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={String(option.value)}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                style={{
                  ...optionStyles,
                  ...(option.value === value ? optionSelectedStyles : {}),
                  ...(index === highlightedIndex ? optionHoverStyles : {}),
                  ...(option.disabled ? optionDisabledStyles : {}),
                }}
              >
                {option.label}
              </div>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

export const Select = forwardRef(SelectInner) as <T>(
  props: SelectProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => JSX.Element;
