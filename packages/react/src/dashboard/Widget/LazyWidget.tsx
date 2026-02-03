/**
 * Lazy-loading wrapper for dashboard widgets.
 *
 * Uses Intersection Observer to detect when widgets enter the viewport,
 * then triggers data loading through the DashboardProvider.
 */

import { useEffect, type ReactNode } from 'react';
import { useWidgetVisibility } from '../useWidgetVisibility';
import { useDashboard } from '../useDashboard';
import { WidgetPlaceholder } from './WidgetPlaceholder';
import type { Widget } from '../types';

/**
 * Props for LazyWidget.
 */
export interface LazyWidgetProps {
  /** Widget to render. */
  widget: Widget;
  /** Render function for the actual widget content. */
  renderWidget: (widget: Widget) => ReactNode;
  /** Root margin for prefetching (default: "200px"). */
  rootMargin?: string;
}

/**
 * Lazy-loading wrapper component for widgets.
 *
 * Features:
 * - Tracks visibility using Intersection Observer
 * - Reports visibility to DashboardProvider for data loading
 * - Shows placeholder until widget becomes visible
 * - Keeps widget rendered once it has been visible (no re-loading on scroll)
 *
 * @example
 * ```tsx
 * <LazyWidget
 *   widget={widget}
 *   rootMargin="200px"
 *   renderWidget={(w) => (
 *     <Widget widget={w} result={results[w.id]} isLoading={loading[w.id]} />
 *   )}
 * />
 * ```
 */
export function LazyWidget({
  widget,
  renderWidget,
  rootMargin = '200px',
}: Readonly<LazyWidgetProps>): JSX.Element {
  const { registerVisibility, unregisterVisibility, lazyLoadingEnabled } = useDashboard();

  const { ref, isVisible, hasBeenVisible } = useWidgetVisibility({
    rootMargin,
    threshold: 0.1,
  });

  // Report visibility changes to DashboardProvider
  useEffect(() => {
    if (lazyLoadingEnabled) {
      registerVisibility(widget.id, isVisible);
    }
  }, [widget.id, isVisible, registerVisibility, lazyLoadingEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (lazyLoadingEnabled) {
        unregisterVisibility(widget.id);
      }
    };
  }, [widget.id, unregisterVisibility, lazyLoadingEnabled]);

  // Determine what to render:
  // - If lazy loading is disabled, always render the widget
  // - If widget has been visible (or is a text widget with no query), render it
  // - Otherwise show placeholder
  const shouldRenderContent =
    !lazyLoadingEnabled || hasBeenVisible || widget.type === 'text';

  const containerStyle: React.CSSProperties = {
    height: '100%',
    width: '100%',
  };

  return (
    <div ref={ref} style={containerStyle}>
      {shouldRenderContent ? renderWidget(widget) : <WidgetPlaceholder widget={widget} />}
    </div>
  );
}
