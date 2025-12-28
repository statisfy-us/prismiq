'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { EmptyState } from './EmptyState';

/**
 * Props for the EmptyDashboard component.
 */
export interface EmptyDashboardProps {
  /** Callback when add widget button is clicked */
  onAddWidget?: () => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Empty state for dashboards with no widgets.
 *
 * @example
 * ```tsx
 * <EmptyDashboard onAddWidget={openWidgetPalette} />
 * ```
 */
export function EmptyDashboard({
  onAddWidget,
  className,
}: EmptyDashboardProps): React.ReactElement {
  const { theme } = useTheme();

  const icon = (
    <svg
      width="80"
      height="80"
      viewBox="0 0 24 24"
      fill="none"
      stroke={theme.colors.textMuted}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Dashboard grid */}
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      {/* Plus sign in center */}
      <circle cx="12" cy="12" r="3" fill={theme.colors.surface} stroke={theme.colors.primary} strokeWidth="1.5" />
      <path d="M12 10v4" stroke={theme.colors.primary} strokeWidth="1.5" />
      <path d="M10 12h4" stroke={theme.colors.primary} strokeWidth="1.5" />
    </svg>
  );

  return (
    <EmptyState
      className={className}
      icon={icon}
      title="This dashboard is empty"
      description="Get started by adding your first widget. You can add charts, metrics, tables, and more."
      action={onAddWidget ? { label: 'Add Widget', onClick: onAddWidget } : undefined}
    />
  );
}

export default EmptyDashboard;
