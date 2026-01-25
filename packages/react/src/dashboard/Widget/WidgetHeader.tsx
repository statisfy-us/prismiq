/**
 * Widget header component with title, refresh button, and actions.
 */

import { useTheme } from '../../theme';
import { Icon } from '../../components/ui';
import { formatRelativeTime } from '../../utils';
import type { WidgetHeaderProps } from '../types';

/**
 * Widget header with title, refresh timestamp, and optional hyperlink.
 */
export function WidgetHeader({
  title,
  hyperlink,
  lastRefreshed,
  isRefreshing,
  onRefresh,
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
    cursor: isRefreshing ? 'default' : 'pointer',
    transition: 'background-color 150ms, color 150ms',
    textDecoration: 'none',
    opacity: isRefreshing ? 0.6 : 1,
  };

  const timestampStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'nowrap',
  };

  const handleRefresh = () => {
    if (!isRefreshing && onRefresh) {
      onRefresh();
    }
  };

  return (
    <div style={headerStyle} className="prismiq-widget-header">
      <h3 style={titleStyle}>{title}</h3>

      <div style={actionsStyle}>
        {/* Last refreshed timestamp */}
        {lastRefreshed !== undefined && (
          <span style={timestampStyle} title={`Last refreshed: ${new Date(lastRefreshed * 1000).toLocaleString()}`}>
            {formatRelativeTime(lastRefreshed)}
          </span>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={actionButtonStyle}
            className="prismiq-widget-action-button"
            aria-label={isRefreshing ? 'Refreshing...' : 'Refresh widget'}
            title={isRefreshing ? 'Refreshing...' : 'Refresh widget'}
          >
            <Icon
              name="sync"
              size={16}
              className={isRefreshing ? 'prismiq-spin' : undefined}
            />
          </button>
        )}

        {/* Hyperlink button */}
        {hyperlink && (
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
        )}
      </div>

      <style>{`
        .prismiq-widget-action-button:hover:not(:disabled) {
          background-color: ${theme.colors.surfaceHover};
          color: ${theme.colors.text};
        }
        .prismiq-widget-action-button:disabled {
          cursor: default;
        }
        @keyframes prismiq-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .prismiq-spin {
          animation: prismiq-spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
