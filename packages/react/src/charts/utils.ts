/**
 * Chart utility functions for Prismiq.
 */

import type { PrismiqTheme } from '../theme/types';
import type { QueryResult } from '../types';
import type { AxisFormat, ChartDataPoint, ChartSeries } from './types';

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Converts a QueryResult to chart-ready data format.
 *
 * @param result - The query result to transform
 * @param xColumn - Column name for X axis / categories
 * @param yColumns - Column names for Y axis values (creates multiple series)
 * @returns Object with categories and series arrays
 */
export function queryResultToChartData(
  result: QueryResult,
  xColumn: string,
  yColumns: string[],
  seriesColumn?: string
): { categories: string[]; series: ChartSeries[] } {
  const xIndex = result.columns.indexOf(xColumn);
  if (xIndex === -1) {
    return { categories: [], series: [] };
  }

  // If seriesColumn is provided, pivot the data to create multiple series
  if (seriesColumn) {
    const seriesIndex = result.columns.indexOf(seriesColumn);
    if (seriesIndex === -1) {
      return { categories: [], series: [] };
    }

    // Get unique x-axis values (categories)
    const xValuesSet = new Set<string>();
    result.rows.forEach((row) => {
      const xValue = row[xIndex];
      xValuesSet.add(xValue === null ? '' : String(xValue));
    });
    const categories = Array.from(xValuesSet).sort();

    // Get unique series values
    const seriesNamesSet = new Set<string>();
    result.rows.forEach((row) => {
      const seriesValue = row[seriesIndex];
      seriesNamesSet.add(seriesValue === null ? '' : String(seriesValue));
    });
    const seriesNames = Array.from(seriesNamesSet).sort();

    // Create a series for each unique value in the series column
    const series: ChartSeries[] = yColumns.flatMap((yColName) => {
      const yIndex = result.columns.indexOf(yColName);
      if (yIndex === -1) {
        return [];
      }

      return seriesNames.map((seriesName) => {
        // For this series, extract data for each category
        const data = categories.map((category) => {
          // Find the row that matches this series name and category
          const row = result.rows.find((r) => {
            const rowSeriesValue = r[seriesIndex];
            const rowXValue = r[xIndex];
            return (
              String(rowSeriesValue) === seriesName &&
              String(rowXValue) === category
            );
          });

          if (!row) {
            return null;
          }

          const value = row[yIndex];
          if (value === null || value === undefined) {
            return null;
          }
          return typeof value === 'number' ? value : Number(value);
        });

        return {
          name: seriesName,
          data,
        };
      });
    });

    return { categories, series };
  }

  // Original behavior: no series column, extract categories from X column
  const categories: string[] = result.rows.map((row) => {
    const value = row[xIndex];
    return value === null ? '' : String(value);
  });

  // Create a series for each Y column
  const series: ChartSeries[] = yColumns
    .map((colName) => {
      const yIndex = result.columns.indexOf(colName);
      if (yIndex === -1) {
        return null;
      }

      const data = result.rows.map((row) => {
        const value = row[yIndex];
        if (value === null || value === undefined) {
          return null;
        }
        return typeof value === 'number' ? value : Number(value);
      });

      return {
        name: colName,
        data,
      };
    })
    .filter((s): s is ChartSeries => s !== null);

  return { categories, series };
}

/**
 * Converts an array of data points to chart-ready format.
 *
 * @param data - Array of data points
 * @param xColumn - Property name for X axis
 * @param yColumns - Property names for Y axis values
 * @param seriesColumn - Optional column that defines series (for long-format data)
 * @returns Object with categories and series arrays
 */
