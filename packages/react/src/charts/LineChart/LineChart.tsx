/**
 * LineChart component for Prismiq.
 */

import { useMemo } from 'react';
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
  smooth = false,
  showArea = false,
  showPoints = false,
  showDataLabels = false,
  showLegend = true,
  referenceLines,
  colors,
  xAxisLabel,
  yAxisLabel,
  yAxisFormat = 'number',
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
}: LineChartProps): JSX.Element {
  const { theme } = useTheme();

  // Convert yAxis to array if string
  const yColumns = useMemo(
    () => (Array.isArray(yAxis) ? yAxis : [yAxis]),
    [yAxis]
  );

  // Transform data
  const chartData = useMemo(
    () => toChartData(data, xAxis, yColumns),
    [data, xAxis, yColumns]
  );

  // Get colors
  const seriesColors = useMemo(
    () => colors || getChartColors(theme, yColumns.length),
    [colors, theme, yColumns.length]
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

    // Build series
    const series = chartData.series.map((s, index) => {
      const color = seriesColors[index] ?? theme.colors.primary;
      return {
        type: 'line',
        name: s.name,
        data: s.data,
        smooth: smooth ? 0.3 : false,
        symbol: showPoints ? 'circle' : 'none',
        symbolSize: showPoints ? 6 : 0,
        itemStyle: {
          color,
        },
        lineStyle: {
          color,
          width: 2,
        },
        areaStyle: showArea
          ? {
              color: createGradientColor(color, 0.3),
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
      };
    });

    // Legend config
    const legend = showLegend
      ? {
          show: yColumns.length > 1,
          data: chartData.series.map((s) => s.name),
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
        data: chartData.categories,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: {
          rotate: chartData.categories.length > 10 ? 45 : 0,
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
    yColumns.length,
  ]);

  // Handle click events
  const handleEvents = useMemo(() => {
    if (!onDataPointClick) return undefined;

    return {
      click: (params: unknown) => {
        const p = params as { seriesName?: string; dataIndex?: number; value?: number; name?: string };
        const clickParams: ChartClickParams = {
          seriesName: p.seriesName ?? '',
          dataIndex: p.dataIndex ?? 0,
          value: p.value ?? 0,
          name: p.name ?? '',
        };
        onDataPointClick(clickParams);
      },
    };
  }, [onDataPointClick]);

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
