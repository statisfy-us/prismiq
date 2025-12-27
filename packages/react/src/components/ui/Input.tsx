/**
 * Input component.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Input size. */
  inputSize?: 'sm' | 'md' | 'lg';
  /** Whether the input has an error. */
  error?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const baseStyles: React.CSSProperties = {
  display: 'block',
  width: '100%',
  fontFamily: 'var(--prismiq-font-sans)',
  backgroundColor: 'var(--prismiq-color-background)',
  color: 'var(--prismiq-color-text)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const sizeStyles: Record<NonNullable<InputProps['inputSize']>, React.CSSProperties> = {
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
  backgroundColor: 'var(--prismiq-color-surface)',
};

const errorStyles: React.CSSProperties = {
  borderColor: 'var(--prismiq-color-error)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Input component with multiple sizes and error state.
 *
 * @example
 * ```tsx
 * <Input
 *   placeholder="Enter your name"
 *   value={name}
 *   onChange={(e) => setName(e.target.value)}
 * />
 *
 * <Input inputSize="sm" error placeholder="Invalid value" />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = 'md', disabled, error, style, className, ...props },
  ref
) {
  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...sizeStyles[inputSize],
    ...(disabled ? disabledStyles : {}),
    ...(error ? errorStyles : {}),
    ...style,
  };

  return (
    <input
      ref={ref}
      disabled={disabled}
      className={className}
      style={combinedStyles}
      {...props}
    />
  );
});