export function dataPointsToChartData(
  data: ChartDataPoint[],
  xColumn: string,
  yColumns: string[],
  seriesColumn?: string
): { categories: string[]; series: ChartSeries[] } {
  // If seriesColumn is provided, pivot the data to create multiple series
  if (seriesColumn) {
    // Get unique x-axis values (categories)
    const xValuesSet = new Set<string>();
    data.forEach((point) => {
      const xValue = point[xColumn];
      xValuesSet.add(xValue === null ? '' : String(xValue));
    });
    const categories = Array.from(xValuesSet).sort();

    // Get unique series values
    const seriesNamesSet = new Set<string>();
    data.forEach((point) => {
      const seriesValue = point[seriesColumn];
      seriesNamesSet.add(seriesValue === null ? '' : String(seriesValue));
    });
    const seriesNames = Array.from(seriesNamesSet).sort();

    // Create a series for each unique value in the series column
    const series: ChartSeries[] = yColumns.flatMap((yColName) => {
      return seriesNames.map((seriesName) => {
        // For this series, extract data for each category
        const seriesData = categories.map((category) => {
          // Find the data point that matches this series name and category
          const point = data.find((p) => {
            const pSeriesValue = p[seriesColumn];
            const pXValue = p[xColumn];
            return (
              String(pSeriesValue) === seriesName && String(pXValue) === category
            );
          });

          if (!point) {
            return null;
          }

          const value = point[yColName];
          if (value === null || value === undefined) {
            return null;
          }
          return typeof value === 'number' ? value : Number(value);
        });

        return {
          name: seriesName,
          data: seriesData,
        };
      });
    });

    return { categories, series };
  }

  // Original behavior: no series column
  const categories: string[] = data.map((point) => {
    const value = point[xColumn];
    return value === null ? '' : String(value);
  });

  const series: ChartSeries[] = yColumns.map((colName) => ({
    name: colName,
    data: data.map((point) => {
      const value = point[colName];
      if (value === null || value === undefined) {
        return null;
      }
      return typeof value === 'number' ? value : Number(value);
    }),
  }));

  return { categories, series };
}

/**
 * Determines if data is a QueryResult.
 */
export function isQueryResult(
  data: QueryResult | ChartDataPoint[]
): data is QueryResult {
  return (
    data !== null &&
    typeof data === 'object' &&
    'columns' in data &&
    'rows' in data &&
    Array.isArray((data as QueryResult).columns) &&
    Array.isArray((data as QueryResult).rows)
  );
}

/**
 * Converts chart data (QueryResult or ChartDataPoint[]) to chart-ready format.
 */
export function toChartData(
  data: QueryResult | ChartDataPoint[],
  xColumn: string,
  yColumns: string[],
  seriesColumn?: string
): { categories: string[]; series: ChartSeries[] } {
  if (isQueryResult(data)) {
    return queryResultToChartData(data, xColumn, yColumns, seriesColumn);
  }
  return dataPointsToChartData(data, xColumn, yColumns, seriesColumn);
}

// ============================================================================
// Theme Integration
// ============================================================================

/**
 * Creates an ECharts theme object from a Prismiq theme.
 *
 * @param theme - Prismiq theme
 * @returns ECharts theme configuration object
 */
export function createChartTheme(theme: PrismiqTheme): Record<string, unknown> {
  return {
    color: theme.chart.colors,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: theme.fonts.sans,
      color: theme.colors.text,
    },
    title: {
      textStyle: {
        color: theme.colors.text,
        fontSize: 16,
        fontWeight: 600,
      },
    },
    legend: {
      textStyle: {
        color: theme.colors.textMuted,
        fontSize: 12,
      },
    },
    xAxis: {
      axisLine: {
        show: true,
        lineStyle: { color: theme.chart.axisColor },
      },
      axisTick: {
        show: true,
        lineStyle: { color: theme.chart.axisColor },
      },
      axisLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
      },
      splitLine: {
        show: false,
        lineStyle: { color: theme.chart.gridColor },
      },
    },
    yAxis: {
      axisLine: {
        show: false,
        lineStyle: { color: theme.chart.axisColor },
      },
      axisTick: {
        show: false,
        lineStyle: { color: theme.chart.axisColor },
      },
      axisLabel: {
        color: theme.colors.textMuted,
        fontSize: 11,
      },
      splitLine: {
        show: true,
        lineStyle: { color: theme.chart.gridColor, type: 'dashed' },
      },
    },
    tooltip: {
      backgroundColor: theme.chart.tooltipBackground,
      borderColor: theme.colors.border,
      borderWidth: 1,
      textStyle: {
        color: theme.name === 'dark' ? '#f9fafb' : '#ffffff',
        fontSize: 12,
      },
      padding: [8, 12],
    },
    grid: {
      left: 60,
      right: 20,
      top: 40,
      bottom: 40,
      containLabel: false,
    },
  };
}

/**
 * Applies theme styling to an existing ECharts option.
 *
 * @param option - ECharts option object
 * @param theme - Prismiq theme
 * @returns Modified option with theme applied
 */
