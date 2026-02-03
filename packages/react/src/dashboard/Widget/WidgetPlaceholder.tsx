/**
 * Placeholder component shown for widgets before they become visible.
 *
 * Displays a lightweight skeleton matching the widget's visual structure.
 */

import { useTheme } from '../../theme';
import type { Widget } from '../types';

/**
 * Props for WidgetPlaceholder.
 */
export interface WidgetPlaceholderProps {
  /** Widget to show placeholder for. */
  widget: Widget;
}

/**
 * Skeleton placeholder for widgets not yet visible.
 *
 * Shows widget title and a loading skeleton to indicate content will load
 * when the user scrolls to this position.
 */
export function WidgetPlaceholder({ widget }: Readonly<WidgetPlaceholderProps>): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    minHeight: '40px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  };

  const skeletonContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const skeletonBarStyle: React.CSSProperties = {
    height: '8px',
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    animation: 'prismiq-skeleton-pulse 1.5s ease-in-out infinite',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  };

  return (
    <div className="prismiq-widget-placeholder" style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{widget.title}</h3>
      </div>
      <div style={contentStyle}>
        <div style={skeletonContainerStyle}>
          <div style={{ ...skeletonBarStyle, width: '120px' }} />
          <div style={{ ...skeletonBarStyle, width: '80px' }} />
          <div style={{ ...skeletonBarStyle, width: '100px' }} />
          <span style={hintStyle}>Scroll to load</span>
        </div>
      </div>
      <style>{`
        @keyframes prismiq-skeleton-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
