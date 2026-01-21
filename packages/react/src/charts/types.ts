/**
 * Chart type definitions for Prismiq.
 */

import type { QueryResult } from '../types';

// ============================================================================
// Data Types
// ============================================================================

/**
 * A single data point in a chart.
 */
export interface ChartDataPoint {
  [key: string]: string | number | null;
}

/**
 * A series of data for a chart.
 */
export interface ChartSeries {
  /** Series name (used in legend). */
  name: string;
  /** Data values for this series. */
  data: (number | null)[];
  /** Chart type for this series (for mixed charts). */
  type?: 'bar' | 'line' | 'scatter' | 'pie';
  /** Color override for this series. */
  color?: string;
}

// ============================================================================
// Base Props
// ============================================================================

/**
 * Cross-filter configuration for charts.
 */
export interface CrossFilterConfig {
  /** Enable cross-filtering on this chart. */
  enabled: boolean;
  /** Widget ID (required for cross-filtering). */
  widgetId: string;
  /** Column to filter on (defaults to xAxis). */
  column?: string;
  /** Table for the filter (optional). */
  table?: string;
}

/**
 * Base props shared by all chart components.
 */
export interface BaseChartProps {
  /** Chart data - either QueryResult or array of data points. */
  data: QueryResult | ChartDataPoint[];
  /** Whether the chart is loading. */
  loading?: boolean;
  /** Error to display. */
  error?: Error | null;
  /** Chart height. */
  height?: number | string;
  /** Chart width. */
  width?: number | string;
  /** Additional CSS class name. */
  className?: string;
  /** Callback when a data point is clicked. */
  onDataPointClick?: (params: ChartClickParams) => void;
  /** Cross-filter configuration. */
  crossFilter?: CrossFilterConfig;
  /** Currently selected value for cross-filter highlight. */
  selectedValue?: string | number | null;
}

/**
 * Parameters passed to data point click handler.
 */
export interface ChartClickParams {
  /** Name of the series that was clicked. */
  seriesName: string;
  /** Index of the data point in the series. */
  dataIndex: number;
  /** Value of the clicked data point. */
  value: number | string;
  /** Category/label name of the clicked point. */
  name: string;
}

// ============================================================================
// Reference Lines
// ============================================================================

/**
 * Configuration for a reference line on a chart.
 */
