/**
 * PinnedDashboardList component.
 *
 * Displays a list of dashboards pinned to a context.
 */

import { useCallback, type CSSProperties, type ReactNode } from 'react';

import { usePinnedDashboards, usePinMutations } from '../hooks';
import type { Dashboard } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Props for custom rendering of a list item. */
export interface PinnedDashboardItemActions {
  /** Unpin this dashboard from the context. */
  unpin: () => void;
}

export interface PinnedDashboardListProps {
  /** Context to show pins for (e.g., "accounts", "dashboard"). */
  context: string;
  /** Called when user selects a dashboard. */
  onSelect: (dashboard: Dashboard) => void;
  /** Enable drag-drop reordering. */
  reorderable?: boolean;
  /** Custom empty state element. */
  emptyState?: ReactNode;
  /** Custom render function for each item. */
  renderItem?: (dashboard: Dashboard, actions: PinnedDashboardItemActions) => ReactNode;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: CSSProperties;
}

// ============================================================================
// Icons
// ============================================================================

const DashboardIcon = (): ReactNode => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const UnpinIcon = (): ReactNode => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 2 22 22" />
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9" />
    <path d="M15 6V4a2 2 0 0 1 2-2" />
    <path d="M9 4a2 2 0 0 0-2 2" />
  </svg>
);

// ============================================================================
// Styles
// ============================================================================

const containerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-sm)',
};

const itemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-md)',
  padding: 'var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
};

const itemHoverStyles: CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface-hover, #f5f5f5)',
  borderColor: 'var(--prismiq-color-primary)',
  boxShadow: 'var(--prismiq-shadow-sm, 0 1px 2px rgba(0,0,0,0.05))',
};

const iconWrapperStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  backgroundColor: 'var(--prismiq-color-primary-light, #e3f2fd)',
  color: 'var(--prismiq-color-primary)',
  borderRadius: 'var(--prismiq-radius-md)',
  flexShrink: 0,
};

const contentStyles: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const titleStyles: CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-base)',
  fontWeight: 500,
  color: 'var(--prismiq-color-text)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const descriptionStyles: CSSProperties = {
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  margin: 0,
  marginTop: 'var(--prismiq-spacing-xs)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const unpinButtonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  padding: 0,
  backgroundColor: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--prismiq-radius-sm)',
  color: 'var(--prismiq-color-text-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  flexShrink: 0,
};

const emptyStateStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--prismiq-spacing-xl)',
  textAlign: 'center',
  color: 'var(--prismiq-color-text-muted)',
};

const loadingStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--prismiq-spacing-xl)',
};

const errorStyles: CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-error-light, #ffebee)',
  color: 'var(--prismiq-color-error)',
  borderRadius: 'var(--prismiq-radius-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * List of dashboards pinned to a context.
 *
 * @example
 * ```tsx
 * function AccountsDashboards() {
 *   const [selected, setSelected] = useState<Dashboard | null>(null);
 *
 *   return (
 *     <PinnedDashboardList
 *       context="accounts"
 *       onSelect={setSelected}
 *       emptyState={<p>No pinned dashboards</p>}
 *     />
 *   );
 * }
 * ```
 */
export function PinnedDashboardList({
  context,
  onSelect,
  emptyState,
  renderItem,
  className,
  style,
}: PinnedDashboardListProps): ReactNode {
  const { dashboards, isLoading, error, refetch } = usePinnedDashboards({ context });
  const { unpin, state: mutationState } = usePinMutations();

  const handleUnpin = useCallback(
    (dashboardId: string) => {
      return async (event: React.MouseEvent) => {
        event.stopPropagation();
        try {
          await unpin(dashboardId, context);
          await refetch();
        } catch {
          // Error handled by hook
        }
      };
    },
    [context, unpin, refetch]
  );

  if (isLoading) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={loadingStyles}>
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 24,
              border: '2px solid var(--prismiq-color-border)',
              borderTopColor: 'var(--prismiq-color-primary)',
              borderRadius: '50%',
              animation: 'prismiq-spin 0.6s linear infinite',
            }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={errorStyles}>
          Failed to load pinned dashboards: {error.message}
        </div>
      </div>
    );
  }

  if (!dashboards || dashboards.length === 0) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        {emptyState || (
          <div style={emptyStateStyles}>
            <DashboardIcon />
            <p style={{ margin: 'var(--prismiq-spacing-sm) 0 0 0' }}>
              No pinned dashboards
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      {dashboards.map((dashboard) => {
        const actions: PinnedDashboardItemActions = {
          unpin: () => {
            void unpin(dashboard.id, context).then(() => refetch());
          },
        };

        if (renderItem) {
          return (
            <div key={dashboard.id} onClick={() => onSelect(dashboard)}>
              {renderItem(dashboard, actions)}
            </div>
          );
        }

        return (
          <div
            key={dashboard.id}
            style={itemStyles}
            onClick={() => onSelect(dashboard)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, itemHoverStyles);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, itemStyles);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(dashboard);
              }
            }}
          >
            <div style={iconWrapperStyles}>
              <DashboardIcon />
            </div>
            <div style={contentStyles}>
              <h3 style={titleStyles}>{dashboard.name}</h3>
              {dashboard.description && (
                <p style={descriptionStyles}>{dashboard.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleUnpin(dashboard.id)}
              disabled={mutationState.isLoading}
              style={{
                ...unpinButtonStyles,
                opacity: mutationState.isLoading ? 0.5 : 1,
              }}
              title="Unpin"
              aria-label="Unpin dashboard"
            >
              <UnpinIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
