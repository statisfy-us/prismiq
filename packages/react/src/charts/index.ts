/**
 * Charts module exports.
 */

// Base wrapper
export { EChartWrapper } from './EChartWrapper';

// Chart components
export { MetricCard, TrendIndicator, Sparkline } from './MetricCard';
export type { TrendIndicatorProps, SparklineProps } from './MetricCard';

export { BarChart } from './BarChart';
export { LineChart } from './LineChart';
export { AreaChart } from './AreaChart';
export { PieChart } from './PieChart';
export { ScatterChart } from './ScatterChart';

// Auto suggest
export { suggestChartType } from './autoSuggest';

// Chart types
export type {
  // Data types
  ChartDataPoint,
  ChartSeries,
  // Base props
  BaseChartProps,
  ChartClickParams,
  ReferenceLineConfig,
  AxisFormat,
  LegendPosition,
  EChartWrapperProps,
  // Chart-specific props
  BarChartProps,
  LineChartProps,
  AreaChartProps,
  PieChartProps,
  ScatterChartProps,
  // MetricCard
  TrendConfig,
  MetricCardProps,
  // Hook types
  ChartDataOptions,
  ChartDataResult,
  // Auto suggest
  ChartType,
  ChartSuggestion,
} from './types';

// Utilities
export {
  queryResultToChartData,
  dataPointsToChartData,
  isQueryResult,
  toChartData,
  createChartTheme,
  applyThemeToOption,
  formatAxisLabel,
  formatCompact,
  formatMetricValue,
  getChartColors,
  createGradientColor,
  adjustColorOpacity,
  createMarkLines,
  isChartDataEmpty,
  createEmptyStateGraphic,
} from './utils';
