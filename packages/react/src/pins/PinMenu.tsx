/**
 * PinMenu component.
 *
 * A dropdown menu showing multiple pin contexts with checkboxes.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { useDashboardPinStatus, usePinMutations } from '../hooks';

// ============================================================================
// Types
// ============================================================================

/** Configuration for a pin context option. */
export interface PinContextOption {
  /** Unique context identifier (e.g., "accounts", "dashboard"). */
  id: string;
  /** Display label for the context. */
  label: string;
  /** Optional icon to display. */
  icon?: ReactNode;
}

export interface PinMenuProps {
  /** Dashboard ID to pin/unpin. */
  dashboardId: string;
  /** Available contexts to pin to. */
  contexts: PinContextOption[];
  /** Called after pin state changes. */
  onPinChange?: (context: string, isPinned: boolean) => void;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: CSSProperties;
}

// ============================================================================
// Icons
// ============================================================================

const PinIcon = ({ size }: { size: number }): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 1 2-2h0a2 2 0 0 0 2-2H5a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2z" />
  </svg>
);

const ChevronDownIcon = ({ size }: { size: number }): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const CheckIcon = ({ size }: { size: number }): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// ============================================================================
// Styles
// ============================================================================

const triggerStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-base)',
  fontWeight: 500,
  borderRadius: 'var(--prismiq-radius-md)',
  border: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
  color: 'var(--prismiq-color-text)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s',
  outline: 'none',
};

const menuStyles: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 'var(--prismiq-spacing-xs)',
  minWidth: 200,
  padding: 'var(--prismiq-spacing-xs)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  boxShadow: 'var(--prismiq-shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))',
  zIndex: 50,
};

const menuItemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  borderRadius: 'var(--prismiq-radius-sm)',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  border: 'none',
  backgroundColor: 'transparent',
  width: '100%',
  textAlign: 'left',
};

const checkboxStyles: CSSProperties = {
  width: 16,
  height: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--prismiq-radius-sm)',
  border: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
  flexShrink: 0,
};

const checkedCheckboxStyles: CSSProperties = {
  ...checkboxStyles,
  backgroundColor: 'var(--prismiq-color-primary)',
  borderColor: 'var(--prismiq-color-primary)',
  color: 'var(--prismiq-color-text-inverse)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Dropdown menu showing multiple pin contexts with checkboxes.
 *
 * @example
 * ```tsx
 * const PIN_CONTEXTS = [
 *   { id: 'dashboard', label: 'Dashboard' },
 *   { id: 'accounts', label: 'Accounts' },
 * ];
 *
 * <PinMenu
 *   dashboardId={dashboard.id}
 *   contexts={PIN_CONTEXTS}
 *   onPinChange={(ctx, pinned) => console.log(ctx, pinned)}
 * />
 * ```
 */
export function PinMenu({
  dashboardId,
  contexts,
  onPinChange,
  className,
  style,
}: PinMenuProps): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isPinned, refetch, isLoading: statusLoading } = useDashboardPinStatus({
    dashboardId,
  });
  const { pin, unpin, state: mutationState } = usePinMutations();

  const isLoading = statusLoading || mutationState.isLoading;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleToggle = useCallback((ctx: string) => {
    return async () => {
      if (isLoading) return;

      try {
        const pinned = isPinned(ctx);
        if (pinned) {
          await unpin(dashboardId, ctx);
          onPinChange?.(ctx, false);
        } else {
          await pin(dashboardId, ctx);
          onPinChange?.(ctx, true);
        }
        await refetch();
      } catch (err) {
        // Log error for debugging - usePinMutations also stores it in state
        console.error('Failed to toggle pin for context:', ctx, err);
      }
    };
  }, [dashboardId, isPinned, isLoading, pin, unpin, onPinChange, refetch]);

  // Count pinned contexts
  const pinnedCount = contexts.filter((ctx) => isPinned(ctx.id)).length;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', display: 'inline-block', ...style }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={triggerStyles}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <PinIcon size={16} />
        <span>Pin{pinnedCount > 0 ? ` (${pinnedCount})` : ''}</span>
        <ChevronDownIcon size={14} />
      </button>

      {isOpen && (
        <div style={menuStyles} role="menu">
          {contexts.map((ctx) => {
            const pinned = isPinned(ctx.id);
            return (
              <button
                key={ctx.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={pinned}
                onClick={handleToggle(ctx.id)}
                disabled={isLoading}
                style={{
                  ...menuItemStyles,
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <span style={pinned ? checkedCheckboxStyles : checkboxStyles}>
                  {pinned && <CheckIcon size={12} />}
                </span>
                {ctx.icon && <span style={{ display: 'flex' }}>{ctx.icon}</span>}
                <span>{ctx.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
