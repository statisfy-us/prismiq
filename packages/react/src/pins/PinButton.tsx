/**
 * PinButton component.
 *
 * A button to pin/unpin a dashboard to a specific context.
 */

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';

import { useDashboardPinStatus, usePinMutations } from '../hooks';

// ============================================================================
// Types
// ============================================================================

export interface PinButtonProps {
  /** Dashboard ID to pin/unpin. */
  dashboardId: string;
  /** Context to pin to (e.g., "accounts", "dashboard"). */
  context: string;
  /** Label text (default: "Pin"). */
  label?: string;
  /** Label when pinned (default: "Unpin"). */
  unpinLabel?: string;
  /** Show as icon only (no label). */
  iconOnly?: boolean;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Called after pin/unpin completes. */
  onPinChange?: (isPinned: boolean) => void;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: CSSProperties;
}

// ============================================================================
// Icons
// ============================================================================

const PinIcon = ({ filled, size }: { filled: boolean; size: number }): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 1 2-2h0a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2z" />
  </svg>
);

// ============================================================================
// Styles
// ============================================================================

const baseStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontWeight: 500,
  borderRadius: 'var(--prismiq-radius-md)',
  border: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
  color: 'var(--prismiq-color-text)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s, opacity 0.15s',
  outline: 'none',
};

const sizeStyles: Record<NonNullable<PinButtonProps['size']>, CSSProperties> = {
  sm: {
    padding: 'var(--prismiq-spacing-xs)',
    fontSize: 'var(--prismiq-font-size-sm)',
    minWidth: 28,
    minHeight: 28,
  },
  md: {
    padding: 'var(--prismiq-spacing-sm)',
    fontSize: 'var(--prismiq-font-size-base)',
    minWidth: 36,
    minHeight: 36,
  },
  lg: {
    padding: 'var(--prismiq-spacing-md)',
    fontSize: 'var(--prismiq-font-size-lg)',
    minWidth: 44,
    minHeight: 44,
  },
};

const pinnedStyles: CSSProperties = {
  backgroundColor: 'var(--prismiq-color-primary-light, #e3f2fd)',
  borderColor: 'var(--prismiq-color-primary)',
  color: 'var(--prismiq-color-primary)',
};

const disabledStyles: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const iconSizes: Record<NonNullable<PinButtonProps['size']>, number> = {
  sm: 14,
  md: 16,
  lg: 20,
};

// ============================================================================
// Component
// ============================================================================

/**
 * Button to pin/unpin a dashboard to a context.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <PinButton dashboardId={dashboard.id} context="accounts" />
 *
 * // Icon only with custom label
 * <PinButton
 *   dashboardId={dashboard.id}
 *   context="dashboard"
 *   iconOnly
 *   onPinChange={(isPinned) => console.log('Pinned:', isPinned)}
 * />
 * ```
 */
export function PinButton({
  dashboardId,
  context,
  label = 'Pin',
  unpinLabel = 'Unpin',
  iconOnly = false,
  size = 'md',
  onPinChange,
  className,
  style,
}: PinButtonProps): ReactNode {
  const { isPinned: checkIsPinned, isLoading: statusLoading, refetch } = useDashboardPinStatus({
    dashboardId,
  });
  const { pin, unpin, state: mutationState } = usePinMutations();
  const [actionError, setActionError] = useState<Error | null>(null);

  // Use fetched state directly to avoid race conditions with optimistic updates
  const isPinned = checkIsPinned(context);
  const isLoading = statusLoading || mutationState.isLoading;

  const handleClick = useCallback(async () => {
    if (isLoading) return;

    setActionError(null);
    try {
      if (isPinned) {
        await unpin(dashboardId, context);
        onPinChange?.(false);
      } else {
        await pin(dashboardId, context);
        onPinChange?.(true);
      }
      // Refresh status after mutation
      await refetch();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setActionError(error);
      console.error('Failed to toggle pin:', err);
    }
  }, [dashboardId, context, isPinned, isLoading, pin, unpin, onPinChange, refetch]);

  const errorStyles: CSSProperties = {
    borderColor: 'var(--prismiq-color-error)',
    color: 'var(--prismiq-color-error)',
  };

  const combinedStyles: CSSProperties = {
    ...baseStyles,
    ...sizeStyles[size],
    ...(isPinned ? pinnedStyles : {}),
    ...(isLoading ? disabledStyles : {}),
    ...(actionError ? errorStyles : {}),
    ...style,
  };

  const iconSize = iconSizes[size];
  const displayLabel = isPinned ? unpinLabel : label;
  const errorMessage = actionError ? `Error: ${actionError.message}` : undefined;
  const accessibleLabel = errorMessage ?? (iconOnly ? displayLabel : undefined);
  const tooltipTitle = errorMessage ?? (iconOnly ? displayLabel : undefined);

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
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={className}
        style={combinedStyles}
        aria-pressed={isPinned}
        aria-label={accessibleLabel}
        aria-invalid={actionError ? true : undefined}
        title={tooltipTitle}
      >
        {isLoading ? (
          <span
            style={{
              display: 'inline-block',
              width: iconSize,
              height: iconSize,
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'prismiq-spin 0.6s linear infinite',
            }}
          />
        ) : (
          <PinIcon filled={isPinned} size={iconSize} />
        )}
        {!iconOnly && <span>{displayLabel}</span>}
      </button>
    </>
  );
}
