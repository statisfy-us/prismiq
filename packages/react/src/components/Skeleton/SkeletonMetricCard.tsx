'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { Skeleton } from './Skeleton';
import { SkeletonText } from './SkeletonText';

/**
 * Props for the SkeletonMetricCard component.
 */
export interface SkeletonMetricCardProps {
  /** Whether to show a sparkline placeholder */
  showSparkline?: boolean;
  /** Whether to show a trend indicator placeholder */
  showTrend?: boolean;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Skeleton placeholder for MetricCard components.
 *
 * @example
 * ```tsx
 * <SkeletonMetricCard />
 * <SkeletonMetricCard showSparkline showTrend />
 * ```
 */
export function SkeletonMetricCard({
  showSparkline = false,
  showTrend = true,
  animate = true,
  className,
}: SkeletonMetricCardProps): React.ReactElement {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    minWidth: '200px',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '8px',
  };

  const valueContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: showSparkline ? '12px' : '0',
  };

  const trendStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const sparklineStyle: React.CSSProperties = {
    marginTop: '8px',
    height: '40px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
  };

  return (
    <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
      {/* Title */}
      <div style={headerStyle}>
        <Skeleton width={120} height={14} animate={animate} />
      </div>

      {/* Value and trend */}
      <div style={valueContainerStyle}>
        {/* Main value */}
        <Skeleton width={80} height={32} animate={animate} />

        {/* Trend indicator */}
        {showTrend && (
          <div style={trendStyle}>
            <Skeleton width={16} height={16} borderRadius="50%" animate={animate} />
            <Skeleton width={40} height={14} animate={animate} />
          </div>
        )}
      </div>

      {/* Description */}
      <SkeletonText lines={1} lineHeight={12} animate={animate} />

      {/* Sparkline */}
      {showSparkline && (
        <div style={sparklineStyle}>
          {Array.from({ length: 12 }, (_, i) => {
            const heights = [30, 50, 45, 70, 55, 80, 60, 75, 65, 85, 70, 90];
            return (
              <Skeleton
                key={i}
                width={6}
                height={`${heights[i % heights.length]}%`}
                borderRadius="2px"
                animate={animate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SkeletonMetricCard;
