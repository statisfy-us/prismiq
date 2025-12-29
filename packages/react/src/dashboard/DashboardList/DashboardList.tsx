/**
 * DashboardList component.
 *
 * Displays a grid of dashboard cards with actions.
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import type { Dashboard } from '../../types';
import { DashboardCard, type DashboardCardProps } from './DashboardCard';

// ============================================================================
// Types
// ============================================================================

export interface DashboardListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of dashboards to display. */
  dashboards: Dashboard[] | null;
  /** Whether the list is loading. */
  isLoading?: boolean;
  /** Error that occurred during fetch. */
  error?: Error | null;
  /** Called when a dashboard card is clicked. */
  onDashboardClick?: (dashboard: Dashboard) => void;
  /** Called when edit is requested for a dashboard. */
  onEdit?: (dashboard: Dashboard) => void;
  /** Called when delete is requested for a dashboard. */
  onDelete?: (dashboard: Dashboard) => void;
  /** Called when duplicate is requested for a dashboard. */
  onDuplicate?: (dashboard: Dashboard) => void;
  /** Called when create new dashboard is requested. */
  onCreate?: () => void;
  /** Number of columns in the grid. */
  columns?: 1 | 2 | 3 | 4;
  /** ID of the currently selected dashboard. */
  selectedId?: string;
  /** Whether actions are disabled. */
  actionsDisabled?: boolean;
  /** Custom empty state content. */
  emptyState?: ReactNode;
  /** Custom card render function. */
  renderCard?: (dashboard: Dashboard, props: DashboardCardProps) => ReactNode;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-lg)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--prismiq-spacing-md)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xl)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  margin: 0,
};

const getGridStyles = (columns: number): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${columns}, 1fr)`,
  gap: 'var(--prismiq-spacing-lg)',
});

const errorStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-xl)',
  textAlign: 'center',
  color: 'var(--prismiq-color-error)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Dashboard list component for displaying all dashboards.
 *
 * @example
 * ```tsx
 * function DashboardsPage() {
 *   const { data, isLoading, error } = useDashboards();
 *   const { createDashboard } = useDashboardMutations();
 *
 *   return (
 *     <DashboardList
 *       dashboards={data}
 *       isLoading={isLoading}
 *       error={error}
 *       onDashboardClick={(d) => navigate(`/dashboard/${d.id}`)}
 *       onCreate={() => setShowCreateDialog(true)}
 *     />
 *   );
 * }
 * ```
 */
export const DashboardList = forwardRef<HTMLDivElement, DashboardListProps>(
  function DashboardList(
    {
      dashboards,
      isLoading,
      error,
      onDashboardClick,
      onEdit,
      onDelete,
      onDuplicate,
      onCreate,
      columns = 3,
      selectedId,
      actionsDisabled,
      emptyState,
      renderCard,
      style,
      ...props
    },
    ref
  ) {
    // Loading state
    if (isLoading) {
      return (
        <div ref={ref} style={{ ...containerStyles, ...style }} {...props}>
          <div style={headerStyles}>
            <Skeleton width={200} height={32} />
            <Skeleton width={150} height={40} />
          </div>
          <div style={getGridStyles(columns)}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={150} style={{ borderRadius: 'var(--prismiq-radius-lg)' }} />
            ))}
          </div>
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div ref={ref} style={{ ...containerStyles, ...style }} {...props}>
          <div style={errorStyles}>
            <Icon name="alert-circle" size={48} />
            <p>Failed to load dashboards: {error.message}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // Empty state
    if (!dashboards || dashboards.length === 0) {
      return (
        <div ref={ref} style={{ ...containerStyles, ...style }} {...props}>
          <div style={headerStyles}>
            <h2 style={titleStyles}>Dashboards</h2>
            {onCreate && (
              <Button onClick={onCreate} leftIcon={<Icon name="plus" size={16} />}>
                Create Dashboard
              </Button>
            )}
          </div>
          {emptyState || (
            <EmptyState
              icon={<Icon name="layout" size={64} />}
              title="No dashboards yet"
              description="Create your first dashboard to start visualizing your data."
              action={
                onCreate
                  ? { label: 'Create Dashboard', onClick: onCreate }
                  : undefined
              }
            />
          )}
        </div>
      );
    }

    // Dashboard grid
    return (
      <div ref={ref} style={{ ...containerStyles, ...style }} {...props}>
        <div style={headerStyles}>
          <h2 style={titleStyles}>
            Dashboards ({dashboards.length})
          </h2>
          {onCreate && (
            <Button onClick={onCreate} leftIcon={<Icon name="plus" size={16} />}>
              Create Dashboard
            </Button>
          )}
        </div>
        <div style={getGridStyles(columns)}>
          {dashboards.map((dashboard) => {
            const cardProps: DashboardCardProps = {
              dashboard,
              onClick: onDashboardClick,
              onEdit,
              onDelete,
              onDuplicate,
              selected: dashboard.id === selectedId,
              actionsDisabled,
            };

            if (renderCard) {
              return renderCard(dashboard, cardProps);
            }

            return <DashboardCard key={dashboard.id} {...cardProps} />;
          })}
        </div>
      </div>
    );
  }
);
