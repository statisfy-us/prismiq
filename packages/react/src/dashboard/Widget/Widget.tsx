/**
 * Widget container component.
 */

import { useTheme } from '../../theme';
import { WidgetHeader } from './WidgetHeader';
import { WidgetContent } from './WidgetContent';
import type { WidgetProps } from '../types';

/**
 * Widget container with header and content.
 *
 * @example
 * ```tsx
 * <Widget
 *   widget={widget}
 *   result={queryResult}
 *   isLoading={false}
 *   lastRefreshed={1706123456}
 *   isRefreshing={false}
 *   onRefresh={() => refreshWidget(widget.id)}
 * />
 * ```
 */
export function Widget({
  widget,
  result,
  isLoading = false,
  error,
  className = '',
  lastRefreshed,
  isRefreshing = false,
  onRefresh,
}: WidgetProps): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
  };

  return (
    <div className={`prismiq-widget ${className}`} style={containerStyle}>
      <WidgetHeader
        title={widget.title}
        hyperlink={widget.hyperlink}
        lastRefreshed={lastRefreshed}
        isRefreshing={isRefreshing}
        onRefresh={onRefresh}
      />
      <WidgetContent
        widget={widget}
        result={result}
        isLoading={isLoading}
        error={error}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
