/**
 * Dashboard grid layout component using react-grid-layout.
 */

import { useCallback, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import { useTheme } from '../../theme';
import type { DashboardLayoutProps, Widget, WidgetPosition } from '../types';

// Re-export Layout type for convenience
type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

// Apply width provider for responsive behavior
// Use dynamic import pattern to work around WidthProvider typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RGL = GridLayout as any;
const ResponsiveGridLayout = RGL.WidthProvider
  ? RGL.WidthProvider(GridLayout)
  : GridLayout;

/**
 * Convert Widget positions to react-grid-layout Layout format.
 */
function widgetsToLayout(widgets: Widget[]): LayoutItem[] {
  return widgets.map((widget) => ({
    i: widget.id,
    x: widget.position.x,
    y: widget.position.y,
    w: widget.position.w,
    h: widget.position.h,
    minW: widget.position.minW,
    minH: widget.position.minH,
    maxW: widget.position.maxW,
    maxH: widget.position.maxH,
  }));
}

/**
 * Convert react-grid-layout Layout to Widget positions.
 */
function layoutToPositions(layout: LayoutItem[]): Record<string, WidgetPosition> {
  const positions: Record<string, WidgetPosition> = {};

  for (const item of layout) {
    positions[item.i] = {
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
    };
  }

  return positions;
}

/**
 * Dashboard grid layout component.
 *
 * Uses react-grid-layout to provide a draggable and resizable grid.
 *
 * @example
 * ```tsx
 * <DashboardLayout
 *   widgets={widgets}
 *   layout={dashboardLayout}
 *   editable={true}
 *   onLayoutChange={(positions) => updatePositions(positions)}
 *   renderWidget={(widget) => <Widget widget={widget} />}
 * />
 * ```
 */
export function DashboardLayout({
  widgets,
  layout,
  editable = false,
  onLayoutChange,
  renderWidget,
  className = '',
}: DashboardLayoutProps): JSX.Element {
  const { theme } = useTheme();

  // Convert widgets to grid layout
  const gridLayout = useMemo(() => widgetsToLayout(widgets), [widgets]);

  // Handle layout changes
  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      if (onLayoutChange) {
        const positions = layoutToPositions(newLayout);
        onLayoutChange(positions);
      }
    },
    [onLayoutChange]
  );

  // Base styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.colors.background,
    minHeight: '100%',
    position: 'relative',
  };

  const itemStyle: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadows.sm,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  // Drag handle style (for editable mode)
  const dragHandleStyle: React.CSSProperties = {
    cursor: editable ? 'move' : 'default',
    height: '100%',
    width: '100%',
  };

  return (
    <div className={className} style={containerStyle}>
      <ResponsiveGridLayout
        layout={gridLayout}
        cols={layout.columns || 12}
        rowHeight={layout.row_height || 60}
        margin={layout.margin || [16, 16]}
        containerPadding={[16, 16]}
        compactType={layout.compact_type || 'vertical'}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".prismiq-widget-drag-handle"
        useCSSTransforms={true}
      >
        {widgets.map((widget) => (
          <div key={widget.id} style={itemStyle}>
            <div className="prismiq-widget-drag-handle" style={dragHandleStyle}>
              {renderWidget(widget)}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {/* Inline styles for react-grid-layout */}
      <style>{`
        .react-grid-layout {
          position: relative;
        }
        .react-grid-item {
          transition: all 200ms ease;
          transition-property: left, top, width, height;
        }
        .react-grid-item.cssTransforms {
          transition-property: transform, width, height;
        }
        .react-grid-item.resizing {
          transition: none;
          z-index: 1;
          will-change: width, height;
        }
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 3;
          will-change: transform;
          box-shadow: ${theme.shadows.lg};
        }
        .react-grid-item.dropping {
          visibility: hidden;
        }
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 20px;
          height: 20px;
        }
        .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 8px;
          height: 8px;
          border-right: 2px solid ${theme.colors.border};
          border-bottom: 2px solid ${theme.colors.border};
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-se {
          bottom: 0;
          right: 0;
          cursor: se-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-sw {
          bottom: 0;
          left: 0;
          cursor: sw-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-nw {
          top: 0;
          left: 0;
          cursor: nw-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-ne {
          top: 0;
          right: 0;
          cursor: ne-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-w,
        .react-grid-item > .react-resizable-handle.react-resizable-handle-e {
          top: 50%;
          margin-top: -10px;
          cursor: ew-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-w {
          left: 0;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-e {
          right: 0;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-n,
        .react-grid-item > .react-resizable-handle.react-resizable-handle-s {
          left: 50%;
          margin-left: -10px;
          cursor: ns-resize;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-n {
          top: 0;
        }
        .react-grid-item > .react-resizable-handle.react-resizable-handle-s {
          bottom: 0;
        }
        .react-grid-placeholder {
          background: ${theme.colors.primary};
          opacity: 0.2;
          border-radius: ${theme.radius.md};
          transition-duration: 100ms;
          z-index: 2;
          user-select: none;
        }
      `}</style>
    </div>
  );
}
