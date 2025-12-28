/**
 * Widget header component with title and actions.
 */

import { useCallback } from 'react';
import { useTheme } from '../../theme';
import { Dropdown, DropdownItem, DropdownSeparator, Icon } from '../../components/ui';
import type { WidgetHeaderProps } from '../types';

/**
 * Widget header with title, loading indicator, and action menu.
 */
export function WidgetHeader({
  title,
  editable = false,
  isLoading = false,
  onMenuAction,
}: WidgetHeaderProps): JSX.Element {
  const { theme } = useTheme();

  const handleMenuAction = useCallback(
    (action: string) => {
      onMenuAction?.(action);
    },
    [onMenuAction]
  );

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    minHeight: '40px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.base,
    fontWeight: 500,
    color: theme.colors.text,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'prismiq-spin 1s linear infinite',
  };

  const menuButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: 'none',
    borderRadius: theme.radius.sm,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: 'background-color 150ms, color 150ms',
  };

  return (
    <div style={headerStyle} className="prismiq-widget-header">
      <h3 style={titleStyle}>{title}</h3>

      <div style={actionsStyle}>
        {isLoading && (
          <div style={spinnerStyle} aria-label="Loading" />
        )}

        <Dropdown
          trigger={
            <button
              style={menuButtonStyle}
              className="prismiq-widget-menu-button"
              aria-label="Widget actions"
              type="button"
            >
              <Icon name="more" size={16} />
            </button>
          }
        >
          <DropdownItem onClick={() => handleMenuAction('refresh')}>
            <Icon name="refresh" size={14} />
            Refresh
          </DropdownItem>
          <DropdownItem onClick={() => handleMenuAction('fullscreen')}>
            <Icon name="expand" size={14} />
            Fullscreen
          </DropdownItem>
          {editable && (
            <>
              <DropdownSeparator />
              <DropdownItem onClick={() => handleMenuAction('edit')}>
                <Icon name="edit" size={14} />
                Edit
              </DropdownItem>
              <DropdownItem onClick={() => handleMenuAction('duplicate')}>
                <Icon name="copy" size={14} />
                Duplicate
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem onClick={() => handleMenuAction('remove')}>
                <Icon name="trash" size={14} />
                Remove
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <style>{`
        @keyframes prismiq-spin {
          to { transform: rotate(360deg); }
        }
        .prismiq-widget-menu-button:hover {
          background-color: ${theme.colors.surfaceHover};
          color: ${theme.colors.text};
        }
      `}</style>
    </div>
  );
}
