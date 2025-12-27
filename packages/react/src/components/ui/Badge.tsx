/**
 * Badge component.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge visual style. */
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  /** Badge size. */
  size?: 'sm' | 'md' | 'lg';
  /** Badge content. */
  children: ReactNode;
}

// ============================================================================
// Styles
// ============================================================================

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--prismiq-font-sans)',
  fontWeight: 500,
  borderRadius: 'var(--prismiq-radius-full)',
  whiteSpace: 'nowrap',
};

const variantStyles: Record<NonNullable<BadgeProps['variant']>, React.CSSProperties> = {
  default: {
    backgroundColor: 'var(--prismiq-color-surface)',
    color: 'var(--prismiq-color-text)',
    border: '1px solid var(--prismiq-color-border)',
  },
  primary: {
    backgroundColor: 'var(--prismiq-color-primary)',
    color: 'var(--prismiq-color-text-inverse)',
  },
  success: {
    backgroundColor: 'var(--prismiq-color-success)',
    color: 'var(--prismiq-color-text-inverse)',
  },
  warning: {
    backgroundColor: 'var(--prismiq-color-warning)',
    color: '#000000',
  },
  error: {
    backgroundColor: 'var(--prismiq-color-error)',
    color: 'var(--prismiq-color-text-inverse)',
  },
  info: {
    backgroundColor: 'var(--prismiq-color-info)',
    color: 'var(--prismiq-color-text-inverse)',
  },
};

const sizeStyles: Record<NonNullable<BadgeProps['size']>, React.CSSProperties> = {
  sm: {
    padding: '2px var(--prismiq-spacing-xs)',
    fontSize: 'var(--prismiq-font-size-xs)',
  },
  md: {
    padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
    fontSize: 'var(--prismiq-font-size-sm)',
  },
  lg: {
    padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
    fontSize: 'var(--prismiq-font-size-base)',
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * Badge component for status indicators and labels.
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="error" size="sm">Error</Badge>
 * ```
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', size = 'md', children, style, className, ...props },
  ref
) {
  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <span ref={ref} className={className} style={combinedStyles} {...props}>
      {children}
    </span>
  );
});
