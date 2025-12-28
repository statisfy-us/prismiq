/**
 * MetricCard component for displaying KPIs.
 */

import React from 'react';
import { useTheme } from '../../theme';
import { formatMetricValue } from '../utils';
import type { MetricCardProps } from '../types';
import { TrendIndicator } from './TrendIndicator';
import { Sparkline } from './Sparkline';

/**
 * A card component for displaying key metrics with optional trend and sparkline.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Revenue"
 *   value={1234567}
 *   format="currency"
 *   trend={{ value: 12.5, direction: 'up', label: 'vs last month' }}
 *   sparklineData={[100, 120, 115, 130, 145, 160]}
 * />
 * ```
 */
export function MetricCard({
  title,
  value,
  format = 'number',
  currencySymbol = '$',
  decimals = 0,
  trend,
  trendPositive = 'up',
  sparklineData,
  sparklineColor,
  size = 'md',
  loading = false,
  className,
  onClick,
}: MetricCardProps): JSX.Element {
  const { theme } = useTheme();

  // Size-based styles
  const sizeConfig = {
    sm: {
      padding: theme.spacing.md,
      titleSize: theme.fontSizes.xs,
      valueSize: theme.fontSizes.xl,
      sparklineHeight: 32,
    },
    md: {
      padding: theme.spacing.lg,
      titleSize: theme.fontSizes.sm,
      valueSize: theme.fontSizes['2xl'],
      sparklineHeight: 40,
    },
    lg: {
      padding: theme.spacing.xl,
      titleSize: theme.fontSizes.base,
      valueSize: '28px',
      sparklineHeight: 50,
    },
  };

  const config = sizeConfig[size];

  // Container styles
  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: config.padding,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
  };

  // Header row styles
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  };

  // Title styles
  const titleStyle: React.CSSProperties = {
    fontSize: config.titleSize,
    fontWeight: 500,
    color: theme.colors.textMuted,
    margin: 0,
  };

  // Value styles
  const valueStyle: React.CSSProperties = {
    fontSize: config.valueSize,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    lineHeight: 1.2,
  };

  // Sparkline container
  const sparklineContainerStyle: React.CSSProperties = {
    marginTop: theme.spacing.md,
  };

  // Loading skeleton styles
  const skeletonStyle: React.CSSProperties = {
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    animation: 'prismiq-pulse 1.5s ease-in-out infinite',
  };

  // Format the value
  const formattedValue = formatMetricValue(value, format, {
    currencySymbol,
    decimals,
  });

  return (
    <div
      style={containerStyle}
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Pulse animation for loading */}
      <style>{`
        @keyframes prismiq-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Header with title and trend */}
      <div style={headerStyle}>
        {loading ? (
          <div style={{ ...skeletonStyle, width: '80px', height: '14px' }} />
        ) : (
          <h3 style={titleStyle}>{title}</h3>
        )}

        {trend && !loading && (
          <TrendIndicator
            trend={trend}
            trendPositive={trendPositive}
            size={size}
          />
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div
          style={{
            ...skeletonStyle,
            width: '120px',
            height: size === 'sm' ? '20px' : size === 'lg' ? '32px' : '24px',
            marginTop: theme.spacing.xs,
          }}
        />
      ) : (
        <p style={valueStyle}>{formattedValue}</p>
      )}

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 0 && !loading && (
        <div style={sparklineContainerStyle}>
          <Sparkline
            data={sparklineData}
            color={sparklineColor}
            height={config.sparklineHeight}
          />
        </div>
      )}

      {/* Loading sparkline skeleton */}
      {sparklineData && loading && (
        <div
          style={{
            ...skeletonStyle,
            width: '100%',
            height: `${config.sparklineHeight}px`,
            marginTop: theme.spacing.md,
          }}
        />
      )}
    </div>
  );
}

export default MetricCard;
