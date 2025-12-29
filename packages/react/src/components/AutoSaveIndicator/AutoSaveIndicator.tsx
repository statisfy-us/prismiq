/**
 * AutoSaveIndicator component.
 *
 * Shows save status for auto-save operations.
 */

import { forwardRef, type HTMLAttributes } from 'react';

import type { SaveStatus } from '../../hooks/useDebouncedLayoutSave';

// ============================================================================
// Types
// ============================================================================

export interface AutoSaveIndicatorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current save status. */
  status: SaveStatus;
  /** Error if status is error. */
  error?: Error | null;
}

// ============================================================================
// Styles
// ============================================================================

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '4px',
  fontSize: '13px',
  fontWeight: 500,
  transition: 'opacity 0.2s, background-color 0.2s',
};

const statusStyles: Record<Exclude<SaveStatus, 'idle'>, React.CSSProperties> = {
  pending: {
    backgroundColor: 'var(--prismiq-color-warning-background, #fef3cd)',
    color: 'var(--prismiq-color-warning-text, #856404)',
  },
  saving: {
    backgroundColor: 'var(--prismiq-color-info-background, #cce5ff)',
    color: 'var(--prismiq-color-info-text, #004085)',
  },
  saved: {
    backgroundColor: 'var(--prismiq-color-success-background, #d4edda)',
    color: 'var(--prismiq-color-success-text, #155724)',
  },
  error: {
    backgroundColor: 'var(--prismiq-color-error-background, #f8d7da)',
    color: 'var(--prismiq-color-error-text, #721c24)',
  },
};

const dotStyles: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: 'currentColor',
};

const spinnerStyles: React.CSSProperties = {
  width: '14px',
  height: '14px',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'prismiq-spin 0.8s linear infinite',
};

const iconStyles: React.CSSProperties = {
  fontWeight: 'bold',
  fontSize: '14px',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Auto-save status indicator.
 *
 * Shows pending, saving, saved, or error states.
 * Renders nothing when idle.
 *
 * @example
 * ```tsx
 * const { status, error } = useDebouncedLayoutSave({ dashboardId: id });
 *
 * <AutoSaveIndicator status={status} error={error} />
 * ```
 */
export const AutoSaveIndicator = forwardRef<
  HTMLDivElement,
  AutoSaveIndicatorProps
>(function AutoSaveIndicator({ status, error, style, ...props }, ref) {
  // Don't render when idle
  if (status === 'idle') {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes prismiq-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <div
        ref={ref}
        data-testid="save-indicator"
        role="status"
        aria-live="polite"
        style={{
          ...baseStyles,
          ...statusStyles[status],
          ...style,
        }}
        {...props}
      >
        {status === 'pending' && (
          <>
            <span style={dotStyles} aria-hidden="true" />
            <span>Unsaved changes</span>
          </>
        )}

        {status === 'saving' && (
          <>
            <span style={spinnerStyles} aria-hidden="true" />
            <span>Saving...</span>
          </>
        )}

        {status === 'saved' && (
          <>
            <span style={iconStyles} aria-hidden="true">
              ✓
            </span>
            <span>Saved</span>
          </>
        )}

        {status === 'error' && (
          <>
            <span style={iconStyles} aria-hidden="true">
              !
            </span>
            <span title={error?.message}>Error saving</span>
          </>
        )}
      </div>
    </>
  );
});
