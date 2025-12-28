/**
 * Trend indicator component for MetricCard.
 */

import React from 'react';
import { useTheme } from '../../theme';
import type { TrendConfig } from '../types';

export interface TrendIndicatorProps {
  /** Trend configuration. */
  trend: TrendConfig;
  /** Which direction is considered positive (green). */
  trendPositive?: 'up' | 'down';
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Displays a trend arrow with percentage change.
 */
export function TrendIndicator({
  trend,
  trendPositive = 'up',
  size = 'md',
}: TrendIndicatorProps): JSX.Element {
  const { theme } = useTheme();

  // Determine if this trend is positive or negative
  const isPositive =
    (trend.direction === 'up' && trendPositive === 'up') ||
    (trend.direction === 'down' && trendPositive === 'down');

  const isNegative =
    (trend.direction === 'up' && trendPositive === 'down') ||
    (trend.direction === 'down' && trendPositive === 'up');

  // Get color based on trend
  const getColor = (): string => {
    if (trend.direction === 'flat') {
      return theme.colors.textMuted;
    }
    if (isPositive) {
      return theme.colors.success;
    }
    if (isNegative) {
      return theme.colors.error;
    }
    return theme.colors.textMuted;
  };

  // Get arrow based on direction
  const getArrow = (): string => {
    switch (trend.direction) {
      case 'up':
        return '\u2191'; // up arrow
      case 'down':
        return '\u2193'; // down arrow
      case 'flat':
      default:
        return '\u2192'; // right arrow
    }
  };

  // Size-based styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { fontSize: theme.fontSizes.xs },
    md: { fontSize: theme.fontSizes.sm },
    lg: { fontSize: theme.fontSizes.base },
  };

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    color: getColor(),
    ...sizeStyles[size],
  };

  const arrowStyle: React.CSSProperties = {
    fontWeight: 600,
  };

  const valueStyle: React.CSSProperties = {
    fontWeight: 500,
  };

  const labelStyle: React.CSSProperties = {
    color: theme.colors.textMuted,
    marginLeft: '4px',
  };

  return (
    <span style={containerStyle}>
      <span style={arrowStyle}>{getArrow()}</span>
      <span style={valueStyle}>{Math.abs(trend.value).toFixed(1)}%</span>
      {trend.label && <span style={labelStyle}>{trend.label}</span>}
    </span>
  );
}

export default TrendIndicator;
