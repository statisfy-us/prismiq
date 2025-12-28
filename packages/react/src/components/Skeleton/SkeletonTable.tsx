'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { Skeleton } from './Skeleton';

/**
 * Props for the SkeletonTable component.
 */
export interface SkeletonTableProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns to show */
  columns?: number;
  /** Whether to show a header row */
  showHeader?: boolean;
  /** Height of each row */
  rowHeight?: number;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Skeleton placeholder for table components.
 *
 * @example
 * ```tsx
 * <SkeletonTable rows={5} columns={4} />
 * <SkeletonTable rows={10} columns={6} showHeader={true} />
 * ```
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true,
  rowHeight = 48,
  animate = true,
  className,
}: SkeletonTableProps): React.ReactElement {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: rowHeight,
    padding: '0 16px',
    gap: '16px',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const headerStyle: React.CSSProperties = {
    ...rowStyle,
    backgroundColor: theme.colors.surfaceHover,
  };

  const cellStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  // Vary column widths for more natural appearance
  const columnWidths = ['80%', '60%', '90%', '70%', '85%', '75%'];

  return (
    <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
      {showHeader && (
        <div style={headerStyle}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <div key={`header-${colIndex}`} style={cellStyle}>
              <Skeleton
                width={columnWidths[colIndex % columnWidths.length]}
                height={14}
                animate={animate}
              />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{
            ...rowStyle,
            borderBottom: rowIndex === rows - 1 ? 'none' : rowStyle.borderBottom,
          }}
        >
          {Array.from({ length: columns }, (_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} style={cellStyle}>
              <Skeleton
                width={columnWidths[(colIndex + rowIndex) % columnWidths.length]}
                height={12}
                animate={animate}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default SkeletonTable;
