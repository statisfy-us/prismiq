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
 * />
 * ```
 */
export function Widget({
  widget,
  result,
  isLoading = false,
  error,
  className = '',
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
      />
      <WidgetContent
        widget={widget}
        result={result}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