export function applyThemeToOption(
  option: Record<string, unknown>,
  theme: PrismiqTheme
): Record<string, unknown> {
  const chartTheme = createChartTheme(theme);

  return {
    ...option,
    color: option.color || chartTheme.color,
    backgroundColor: chartTheme.backgroundColor,
    textStyle: {
      ...(chartTheme.textStyle as Record<string, unknown>),
      ...(typeof option.textStyle === 'object' ? option.textStyle : {}),
    },
    tooltip: {
      ...(chartTheme.tooltip as Record<string, unknown>),
      ...(typeof option.tooltip === 'object' ? option.tooltip : {}),
    },
    xAxis: mergeAxisConfig(option.xAxis, chartTheme.xAxis as Record<string, unknown>),
    yAxis: mergeAxisConfig(option.yAxis, chartTheme.yAxis as Record<string, unknown>),
    grid: {
      ...(chartTheme.grid as Record<string, unknown>),
      ...(typeof option.grid === 'object' ? option.grid : {}),
    },
  };
}

/**
 * Merges axis configuration with theme defaults.
 */
function mergeAxisConfig(
  axisOption: unknown,
  themeAxis: Record<string, unknown>
): unknown {
  if (Array.isArray(axisOption)) {
    return axisOption.map((axis) =>
      mergeAxisConfig(axis, themeAxis)
    );
  }
  if (typeof axisOption === 'object' && axisOption !== null) {
    return {
      ...themeAxis,
      ...(axisOption as Record<string, unknown>),
      axisLine: {
        ...(themeAxis.axisLine as Record<string, unknown>),
        ...((axisOption as Record<string, unknown>).axisLine as Record<string, unknown> || {}),
      },
      axisLabel: {
        ...(themeAxis.axisLabel as Record<string, unknown>),
        ...((axisOption as Record<string, unknown>).axisLabel as Record<string, unknown> || {}),
      },
      splitLine: {
        ...(themeAxis.splitLine as Record<string, unknown>),
        ...((axisOption as Record<string, unknown>).splitLine as Record<string, unknown> || {}),
      },
    };
  }
  return themeAxis;
}

// ============================================================================
// Axis Formatting
// ============================================================================

/**
 * Formats a number value for display on an axis.
 *
 * @param value - The number to format
 * @param format - The format type
 * @param options - Additional formatting options
 * @returns Formatted string
 */
