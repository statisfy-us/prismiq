/**
 * EditableDashboardLayout component.
 *
 * Wraps DashboardLayout with auto-save functionality for layout changes.
 */

import { useCallback, useMemo, type ReactNode } from 'react';

import { AutoSaveIndicator } from '../../components/AutoSaveIndicator';
import {
  useDebouncedLayoutSave,
  type SaveStatus,
} from '../../hooks/useDebouncedLayoutSave';
import { useTheme } from '../../theme';
import type { Widget, WidgetPosition, DashboardLayout as DashboardLayoutType } from '../types';
import type { WidgetPositionUpdate } from '../../types';
import { DashboardLayout } from './DashboardLayout';

// ============================================================================
// Types
// ============================================================================

export interface EditableDashboardLayoutProps {
  /** Dashboard ID for saving. */
  dashboardId: string;
  /** Widgets to render. */
  widgets: Widget[];
  /** Layout configuration. */
  layout: DashboardLayoutType;
  /** Render function for each widget. */
  renderWidget: (widget: Widget) => ReactNode;
  /** Debounce delay for saves. */
  debounceMs?: number;
  /** Duration to show saved indicator. */
  savedDurationMs?: number;
  /** Callback on successful save. */
  onSave?: () => void;
  /** Callback on save error. */
  onError?: (error: Error) => void;
  /** Callback when layout changes (for optimistic updates). */
  onLayoutChange?: (positions: Record<string, WidgetPosition>) => void;
  /** Additional CSS class. */
  className?: string;
}

export interface EditableDashboardLayoutResult {
  /** Current save status. */
  status: SaveStatus;
  /** Last error if any. */
  error: Error | null;
  /** Force save immediately. */
  flush: () => Promise<void>;
  /** Cancel pending save. */
  cancel: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Editable dashboard layout with auto-save.
 *
 * Wraps DashboardLayout and automatically saves position changes
 * with debouncing and visual feedback.
 *
 * @example
 * ```tsx
 * function EditableDashboard({ id, widgets, layout }: Props) {
 *   const renderWidget = useCallback((widget: Widget) => (
 *     <WidgetContainer widget={widget} editable />
 *   ), []);
 *
 *   return (
 *     <EditableDashboardLayout
 *       dashboardId={id}
 *       widgets={widgets}
 *       layout={layout}
 *       renderWidget={renderWidget}
 *       debounceMs={500}
 *     />
 *   );
 * }
 * ```
 */
export function EditableDashboardLayout({
  dashboardId,
  widgets,
  layout,
  renderWidget,
  debounceMs = 500,
  savedDurationMs = 2000,
  onSave,
  onError,
  onLayoutChange,
  className = '',
}: EditableDashboardLayoutProps): JSX.Element {
  const { theme } = useTheme();

  // Auto-save hook
  const { queueUpdate, status, error } = useDebouncedLayoutSave({
    dashboardId,
    debounceMs,
    savedDurationMs,
    onSave,
    onError,
  });

  // Handle layout changes from the grid
  const handleLayoutChange = useCallback(
    (positions: Record<string, WidgetPosition>) => {
      // Convert to position update format
      const updates: WidgetPositionUpdate[] = Object.entries(positions).map(
        ([widgetId, position]) => ({
          widget_id: widgetId,
          position: {
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h,
          },
        })
      );

      // Queue the save
      queueUpdate(updates);

      // Call optional callback for optimistic updates
      onLayoutChange?.(positions);
    },
    [queueUpdate, onLayoutChange]
  );

  // Container styles
  const containerStyles = useMemo(
    (): React.CSSProperties => ({
      position: 'relative',
      height: '100%',
    }),
    []
  );

  const statusBarStyles = useMemo(
    (): React.CSSProperties => ({
      position: 'absolute',
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      zIndex: 100,
    }),
    [theme.spacing]
  );

  return (
    <div
      className={`prismiq-editable-dashboard-layout ${className}`}
      style={containerStyles}
      data-testid="dashboard-container"
    >
      {/* Auto-save indicator */}
      <div style={statusBarStyles}>
        <AutoSaveIndicator status={status} error={error} />
      </div>

      {/* Editable grid layout */}
      <DashboardLayout
        widgets={widgets}
        layout={layout}
        editable={true}
        onLayoutChange={handleLayoutChange}
        renderWidget={renderWidget}
      />
    </div>
  );
}
