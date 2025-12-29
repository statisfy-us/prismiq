/**
 * Widget container component.
 */

import { useCallback } from 'react';
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
 *   editable={true}
 *   onEdit={() => openEditor(widget.id)}
 *   onRemove={() => removeWidget(widget.id)}
 * />
 * ```
 */
export function Widget({
  widget,
  result,
  isLoading = false,
  error,
  editable = false,
  onEdit,
  onRemove,
  onDuplicate,
  onRefresh,
  onFullscreen,
  className = '',
}: WidgetProps): JSX.Element {
  const { theme } = useTheme();

  // Handle menu actions
  const handleMenuAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'edit':
          onEdit?.();
          break;
        case 'remove':
          onRemove?.();
          break;
        case 'duplicate':
          onDuplicate?.();
          break;
        case 'refresh':
          onRefresh?.();
          break;
        case 'fullscreen':
          onFullscreen?.();
          break;
      }
    },
    [onEdit, onRemove, onDuplicate, onRefresh, onFullscreen]
  );

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    // Don't use overflow: hidden here - it clips the dropdown menu
  };

  return (
    <div className={`prismiq-widget ${className}`} style={containerStyle}>
      <WidgetHeader
        title={widget.title}
        editable={editable}
        isLoading={isLoading}
        onMenuAction={handleMenuAction}
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