export function formatAxisLabel(
  value: number,
  format: AxisFormat,
  options?: {
    currencySymbol?: string;
    decimals?: number;
    compactNotation?: 'K' | 'M' | 'B' | 'T' | null;
  }
): string {
  const { currencySymbol = '$', decimals = 2, compactNotation } = options || {};

  switch (format) {
    case 'currency':
      // Only use compact notation if explicitly specified
      if (compactNotation) {
        return `${currencySymbol}${formatCompactAtThreshold(value, compactNotation, decimals)}`;
      }
      // Otherwise show full number with proper formatting
      return `${currencySymbol}${value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;

    case 'percent':
      return `${(value * 100).toFixed(decimals)}%`;

    case 'compact':
      return formatCompact(value, decimals);

    case 'number':
    default:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

/**
 * Formats a number in compact notation (K, M, B).
 */
export function formatCompact(value: number, decimals: number = 1): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(decimals)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(decimals)}K`;
  }
  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Formats a number with compact notation at a specific threshold.
 * Only applies notation if value meets the threshold.
 *
 * @param value - The number to format
 * @param notation - The notation threshold (K, M, B, T)
 * @param decimals - Number of decimal places
 * @returns Formatted string
 *
 * @example
 * formatCompactAtThreshold(8693, 'K', 3) => "8.693K"
 * formatCompactAtThreshold(8693, 'M', 3) => "8,693" (below threshold)
 * formatCompactAtThreshold(8693000, 'M', 3) => "8.693M"
 */
export function formatCompactAtThreshold(
  value: number,
  notation: 'K' | 'M' | 'B' | 'T',
  decimals: number = 0
): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Define thresholds and divisors
  const thresholds: Record<'K' | 'M' | 'B' | 'T', { threshold: number; divisor: number }> = {
    K: { threshold: 1_000, divisor: 1_000 },
    M: { threshold: 1_000_000, divisor: 1_000_000 },
    B: { threshold: 1_000_000_000, divisor: 1_000_000_000 },
    T: { threshold: 1_000_000_000_000, divisor: 1_000_000_000_000 },
  };

  const config = thresholds[notation];

  // Only apply notation if value meets the threshold
  if (absValue >= config.threshold) {
    const formatted = (absValue / config.divisor).toFixed(decimals);
    return `${sign}${formatted}${notation}`;
  }

  // Below threshold: show full number with locale formatting
  return `${sign}${absValue.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formats a metric value for display in a MetricCard.
 *
 * @param value - The numeric value to format
 * @param format - Format type: 'number', 'currency', 'percent', or 'compact'
 * @param options - Formatting options
 * @param options.currencySymbol - Currency symbol (default: '$')
 * @param options.decimals - Number of decimal places (default: 0)
 * @param options.compactNotation - Compact notation: 'K', 'M', 'B', or 'T' (applies to currency too)
 */
export function formatMetricValue(
  value: number | string,
  format: 'number' | 'currency' | 'percent' | 'compact' = 'number',
  options?: { currencySymbol?: string; decimals?: number; compactNotation?: 'K' | 'M' | 'B' | 'T' | null }
): string {
  if (typeof value === 'string') {
    return value;
  }

  const { currencySymbol = '$', decimals = 0, compactNotation } = options || {};

  switch (format) {
    case 'currency':
      // If compact notation is specified, use it with the currency symbol
      if (compactNotation) {
        const compactValue = formatCompactAtThreshold(value, compactNotation, decimals);
        return `${currencySymbol}${compactValue}`;
      }
      return `${currencySymbol}${value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}`;

    case 'percent':
      return `${(value * 100).toFixed(decimals)}%`;

    case 'compact':
      return formatCompact(value, decimals);

    case 'number':
    default:
      // Support compact notation for plain numbers too
      if (compactNotation) {
        return formatCompactAtThreshold(value, compactNotation, decimals);
      }
      return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  }
}

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Default fallback color.
 */
const DEFAULT_COLOR = '#3b82f6';

/**
 * Gets an array of colors from the theme, cycling if needed.
 *
 * @param theme - Prismiq theme
 * @param count - Number of colors needed
 * @returns Array of color strings
 */
export function getChartColors(theme: PrismiqTheme, count: number): string[] {
  const themeColors = theme.chart.colors;
  if (themeColors.length === 0) {
    return Array(count).fill(DEFAULT_COLOR);
  }

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const color = themeColors[i % themeColors.length];
    result.push(color ?? DEFAULT_COLOR);
  }

  return result;
}

/**
 * Generates a gradient color specification for ECharts.
 */
export function createGradientColor(
  color: string,
  opacity: number = 0.2
): Record<string, unknown> {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: adjustColorOpacity(color, opacity) },
      { offset: 1, color: adjustColorOpacity(color, 0.02) },
    ],
  };
}

/**
 * Adjusts the opacity of a hex color.
 */
export function adjustColorOpacity(hexColor: string, opacity: number): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ============================================================================
// Reference Line Helpers
// ============================================================================

/**
 * Creates ECharts markLine configuration from reference line configs.
 */
export function createMarkLines(
  lines: { value: number; label?: string; color?: string; lineStyle?: 'solid' | 'dashed' | 'dotted' }[],
  theme: PrismiqTheme
): Record<string, unknown> {
  return {
    silent: true,
    symbol: 'none',
    data: lines.map((line) => ({
      yAxis: line.value,
      label: {
        show: !!line.label,
        formatter: line.label || '',
        position: 'end',
        color: line.color || theme.colors.textMuted,
        fontSize: 11,
      },
      lineStyle: {
        color: line.color || theme.colors.textMuted,
        type: line.lineStyle || 'dashed',
        width: 1,
      },
    })),
  };
}

// ============================================================================
// Empty State Helpers
// ============================================================================

/**
 * Checks if chart data is empty.
 */
export function isChartDataEmpty(
  data: QueryResult | ChartDataPoint[]
): boolean {
  if (isQueryResult(data)) {
    return data.rows.length === 0;
  }
  return data.length === 0;
}

/**
 * Creates an ECharts graphic config for empty state.
 */
export function createEmptyStateGraphic(
  message: string = 'No data available'
): Record<string, unknown> {
  return {
    type: 'text',
    left: 'center',
    top: 'middle',
    style: {
      text: message,
      fontSize: 14,
      fill: '#9ca3af',
    },
  };
}
