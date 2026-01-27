/**
 * PinnedDashboardView component.
 *
 * Full view with pinned dashboard list and selected dashboard display.
 */

import { type CSSProperties, type ReactNode } from 'react';

import { Dashboard } from '../dashboard';
import { usePinMutations } from '../hooks';
import type { Dashboard as DashboardType } from '../types';

import { PinnedDashboardList } from './PinnedDashboardList';

// ============================================================================
// Types
// ============================================================================

export interface PinnedDashboardViewProps {
  /** Context this view is for (for unpin action). */
  context: string;
  /** Dashboard to display (null = show list). */
  selectedDashboard: DashboardType | null;
  /** Called when user clicks back or closes. */
  onBack: () => void;
  /** Called when user selects from list. */
  onSelect: (dashboard: DashboardType) => void;
  /** Show unpin button in header. */
  showUnpin?: boolean;
  /** Custom back button label. */
  backLabel?: string;
  /** Custom empty state for list. */
  emptyState?: ReactNode;
  /** Custom class name. */
  className?: string;
  /** Custom styles. */
  style?: CSSProperties;
}

// ============================================================================
// Icons
// ============================================================================

const BackIcon = (): ReactNode => (
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
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
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
  height: '100%',
};

const headerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-md)',
  padding: 'var(--prismiq-spacing-md)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
};

const backButtonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 500,
  backgroundColor: 'transparent',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  color: 'var(--prismiq-color-text)',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

const titleStyles: CSSProperties = {
  flex: 1,
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-lg)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const unpinButtonStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  fontFamily: 'var(--prismiq-font-sans)',
  fontSize: 'var(--prismiq-font-size-sm)',
  backgroundColor: 'transparent',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  color: 'var(--prismiq-color-text-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
};

const contentStyles: CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const listContainerStyles: CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Full view with pinned dashboard list and dashboard display.
 *
 * When no dashboard is selected, shows the list. When a dashboard
 * is selected, shows the dashboard with a back button.
 *
 * @example
 * ```tsx
 * function AccountsDashboardSection() {
 *   const [selected, setSelected] = useState<Dashboard | null>(null);
 *
 *   return (
 *     <PinnedDashboardView
 *       context="accounts"
 *       selectedDashboard={selected}
 *       onSelect={setSelected}
 *       onBack={() => setSelected(null)}
 *       backLabel="Back to Accounts"
 *       emptyState={<p>Pin dashboards from Analytics.</p>}
 *     />
 *   );
 * }
 * ```
 */
export function PinnedDashboardView({
  context,
  selectedDashboard,
  onBack,
  onSelect,
  showUnpin = true,
  backLabel = 'Back',
  emptyState,
  className,
  style,
}: PinnedDashboardViewProps): ReactNode {
  const { unpin, state: mutationState } = usePinMutations();

  const handleUnpin = async () => {
    if (!selectedDashboard) return;
    try {
      await unpin(selectedDashboard.id, context);
      onBack();
    } catch {
      // Error handled by hook
    }
  };

  // Show list when no dashboard selected
  if (!selectedDashboard) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={listContainerStyles}>
          <PinnedDashboardList
            context={context}
            onSelect={onSelect}
            emptyState={emptyState}
          />
        </div>
      </div>
    );
  }

  // Show selected dashboard with header
  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={headerStyles}>
        <button
          type="button"
          onClick={onBack}
          style={backButtonStyles}
        >
          <BackIcon />
          <span>{backLabel}</span>
        </button>
        <h2 style={titleStyles}>{selectedDashboard.name}</h2>
        {showUnpin && (
          <button
            type="button"
            onClick={handleUnpin}
            disabled={mutationState.isLoading}
            style={{
              ...unpinButtonStyles,
              opacity: mutationState.isLoading ? 0.5 : 1,
            }}
          >
            <UnpinIcon />
            <span>Unpin</span>
          </button>
        )}
      </div>
      <div style={contentStyles}>
        <Dashboard id={selectedDashboard.id} />
      </div>
    </div>
  );
}
