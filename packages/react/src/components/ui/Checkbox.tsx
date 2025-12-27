/**
 * Checkbox component.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Checkbox size. */
  size?: 'sm' | 'md' | 'lg';
  /** Label text. */
  label?: string;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  cursor: 'pointer',
};

const checkboxStyles: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--prismiq-color-background)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-sm)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s',
  flexShrink: 0,
};

const sizeStyles: Record<NonNullable<CheckboxProps['size']>, React.CSSProperties> = {
  sm: {
    width: '14px',
    height: '14px',
  },
  md: {
    width: '18px',
    height: '18px',
  },
  lg: {
    width: '22px',
    height: '22px',
  },
};

const labelSizeStyles: Record<NonNullable<CheckboxProps['size']>, React.CSSProperties> = {
  sm: {
    fontSize: 'var(--prismiq-font-size-sm)',
  },
  md: {
    fontSize: 'var(--prismiq-font-size-base)',
  },
  lg: {
    fontSize: 'var(--prismiq-font-size-lg)',
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Checkbox component with optional label.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   checked={isChecked}
 *   onChange={(e) => setIsChecked(e.target.checked)}
 *   label="Remember me"
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = 'md', label, disabled, style, className, checked, ...props },
  ref
) {
  const checkmarkSize = size === 'sm' ? 8 : size === 'md' ? 10 : 12;

  return (
    <label
      className={className}
      style={{
        ...containerStyles,
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input
          ref={ref}
          type="checkbox"
          disabled={disabled}
          checked={checked}
          style={{
            ...checkboxStyles,
            ...sizeStyles[size],
            ...(checked
              ? {
                  backgroundColor: 'var(--prismiq-color-primary)',
                  borderColor: 'var(--prismiq-color-primary)',
                }
              : {}),
          }}
          {...props}
        />
        {checked && (
          <svg
            viewBox="0 0 10 8"
            fill="none"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: checkmarkSize,
              height: checkmarkSize,
              pointerEvents: 'none',
            }}
          >
            <path
              d="M1 4L3.5 6.5L9 1"
              stroke="var(--prismiq-color-text-inverse)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {label && (
        <span
          style={{
            fontFamily: 'var(--prismiq-font-sans)',
            color: 'var(--prismiq-color-text)',
            ...labelSizeStyles[size],
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
});
