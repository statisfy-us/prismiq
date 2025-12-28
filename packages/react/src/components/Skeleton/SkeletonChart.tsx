'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { Skeleton } from './Skeleton';

/**
 * Props for the SkeletonChart component.
 */
export interface SkeletonChartProps {
  /** Type of chart to simulate */
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  /** Height of the chart skeleton */
  height?: number;
  /** Whether to animate the skeleton */
  animate?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Skeleton placeholder for chart components.
 *
 * @example
 * ```tsx
 * <SkeletonChart type="bar" height={300} />
 * <SkeletonChart type="pie" height={250} />
 * <SkeletonChart type="line" />
 * ```
 */
export function SkeletonChart({
  type,
  height = 300,
  animate = true,
  className,
}: SkeletonChartProps): React.ReactElement {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    backgroundColor: theme.colors.surface,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
  };

  if (type === 'bar') {
    // Bar chart: vertical bars of varying heights
    const barCount = 6;
    const barHeights = [60, 80, 45, 90, 55, 70];

    return (
      <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '16px',
            height: '80%',
            width: '100%',
            justifyContent: 'space-around',
          }}
        >
          {barHeights.slice(0, barCount).map((heightPercent, index) => (
            <Skeleton
              key={index}
              width={40}
              height={`${heightPercent}%`}
              borderRadius="4px 4px 0 0"
              animate={animate}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'line' || type === 'area') {
    // Line/Area chart: wavy path representation
    return (
      <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
        <svg
          width="100%"
          height="80%"
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
          style={{ opacity: 0.5 }}
        >
          <defs>
            <linearGradient id="skeleton-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="25%" stopColor={theme.colors.border} />
              <stop offset="50%" stopColor={theme.colors.surfaceHover} />
              <stop offset="75%" stopColor={theme.colors.border} />
            </linearGradient>
          </defs>
          {type === 'area' && (
            <path
              d="M0,80 Q50,20 100,50 T200,30 L200,100 L0,100 Z"
              fill={theme.colors.border}
              opacity="0.3"
            />
          )}
          <path
            d="M0,80 Q50,20 100,50 T200,30"
            stroke={theme.colors.border}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          {/* Data points */}
          {[0, 50, 100, 150, 200].map((x, i) => {
            const y = [80, 35, 50, 40, 30][i];
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={theme.colors.border}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  if (type === 'pie') {
    // Pie chart: circular segments
    const size = Math.min(height - 32, 200);

    return (
      <div
        className={className}
        style={{
          ...containerStyle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="presentation"
        aria-hidden="true"
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `conic-gradient(
              ${theme.colors.border} 0deg 90deg,
              ${theme.colors.surfaceHover} 90deg 180deg,
              ${theme.colors.border} 180deg 250deg,
              ${theme.colors.surfaceHover} 250deg 360deg
            )`,
            opacity: animate ? undefined : 0.5,
            animation: animate ? 'prismiq-shimmer 1.5s infinite' : 'none',
          }}
        />
      </div>
    );
  }

  if (type === 'scatter') {
    // Scatter chart: random points
    const points = [
      { x: 20, y: 30 },
      { x: 40, y: 60 },
      { x: 60, y: 25 },
      { x: 80, y: 70 },
      { x: 100, y: 45 },
      { x: 130, y: 55 },
      { x: 150, y: 35 },
      { x: 170, y: 65 },
    ];

    return (
      <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
        <svg
          width="100%"
          height="80%"
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
        >
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="6"
              fill={theme.colors.border}
              opacity={0.6 + (i % 3) * 0.15}
            />
          ))}
        </svg>
      </div>
    );
  }

  // Default: simple rectangle
  return (
    <div className={className} style={containerStyle} role="presentation" aria-hidden="true">
      <Skeleton width="100%" height="100%" animate={animate} />
    </div>
  );
}

export default SkeletonChart;
