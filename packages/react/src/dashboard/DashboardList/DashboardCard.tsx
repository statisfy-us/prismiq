/**
 * DashboardCard component.
 *
 * Displays a single dashboard in a card format with actions.
 */

import { type HTMLAttributes, type ReactNode, forwardRef, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Dropdown, DropdownItem, DropdownSeparator } from '../../components/ui/Dropdown';
import { Icon } from '../../components/ui/Icon';
import type { Dashboard } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface DashboardCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** The dashboard to display. */
  dashboard: Dashboard;
  /** Called when the card is clicked. */
  onClick?: (dashboard: Dashboard) => void;
  /** Called when edit is requested. */
  onEdit?: (dashboard: Dashboard) => void;
  /** Called when delete is requested. */
  onDelete?: (dashboard: Dashboard) => void;
  /** Called when duplicate is requested. */
  onDuplicate?: (dashboard: Dashboard) => void;
  /** Whether the card is selected. */
  selected?: boolean;
  /** Whether actions are disabled. */
  actionsDisabled?: boolean;
  /** Custom action buttons. */
  actions?: ReactNode;
}

// ============================================================================
// Styles
// ============================================================================

const cardStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-lg)',
  padding: 'var(--prismiq-spacing-lg)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-md)',
};

const cardHoverStyles: React.CSSProperties = {
  borderColor: 'var(--prismiq-color-primary)',
  boxShadow: 'var(--prismiq-shadow-md)',
};

const cardSelectedStyles: React.CSSProperties = {
  borderColor: 'var(--prismiq-color-primary)',
  boxShadow: '0 0 0 2px var(--prismiq-color-primary-light)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 'var(--prismiq-spacing-md)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-lg)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  margin: 0,
  lineHeight: 1.4,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const descriptionStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  margin: 0,
  lineHeight: 1.5,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const metaStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-md)',
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

const metaItemStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
};

const badgeStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 'var(--prismiq-radius-full)',
  fontSize: 'var(--prismiq-font-size-xs)',
  fontWeight: 500,
};

const publicBadgeStyles: React.CSSProperties = {
  ...badgeStyles,
  backgroundColor: 'var(--prismiq-color-success-light)',
  color: 'var(--prismiq-color-success)',
};

const privateBadgeStyles: React.CSSProperties = {
  ...badgeStyles,
  backgroundColor: 'var(--prismiq-color-warning-light)',
  color: 'var(--prismiq-color-warning)',
};

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Component
// ============================================================================

/**
 * Dashboard card component for displaying dashboard summary.
 *
 * @example
 * ```tsx
 * <DashboardCard
 *   dashboard={dashboard}
 *   onClick={(d) => navigate(`/dashboard/${d.id}`)}
 *   onEdit={(d) => openEditDialog(d)}
 *   onDelete={(d) => confirmDelete(d)}
 * />
 * ```
 */
export const DashboardCard = forwardRef<HTMLDivElement, DashboardCardProps>(
  function DashboardCard(
    {
      dashboard,
      onClick,
      onEdit,
      onDelete,
      onDuplicate,
      selected,
      actionsDisabled,
      actions,
      style,
      ...props
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = () => {
      onClick?.(dashboard);
    };

    const handleMenuAction = (action: 'edit' | 'duplicate' | 'delete') => {
      switch (action) {
        case 'edit':
          onEdit?.(dashboard);
          break;
        case 'duplicate':
          onDuplicate?.(dashboard);
          break;
        case 'delete':
          onDelete?.(dashboard);
          break;
      }
    };

    const combinedStyles: React.CSSProperties = {
      ...cardStyles,
      ...(isHovered && !selected ? cardHoverStyles : {}),
      ...(selected ? cardSelectedStyles : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={combinedStyles}
        {...props}
      >
        <div style={headerStyles}>
          <h3 style={titleStyles}>{dashboard.name}</h3>
          {actions ? (
            actions
          ) : (
            <Dropdown
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  disabled={actionsDisabled}
                  aria-label="Dashboard actions"
                >
                  <Icon name="more-vertical" size={16} />
                </Button>
              }
            >
              <DropdownItem onClick={() => handleMenuAction('edit')}>
                <Icon name="edit" size={14} />
                Edit
              </DropdownItem>
              <DropdownItem onClick={() => handleMenuAction('duplicate')}>
                <Icon name="copy" size={14} />
                Duplicate
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => handleMenuAction('delete')}>
                <Icon name="trash" size={14} />
                Delete
              </DropdownItem>
            </Dropdown>
          )}
        </div>

        {dashboard.description && (
          <p style={descriptionStyles}>{dashboard.description}</p>
        )}

        <div style={metaStyles}>
          <span style={metaItemStyles}>
            <Icon name="grid" size={12} />
            {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
          </span>
          <span style={metaItemStyles}>
            <Icon name="calendar" size={12} />
            {formatDate(dashboard.updated_at)}
          </span>
          {dashboard.is_public ? (
            <span style={publicBadgeStyles}>Public</span>
          ) : (
            <span style={privateBadgeStyles}>Private</span>
          )}
        </div>
      </div>
    );
  }
);
