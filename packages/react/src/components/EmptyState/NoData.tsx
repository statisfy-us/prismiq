'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { EmptyState } from './EmptyState';

/**
 * Props for the NoData component.
 */
export interface NoDataProps {
  /** Custom message to display */
  message?: string;
  /** Callback when refresh button is clicked */
  onRefresh?: () => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Empty state for when a query returns no data.
 *
 * @example
 * ```tsx
 * <NoData message="No sales data for this period" onRefresh={refetch} />
 * ```
 */
export function NoData({
  message = 'No data available',
  onRefresh,
  className,
}: NoDataProps): React.ReactElement {
  const { theme } = useTheme();

  const icon = (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke={theme.colors.textMuted}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Database with empty state */}
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      {/* Empty indicator */}
      <path d="M12 11v4" opacity="0.5" />
      <path d="M10 13h4" opacity="0.5" />
    </svg>
  );

  return (
    <EmptyState
      className={className}
      icon={icon}
      title={message}
      description="The query returned no results. This could mean the data doesn't exist yet or the filters are too restrictive."
      action={onRefresh ? { label: 'Refresh', onClick: onRefresh } : undefined}
    />
  );
}

export default NoData;
