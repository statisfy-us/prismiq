/**
 * Dropdown component.
 */

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DropdownProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The element that triggers the dropdown. */
  trigger: ReactNode;
  /** The dropdown content. */
  children: ReactNode;
  /** Alignment of the dropdown relative to the trigger. */
  align?: 'start' | 'end';
  /** Whether the dropdown is disabled. */
  disabled?: boolean;
}

export interface DropdownItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether the item is disabled. */
  disabled?: boolean;
  /** Icon to display before the label. */
  icon?: ReactNode;
  /** Item content. */
  children: ReactNode;
}

export interface DropdownSeparatorProps extends HTMLAttributes<HTMLDivElement> {}

// ============================================================================
// Context
// ============================================================================

interface DropdownContextValue {
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
};

const contentStyles: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  marginTop: 'var(--prismiq-spacing-xs)',
  minWidth: '160px',
  backgroundColor: 'var(--prismiq-color-background)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  boxShadow: 'var(--prismiq-shadow-md)',
  zIndex: 1000,
  padding: 'var(--prismiq-spacing-xs) 0',
  overflow: 'hidden',
};

const itemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-base)',
  color: 'var(--prismiq-color-text)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
};

const itemHoverStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface-hover)',
};

const itemDisabledStyles: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const separatorStyles: React.CSSProperties = {
  height: '1px',
  backgroundColor: 'var(--prismiq-color-border)',
  margin: 'var(--prismiq-spacing-xs) 0',
};

// ============================================================================
// DropdownItem Component
// ============================================================================

/**
 * An item within a dropdown menu.
 */
export const DropdownItem = forwardRef<HTMLDivElement, DropdownItemProps>(
  function DropdownItem(
    { disabled = false, icon, children, onClick, style, className, ...props },
    ref
  ) {
    const context = useContext(DropdownContext);
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
        context?.close();
      },
      [disabled, onClick, context]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      },
      [disabled, handleClick]
    );

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={className}
        style={{
          ...itemStyles,
          ...(isHovered && !disabled ? itemHoverStyles : {}),
          ...(disabled ? itemDisabledStyles : {}),
          ...style,
        }}
        {...props}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        {children}
      </div>
    );
  }
);

// ============================================================================
// DropdownSeparator Component
// ============================================================================

/**
 * A separator line within a dropdown menu.
 */
export const DropdownSeparator = forwardRef<HTMLDivElement, DropdownSeparatorProps>(
  function DropdownSeparator({ style, className, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="separator"
        className={className}
        style={{ ...separatorStyles, ...style }}
        {...props}
      />
    );
  }
);

// ============================================================================
// Dropdown Component
// ============================================================================

/**
 * Dropdown menu component.
 *
 * @example
 * ```tsx
 * <Dropdown
 *   trigger={<Button>Open menu</Button>}
 * >
 *   <DropdownItem onClick={() => console.log('Edit')}>Edit</DropdownItem>
 *   <DropdownItem onClick={() => console.log('Delete')}>Delete</DropdownItem>
 *   <DropdownSeparator />
 *   <DropdownItem disabled>Disabled</DropdownItem>
 * </Dropdown>
 * ```
 */
export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(function Dropdown(
  { trigger, children, align = 'start', disabled = false, style, className, ...props },
  ref
) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  }, [disabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
        case ' ':
          if (!isOpen) {
            e.preventDefault();
            toggle();
          }
          break;
        case 'ArrowDown':
          if (!isOpen) {
            e.preventDefault();
            setIsOpen(true);
          }
          break;
      }
    },
    [isOpen, toggle]
  );

  return (
    <DropdownContext.Provider value={{ close }}>
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
        {...props}
      >
        <div
          onClick={toggle}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {trigger}
        </div>

        {isOpen && (
          <div
            role="menu"
            style={{
              ...contentStyles,
              ...(align === 'end' ? { right: 0 } : { left: 0 }),
            }}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
});
