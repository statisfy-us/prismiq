/**
 * WidgetContainer component.
 *
 * Wraps a widget with drag handle and edit controls for editable mode.
 */

import { useState, type ReactNode } from 'react';

import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useTheme } from '../../theme';
import type { Widget } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface WidgetContainerProps {
  /** Widget data. */
  widget: Widget;
  /** Dashboard ID. */
  dashboardId: string;
  /** Whether the widget is editable. */
  editable?: boolean;
  /** Callback when edit is clicked. */
  onEdit?: (widget: Widget) => void;
  /** Callback when delete is clicked. */
  onDelete?: (widgetId: string) => void;
  /** Callback when duplicate is clicked. */
  onDuplicate?: (widgetId: string) => void;
  /** Widget content to render. */
  children: ReactNode;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Container for widgets with edit controls.
 *
 * Shows drag handle and action buttons on hover in editable mode.
 *
 * @example
 * ```tsx
 * <WidgetContainer
 *   widget={widget}
 *   dashboardId={dashboardId}
 *   editable={true}
 *   onEdit={(w) => openEditor(w)}
 *   onDelete={(id) => deleteWidget(id)}
 * >
 *   <WidgetContent widget={widget} result={result} />
 * </WidgetContainer>
 * ```
 */
export function WidgetContainer({
  widget,
  dashboardId: _dashboardId,
  editable = false,
  onEdit,
  onDelete,
  onDuplicate,
  children,
}: WidgetContainerProps): JSX.Element {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Container styles
  const containerStyles: React.CSSProperties = {
    position: 'relative',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  // Drag handle styles
  const dragHandleStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '24px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHover,
    cursor: 'grab',
    opacity: isHovered && editable ? 1 : 0,
    transition: 'opacity 0.2s',
    zIndex: 10,
    fontSize: '12px',
    color: theme.colors.textMuted,
    userSelect: 'none',
  };

  // Edit overlay styles
  const overlayStyles: React.CSSProperties = {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    display: 'flex',
    gap: theme.spacing.xs,
    zIndex: 20,
    opacity: isHovered && editable ? 1 : 0,
    transition: 'opacity 0.2s',
  };

  // Content wrapper styles (adds padding when drag handle is visible)
  const contentStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingLeft: editable && isHovered ? '24px' : 0,
    transition: 'padding-left 0.2s',
  };

  return (
    <div
      className={`prismiq-widget-container ${editable ? 'editable' : ''}`}
      style={containerStyles}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`widget-container-${widget.id}`}
    >
      {/* Drag handle for react-grid-layout */}
      {editable && (
        <div
          className="prismiq-widget-drag-handle"
          style={dragHandleStyles}
          title="Drag to move"
        >
          <span style={{ transform: 'rotate(90deg)' }}>⋮⋮</span>
        </div>
      )}

      {/* Widget content */}
      <div style={contentStyles}>{children}</div>

      {/* Edit controls overlay */}
      {editable && (
        <div style={overlayStyles}>
          {onDuplicate && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(widget.id);
              }}
              title="Duplicate"
              data-testid="duplicate-widget-button"
            >
              <Icon name="copy" size={14} />
            </Button>
          )}
          {onEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(widget);
              }}
              title="Edit"
              data-testid="edit-widget-button"
            >
              <Icon name="edit" size={14} />
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(widget.id);
              }}
              title="Delete"
              data-testid="delete-widget-button"
            >
              <Icon name="trash" size={14} />
            </Button>
          )}
        </div>
      )}

      {/* Inline styles for active drag state */}
      <style>
        {`
          .prismiq-widget-container.editable .prismiq-widget-drag-handle:active {
            cursor: grabbing;
          }
        `}
      </style>
    </div>
  );
}
