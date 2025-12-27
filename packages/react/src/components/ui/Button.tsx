/**
 * Button component.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Button visual style. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Button size. */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the button is in a loading state. */
  loading?: boolean;
  /** Icon to display before the label. */
  leftIcon?: ReactNode;
  /** Icon to display after the label. */
  rightIcon?: ReactNode;
  /** Button content. */
  children: ReactNode;
}

// ============================================================================
// Styles
// ============================================================================

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontWeight: 500,
  borderRadius: 'var(--prismiq-radius-md)',
  border: '1px solid transparent',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s, opacity 0.15s',
  outline: 'none',
};

const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--prismiq-color-primary)',
    color: 'var(--prismiq-color-text-inverse)',
    borderColor: 'var(--prismiq-color-primary)',
  },
  secondary: {
    backgroundColor: 'var(--prismiq-color-surface)',
    color: 'var(--prismiq-color-text)',
    borderColor: 'var(--prismiq-color-border)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--prismiq-color-text)',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: 'var(--prismiq-color-error)',
    color: 'var(--prismiq-color-text-inverse)',
    borderColor: 'var(--prismiq-color-error)',
  },
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
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

const disabledStyles: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Button component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 *
 * <Button variant="secondary" size="sm" leftIcon={<Icon name="plus" />}>
 *   Add item
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    disabled,
    loading,
    leftIcon,
    rightIcon,
    children,
    style,
    className,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(isDisabled ? disabledStyles : {}),
    ...style,
  };

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      className={className}
      style={combinedStyles}
      {...props}
    >
      {loading ? (
        <span
          style={{
            display: 'inline-block',
            width: '1em',
            height: '1em',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'prismiq-spin 0.6s linear infinite',
          }}
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
