'use client';

import React from 'react';
import { useTheme } from '../../theme';

/**
 * Props for the Skeleton component.
 */
export interface SkeletonProps {
  /** Width of the skeleton (CSS value or number for pixels) */
  width?: string | number;
  /** Height of the skeleton (CSS value or number for pixels) */
  height?: string | number;
  /** Border radius of the skeleton */
  borderRadius?: string;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Custom inline styles */
  style?: React.CSSProperties;
}

/**
 * Base skeleton loading placeholder with shimmer animation.
 *
 * @example
 * ```tsx
 * // Simple skeleton
 * <Skeleton width={200} height={20} />
 *
 * // Circular skeleton
 * <Skeleton width={40} height={40} borderRadius="50%" />
 *
 * // Full width
 * <Skeleton width="100%" height={100} />
 * ```
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = '4px',
  animate = true,
  className,
  style,
}: SkeletonProps): React.ReactElement {
  const { theme } = useTheme();

  const normalizedWidth = typeof width === 'number' ? `${width}px` : width;
  const normalizedHeight = typeof height === 'number' ? `${height}px` : height;

  const shimmerStyle: React.CSSProperties = {
    display: 'block',
    width: normalizedWidth,
    height: normalizedHeight,
    borderRadius,
    background: animate
      ? `linear-gradient(
          90deg,
          ${theme.colors.surface} 25%,
          ${theme.colors.border} 50%,
          ${theme.colors.surface} 75%
        )`
      : theme.colors.surface,
    backgroundSize: '200% 100%',
    animation: animate ? 'prismiq-shimmer 1.5s infinite' : 'none',
    ...style,
  };

  return (
    <>
      <style>
        {`
          @keyframes prismiq-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
      <span
        className={className}
        style={shimmerStyle}
        role="presentation"
        aria-hidden="true"
      />
    </>
  );
}

export default Skeleton;