export interface ReferenceLineConfig {
  /** Value where the line should be drawn. */
  value: number;
  /** Label to display on the line. */
  label?: string;
  /** Line color. */
  color?: string;
  /** Line style. */
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

// ============================================================================
// Axis Configuration
// ============================================================================

/**
 * Axis format types for value formatting.
 */
export type AxisFormat = 'number' | 'currency' | 'percent' | 'compact';

/**
 * Legend position options.
 */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

// ============================================================================
// EChart Wrapper Props
// ============================================================================

/**
 * Props for the base EChart wrapper component.
 */
export interface EChartWrapperProps {
  /** ECharts option configuration. */
  option: Record<string, unknown>;
  /** Whether the chart is loading. */
  loading?: boolean;
  /** Chart height. */
  height?: number | string;
  /** Chart width. */
  width?: number | string;
  /** Theme mode. */
  theme?: 'light' | 'dark';
  /** Event handlers - use unknown for params to allow any ECharts event. */
  onEvents?: Record<string, (params: unknown) => void>;
  /** Additional CSS class name. */
  className?: string;
}

// ============================================================================
// Chart-Specific Props
// ============================================================================

/**
 * Props for BarChart component.
 */
export interface BarChartProps extends BaseChartProps {
  /** Column name for X axis categories. */
  xAxis: string;
  /** Column name(s) for Y axis values. */
  yAxis: string | string[];
  /** Bar orientation. */
  orientation?: 'vertical' | 'horizontal';
  /** Whether to stack bars. */
  stacked?: boolean;
  /** Whether to show data labels on bars. */
  showDataLabels?: boolean;
  /** Whether to show legend. */
  showLegend?: boolean;
  /** Legend position. */
  legendPosition?: LegendPosition;
  /** Reference lines to draw. */
  referenceLines?: ReferenceLineConfig[];
  /** Custom colors for series. */
  colors?: string[];
  /** X axis label. */
  xAxisLabel?: string;
  /** Y axis label. */
  yAxisLabel?: string;
  /** X axis date format (.NET format string like "MMM-yyyy" for date axes). */
  xAxisFormat?: string;
  /** Y axis value format. */
  yAxisFormat?: AxisFormat;
  /** Currency symbol for currency format. */
  currencySymbol?: string;
  /** Compact notation mode (K, M, B, T) or null for no compacting. */
  compactNotation?: 'K' | 'M' | 'B' | 'T' | null;
  /** Number of decimal digits. */
  decimalDigits?: number;
}

/**
 * Props for LineChart component.
 */
export interface LineChartProps extends BaseChartProps {
  /** Column name for X axis categories. */
  xAxis: string;
  /** Column name(s) for Y axis values. */
  yAxis: string | string[];
  /** Column name that defines series (for multi-series charts with long-format data). */
  seriesColumn?: string;
  /** Maximum number of series to display (top N by total value). Useful for charts with many series. */
  maxSeries?: number;
  /** Whether to use smooth/curved lines. */
  smooth?: boolean;
  /** Whether to show area fill under lines. */
  showArea?: boolean;
  /** Whether to show data point markers. */
  showPoints?: boolean;
  /** Whether to show data labels. */
  showDataLabels?: boolean;
  /** Whether to show legend. */
  showLegend?: boolean;
  /** Reference lines to draw. */
  referenceLines?: ReferenceLineConfig[];
  /** Custom colors for series. */
  colors?: string[];
  /** X axis label. */
  xAxisLabel?: string;
  /** Y axis label. */
  yAxisLabel?: string;
  /** X axis date format (.NET format string like "MMM-yyyy" for date axes). */
  xAxisFormat?: string;
  /** Y axis value format. */
  yAxisFormat?: AxisFormat;
}

/**
 * Props for AreaChart component.
 */
export interface AreaChartProps extends BaseChartProps {
  /** Column name for X axis categories. */
  xAxis: string;
  /** Column name(s) for Y axis values. */
  yAxis: string | string[];
  /** Whether to stack areas. */
  stacked?: boolean;
  /** Stack type - normal sum or 100% stacked. */
  stackType?: 'normal' | 'percent';
  /** Whether to use smooth/curved lines. */
  smooth?: boolean;
  /** Whether to show legend. */
  showLegend?: boolean;
  /** Area opacity (0-1). */
  opacity?: number;
  /** Custom colors for series. */
  colors?: string[];
  /** X axis label. */
  xAxisLabel?: string;
  /** Y axis label. */
  yAxisLabel?: string;
  /** X axis date format (.NET format string like "MMM-yyyy" for date axes). */
  xAxisFormat?: string;
}

/**
 * Props for PieChart component.
 */
export interface PieChartProps extends BaseChartProps {
  /** Column name for slice labels. */
  labelColumn: string;
  /** Column name for slice values. */
  valueColumn: string;
  /** Chart variant. */
  variant?: 'pie' | 'donut';
  /** Inner radius ratio for donut (0-1). */
  donutRatio?: number;
  /** Whether to show labels. */
  showLabels?: boolean;
  /** Label position. */
  labelPosition?: 'inside' | 'outside';
  /** Whether to show percentages in labels. */
  showPercentage?: boolean;
  /** Whether to show legend. */
  showLegend?: boolean;
  /** Custom colors for slices. */
  colors?: string[];
  /** Start angle in degrees. */
  startAngle?: number;
  /** How to sort slices. */
  sortSlices?: 'asc' | 'desc' | 'none';
  /** Label format (.NET format string like "MMM-yyyy" for date labels). */
  labelFormat?: string;
}

/**
 * Props for ScatterChart component.
 */
export interface ScatterChartProps extends BaseChartProps {
  /** Column name for X axis values. */
  xAxis: string;
  /** Column name for Y axis values. */
  yAxis: string;
  /** Column name for bubble size (makes it a bubble chart). */
  sizeColumn?: string;
  /** Column name for color coding points. */
  colorColumn?: string;
  /** Minimum point size. */
  minSize?: number;
  /** Maximum point size. */
  maxSize?: number;
  /** Whether to show labels on points. */
  showLabels?: boolean;
  /** Column to use for point labels. */
  labelColumn?: string;
  /** Whether to show a trendline. */
  showTrendline?: boolean;
  /** X axis label. */
  xAxisLabel?: string;
  /** Y axis label. */
  yAxisLabel?: string;
}

// ============================================================================
// MetricCard Props
// ============================================================================

/**
 * Trend indicator configuration.
 */
export interface TrendConfig {
  /** Percent change value. */
  value: number;
  /** Trend direction. */
  direction: 'up' | 'down' | 'flat';
  /** Label for the trend (e.g., "vs last month"). */
  label?: string;
}

/**
 * Props for MetricCard component.
 */
export interface MetricCardProps {
  /** Metric title/label. */
  title: string;
  /** Metric value. */
  value: number | string;
  /** Value format. */
  format?: 'number' | 'currency' | 'percent' | 'compact';
  /** Currency symbol for currency format. */
  currencySymbol?: string;
  /** Number of decimal places. */
  decimals?: number;
  /** Compact notation (K, M, B, T) - works with currency format for values like $24.32M. */
  compactNotation?: 'K' | 'M' | 'B' | 'T' | null;
  /** Trend configuration. */
  trend?: TrendConfig;
  /** Which direction is considered positive (green). */
  trendPositive?: 'up' | 'down';
  /** Data for sparkline chart. */
  sparklineData?: number[];
  /** Sparkline color override. */
  sparklineColor?: string;
  /** Card size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the card is loading. */
  loading?: boolean;
  /** Whether to center the value (for single-number displays). */
  centered?: boolean;
  /** Additional CSS class name. */
  className?: string;
  /** Click handler. */
  onClick?: () => void;
}

// ============================================================================
// Chart Data Hook Types
// ============================================================================

/**
 * Options for useChartData hook.
 */
export interface ChartDataOptions {
  /** Column to use for X axis / categories. */
  xColumn: string;
  /** Column(s) to use for Y axis values. */
  yColumns: string[];
  /** Column to group by for multi-series. */
  groupColumn?: string;
  /** How to sort the data. */
  sortBy?: 'x' | 'y' | 'none';
  /** Sort direction. */
  sortDirection?: 'asc' | 'desc';
  /** Maximum number of data points. */
  limit?: number;
}

/**
 * Result from useChartData hook.
 */
export interface ChartDataResult {
  /** Category labels for X axis. */
  categories: string[];
  /** Series data for charting. */
  series: ChartSeries[];
  /** Whether the data is empty. */
  isEmpty: boolean;
  /** Total number of rows in source data. */
  totalRows: number;
}

// ============================================================================
// Auto Suggest Types
// ============================================================================

/**
 * Available chart types.
 */
export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'metric';

/**
 * A chart type suggestion.
 */
export interface ChartSuggestion {
  /** Suggested chart type. */
  type: ChartType;
  /** Confidence score (0-1). */
  confidence: number;
  /** Human-readable reason for the suggestion. */
  reason: string;
  /** Suggested configuration for the chart. */
  config: Record<string, unknown>;
}
