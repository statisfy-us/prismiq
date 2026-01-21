/**
 * LineChart component for Prismiq.
 */

import { useMemo, useCallback } from 'react';
import { useTheme } from '../../theme';
import { EChartWrapper } from '../EChartWrapper';
import {
  toChartData,
  isChartDataEmpty,
  createEmptyStateGraphic,
  formatAxisLabel,
  getChartColors,
  createMarkLines,
  createGradientColor,
} from '../utils';
import { createDateFormatter } from '../../utils';
import type { LineChartProps, ChartClickParams } from '../types';

/**
 * A line chart component with support for smooth curves, area fill,
 * multi-series, and reference lines.
 *
 * @example
 * ```tsx
 * <LineChart
 *   data={queryResult}
 *   xAxis="date"
 *   yAxis={["revenue", "cost"]}
 *   smooth={true}
 *   showArea={true}
 *   showPoints={true}
 * />
 * ```
 */
export function LineChart({
  data,
  xAxis,
  yAxis,
  seriesColumn,
  maxSeries,
  smooth = false,
  showArea = false,
  showPoints = false,
  showDataLabels = false,
  showLegend = true,
  referenceLines,
  colors,
  xAxisLabel,
  yAxisLabel,
  xAxisFormat,
  yAxisFormat = 'number',
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
  crossFilter,
  selectedValue,
}: LineChartProps): JSX.Element {
  const { theme } = useTheme();

  // Convert yAxis to array if string
  const yColumns = useMemo(
    () => (Array.isArray(yAxis) ? yAxis : [yAxis]),
    [yAxis]
  );

  // Transform data
  const rawChartData = useMemo(
    () => toChartData(data, xAxis, yColumns, seriesColumn),
    [data, xAxis, yColumns, seriesColumn]
  );

  // Limit series to top N by total value if maxSeries is specified
  const chartData = useMemo(() => {
    if (!maxSeries || rawChartData.series.length <= maxSeries) {
      return rawChartData;
    }

    // Calculate total value for each series
    const seriesWithTotals = rawChartData.series.map((s) => ({
      ...s,
      total: s.data.reduce<number>((sum, val) => sum + (val ?? 0), 0),
    }));

    // Sort by total descending and take top N
    const topSeries = seriesWithTotals
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, maxSeries)
      .map(({ total: _total, ...rest }) => rest);

    return {
      categories: rawChartData.categories,
      series: topSeries,
    };
  }, [rawChartData, maxSeries]);

  // Create date formatter if xAxisFormat is provided
  const dateFormatter = useMemo(
    () => (xAxisFormat ? createDateFormatter(xAxisFormat) : null),
    [xAxisFormat]
  );

  // Format categories if date formatter is available
  const formattedCategories = useMemo(() => {
    if (!dateFormatter) {
      return chartData.categories;
    }
    return chartData.categories.map((cat) => dateFormatter(cat));
  }, [chartData.categories, dateFormatter]);

  // Get colors - use actual series count (may be more than yColumns if seriesColumn is used)
  const seriesColors = useMemo(
    () => colors || getChartColors(theme, chartData.series.length),
    [colors, theme, chartData.series.length]
  );

  // Check for empty data
  const isEmpty = isChartDataEmpty(data);

  // Build ECharts option
  const option = useMemo(() => {
    if (isEmpty) {
      return {
        graphic: createEmptyStateGraphic(),
      };
    }

    // Build series with cross-filter support
    const series = chartData.series.map((s, index) => {
      const color = seriesColors[index] ?? theme.colors.primary;

      // Build data with cross-filter highlighting for points
      const seriesData = s.data.map((value, dataIndex) => {
        const categoryValue = chartData.categories[dataIndex];
        const isSelected = selectedValue != null && categoryValue === selectedValue;
        const isOther = selectedValue != null && categoryValue !== selectedValue;

        return {
          value,
          itemStyle: {
            color,
            opacity: isOther ? 0.3 : 1,
            // Highlight selected point
            ...(isSelected && {
              borderColor: theme.colors.primary,
              borderWidth: 3,
            }),
          },
          symbolSize: isSelected ? 10 : showPoints ? 6 : 0,
        };
      });

      return {
        type: 'line',
        name: s.name,
        data: seriesData,
        smooth: smooth ? 0.3 : false,
        symbol: showPoints || selectedValue != null ? 'circle' : 'none',
        symbolSize: showPoints ? 6 : 0,
        itemStyle: {
          color,
        },
        lineStyle: {
          color,
          width: 2,
          opacity: selectedValue != null ? 0.5 : 1,
        },
        areaStyle: showArea
          ? {
              color: createGradientColor(color, selectedValue != null ? 0.15 : 0.3),
            }
          : undefined,
        label: showDataLabels
          ? {
              show: true,
              position: 'top',
              formatter: (params: { value: number | null }) =>
                params.value !== null
                  ? formatAxisLabel(params.value, yAxisFormat)
                  : '',
              fontSize: 10,
              color: theme.colors.textMuted,
            }
          : undefined,
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        markLine:
          index === 0 && referenceLines
            ? createMarkLines(referenceLines, theme)
            : undefined,
        // Enable cursor pointer when cross-filter is enabled
        cursor: crossFilter?.enabled ? 'pointer' : 'default',
      };
    });

    // Legend config - show when multiple series exist (from yColumns or seriesColumn)
    const legend = showLegend
      ? {
          show: chartData.series.length > 1,
          data: chartData.series.map((s) => s.name),
          selectedMode: 'multiple' as const,
          top: 10,
        }
      : undefined;

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: theme.chart.tooltipBackground,
          },
        },
        formatter: (params: Array<{ seriesName: string; value: number | null; marker: string; name: string }>) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const firstParam = params[0];
          if (!firstParam) return '';
          const header = `<div style="font-weight: 600; margin-bottom: 4px;">${firstParam.name}</div>`;
          const items = params
            .map(
              (p) =>
                `<div>${p.marker} ${p.seriesName}: ${p.value !== null ? formatAxisLabel(p.value, yAxisFormat) : '-'}</div>`
            )
            .join('');
          return header + items;
        },
      },
      legend,
      grid: {
        left: 60,
        right: 20,
        top: legend ? 50 : 40,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: formattedCategories,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: {
          rotate: formattedCategories.length > 10 ? 45 : 0,
          interval: 0,
          hideOverlap: true,
        },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel,
        nameLocation: 'middle',
        nameGap: 50,
        axisLabel: {
          formatter: (value: number) => formatAxisLabel(value, yAxisFormat),
        },
      },
      series,
    };
  }, [
    isEmpty,
    chartData,
    formattedCategories,
    smooth,
    showPoints,
    showArea,
    showDataLabels,
    showLegend,
    referenceLines,
    seriesColors,
    xAxisLabel,
    yAxisLabel,
    yAxisFormat,
    theme,
    selectedValue,
    crossFilter?.enabled,
  ]);

  // Handle click events (both cross-filter and custom handler)
  const handleClick = useCallback(
    (params: unknown) => {
      const p = params as {
        seriesName?: string;
        dataIndex?: number;
        value?: number | { value?: number };
        name?: string;
      };

      // Extract value (ECharts may wrap it in an object)
      const rawValue = typeof p.value === 'object' ? p.value?.value : p.value;

      const clickParams: ChartClickParams = {
        seriesName: p.seriesName ?? '',
        dataIndex: p.dataIndex ?? 0,
        value: rawValue ?? 0,
        name: p.name ?? '',
      };

      // Call custom handler if provided
      onDataPointClick?.(clickParams);
    },
    [onDataPointClick]
  );

  // Build events object
  const handleEvents = useMemo(() => {
    if (!onDataPointClick && !crossFilter?.enabled) return undefined;

    return {
      click: handleClick,
    };
  }, [onDataPointClick, crossFilter?.enabled, handleClick]);

  // Handle error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          width: typeof width === 'number' ? `${width}px` : width,
          color: theme.colors.error,
          fontSize: theme.fontSizes.sm,
        }}
        className={className}
      >
        Error loading chart: {error.message}
      </div>
    );
  }

  return (
    <EChartWrapper
      option={option}
      loading={loading}
      height={height}
      width={width}
      className={className}
      onEvents={handleEvents}
    />
  );
}

export default LineChart;
