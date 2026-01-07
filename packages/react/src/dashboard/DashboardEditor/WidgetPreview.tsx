/**
 * Widget preview component for the full-page widget editor.
 *
 * Renders a live preview of the widget being edited.
 */

import { useTheme } from '../../theme';
import { WidgetContent } from '../Widget/WidgetContent';
import type { Widget, WidgetConfig, WidgetType } from '../types';
import type { QueryDefinition, QueryResult } from '../../types';

export interface WidgetPreviewProps {
  /** Widget type. */
  type: WidgetType;
  /** Widget title. */
  title: string;
  /** Widget configuration. */
  config: WidgetConfig;
  /** Query definition (null for text widgets). */
  query: QueryDefinition | null;
  /** Query result data. */
  result: QueryResult | null;
  /** Whether data is loading. */
  isLoading?: boolean;
  /** Error if query failed. */
  error?: Error | null;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Create a temporary widget object for preview.
 */
function createPreviewWidget(
  type: WidgetType,
  title: string,
  config: WidgetConfig,
  query: QueryDefinition | null
): Widget {
  return {
    id: 'preview',
    type,
    title,
    config,
    query,
    position: { x: 0, y: 0, w: 6, h: 4 },
  };
}

/**
 * Live preview of the widget being edited.
 *
 * Shows the actual rendered widget with current configuration and data.
 */
export function WidgetPreview({
  type,
  title,
  config,
  query,
  result,
  isLoading = false,
  error,
  className = '',
}: WidgetPreviewProps): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.base,
    fontWeight: 500,
    color: theme.colors.text,
    margin: 0,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
  };

  // Create a preview widget object
  const previewWidget = createPreviewWidget(type, title, config, query);

  // Check if we need to show empty state
  const needsQuery = type !== 'text';
  const showEmptyState = needsQuery && !query && !isLoading;

  return (
    <div className={`prismiq-widget-preview ${className}`} style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>{title || 'Widget Preview'}</h3>
        <span style={labelStyle}>Preview</span>
      </div>

      <div style={contentStyle}>
        {showEmptyState ? (
          <div style={emptyStateStyle}>
            <div
              style={{
                fontSize: '32px',
                marginBottom: theme.spacing.sm,
                opacity: 0.5,
              }}
            >
              ?
            </div>
            <div style={{ fontSize: theme.fontSizes.sm, marginBottom: theme.spacing.xs }}>
              No data source configured
            </div>
            <div style={{ fontSize: theme.fontSizes.xs }}>
              Select a saved query or build a new query to see data
            </div>
          </div>
        ) : (
          <WidgetContent
            widget={previewWidget}
            result={result}
            isLoading={isLoading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
