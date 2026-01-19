/**
 * Widget header component with title and actions.
 */

import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import type { WidgetHeaderProps } from '../types';

/**
 * Widget header with title and optional hyperlink.
 */
export function WidgetHeader({
  title,
  hyperlink,
}: WidgetHeaderProps): JSX.Element {
  const { theme } = useTheme();

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

  const actionButtonStyle: React.CSSProperties = {
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
    textDecoration: 'none',
  };

  return (
    <div style={headerStyle} className="prismiq-widget-header">
      <h3 style={titleStyle}>{title}</h3>

      {hyperlink && (
        <div style={actionsStyle}>
          <a
            href={hyperlink.url}
            target={hyperlink.target ?? '_blank'}
            rel="noopener noreferrer"
            title={hyperlink.title ?? 'Open link'}
            style={actionButtonStyle}
            className="prismiq-widget-action-button"
            aria-label={hyperlink.title ?? 'Open link'}
          >
            <Icon name="link" size={16} />
          </a>
        </div>
      )}

      <style>{`
        .prismiq-widget-action-button:hover {
          background-color: ${theme.colors.surfaceHover};
          color: ${theme.colors.text};
        }
      `}</style>
    </div>
  );
}
