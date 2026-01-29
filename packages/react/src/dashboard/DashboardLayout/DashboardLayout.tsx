/**
 * Dashboard grid layout component using react-grid-layout.
 * Supports responsive breakpoints for mobile-friendly layouts.
 */

import { useCallback, useMemo, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import { useTheme } from '../../theme';
import type { DashboardLayoutProps, Widget, WidgetPosition } from '../types';

// Layout item type for react-grid-layout
interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

// Layouts type for responsive grid
interface Layouts {
  [breakpoint: string]: LayoutItem[];
}

// Create responsive grid layout with width provider HOC
const ResponsiveGridLayout = WidthProvider(Responsive);

// Responsive breakpoints
const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// Column counts per breakpoint
const COLS = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
  xxs: 2,
};

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
    minW: widget.position.minW ?? 2,
    minH: widget.position.minH ?? 2,
    maxW: widget.position.maxW,
    maxH: widget.position.maxH,
  }));
}

/**
 * Generate responsive layouts from base layout.
 * Adjusts positions for smaller screens.
 */
function generateResponsiveLayouts(
  baseLayout: LayoutItem[],
  baseCols: number
): Layouts {
  const layouts: Layouts = {
    lg: baseLayout,
  };

  // For medium screens, scale down positions
  layouts.md = baseLayout.map((item) => ({
    ...item,
    x: Math.floor((item.x / baseCols) * COLS.md),
    w: Math.min(item.w, COLS.md),
  }));

  // For small screens, stack items more
  layouts.sm = baseLayout.map((item, index) => ({
    ...item,
    x: (index % 2) * 3,
    y: Math.floor(index / 2) * item.h,
    w: Math.min(item.w, COLS.sm),
  }));

  // For extra small screens, full width
  layouts.xs = baseLayout.map((item, index) => ({
    ...item,
    x: 0,
    y: index * item.h,
    w: COLS.xs,
  }));

  // For mobile, single column
  layouts.xxs = baseLayout.map((item, index) => ({
    ...item,
    x: 0,
    y: index * item.h,
    w: COLS.xxs,
  }));

  return layouts;
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
 * Uses react-grid-layout to provide a responsive, draggable and resizable grid.
 * Supports multiple breakpoints for mobile-friendly layouts.
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
  const baseLayout = useMemo(() => widgetsToLayout(widgets), [widgets]);

  // Generate responsive layouts
  const responsiveLayouts = useMemo(
    () => generateResponsiveLayouts(baseLayout, layout.columns || 12),
    [baseLayout, layout.columns]
  );

  // Log breakpoint changes for layout debugging
  const handleBreakpointChange = useCallback((newBreakpoint: string, newCols: number) => {
    console.log(`[DashboardLayout] Breakpoint: ${newBreakpoint}, cols: ${newCols}`);
  }, []);

  // Handle layout changes
  // The legacy API passes (currentLayout, allLayouts) but we only need currentLayout
  const handleLayoutChange = useCallback(
    (currentLayout: readonly LayoutItem[]) => {
      if (onLayoutChange) {
        // Convert readonly array to mutable for our internal function
        const positions = layoutToPositions([...currentLayout]);
        onLayoutChange(positions);
      }
    },
    [onLayoutChange]
  );

  // Base styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.colors.background,
    minHeight: '100%',
    width: '100%',
    position: 'relative',
  };

  const itemStyle: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadows.sm,
    // Don't use overflow: hidden - it clips dropdown menus
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
        layouts={responsiveLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={layout.row_height || 60}
        margin={layout.margin || [16, 16]}
        containerPadding={[16, 16]}
        compactType={layout.compact_type || 'vertical'}
        isDraggable={editable}
        isResizable={editable}
        onLayoutChange={handleLayoutChange}
        onBreakpointChange={handleBreakpointChange}
        onWidthChange={(containerWidth, _margin, cols) => {
          console.log(`[DashboardLayout] Width: ${containerWidth}px, cols: ${cols}`);
        }}
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

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .react-grid-item > .react-resizable-handle {
            width: 16px;
            height: 16px;
          }
        }

        @media (max-width: 480px) {
          .react-grid-item > .react-resizable-handle {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
