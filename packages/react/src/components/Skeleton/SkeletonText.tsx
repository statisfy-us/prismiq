'use client';

import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * Props for the SkeletonText component.
 */
export interface SkeletonTextProps {
  /** Number of lines to show */
  lines?: number;
  /** Width of the last line (for natural-looking text) */
  lastLineWidth?: string;
  /** Height of each line */
  lineHeight?: number;
  /** Gap between lines */
  gap?: number;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Skeleton placeholder for text content.
 *
 * @example
 * ```tsx
 * // Single line
 * <SkeletonText />
 *
 * // Multiple lines with shorter last line
 * <SkeletonText lines={3} lastLineWidth="60%" />
 *
 * // Paragraph
 * <SkeletonText lines={5} lastLineWidth="40%" gap={8} />
 * ```
 */
export function SkeletonText({
  lines = 1,
  lastLineWidth = '80%',
  lineHeight = 16,
  gap = 8,
  animate = true,
  className,
}: SkeletonTextProps): React.ReactElement {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: `${gap}px`,
  };

  return (
    <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => {
        const isLastLine = index === lines - 1;
        const width = isLastLine && lines > 1 ? lastLineWidth : '100%';

        return (
          <Skeleton
            key={index}
            width={width}
            height={lineHeight}
            animate={animate}
          />
        );
      })}
    </div>
  );
}

export default SkeletonText;
