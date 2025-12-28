/**
 * AreaChart component for Prismiq.
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
  createGradientColor,
  adjustColorOpacity,
} from '../utils';
import type { AreaChartProps, ChartClickParams } from '../types';

/**
 * An area chart component with support for stacking and 100% stacking.
 *
 * @example
 * ```tsx
 * <AreaChart
 *   data={queryResult}
 *   xAxis="date"
 *   yAxis={["category_a", "category_b", "category_c"]}
 *   stacked={true}
 *   stackType="percent"
 *   smooth={true}
 * />
 * ```
 */
export function AreaChart({
  data,
  xAxis,
  yAxis,
  stacked = true,
  stackType = 'normal',
  smooth = false,
  showLegend = true,
  opacity = 0.7,
  colors,
  xAxisLabel,
  yAxisLabel,
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
}: AreaChartProps): JSX.Element {
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

    // Compute percentages if needed
    let processedData = chartData;
    if (stacked && stackType === 'percent') {
      // Calculate totals for each category
      const totals = chartData.categories.map((_, catIndex) => {
        let total = 0;
        chartData.series.forEach((s) => {
          const val = s.data[catIndex];
          if (val !== null && val !== undefined) {
            total += val;
          }
        });
        return total;
      });

      // Convert to percentages
      processedData = {
        categories: chartData.categories,
        series: chartData.series.map((s) => ({
          ...s,
          data: s.data.map((val, catIndex) => {
            if (val === null) return null;
            const total = totals[catIndex] ?? 1;
            return total > 0 ? (val / total) * 100 : 0;
          }),
        })),
      };
    }

    // Build series
    const series = processedData.series.map((s, index) => {
      const color = seriesColors[index] ?? theme.colors.primary;
      return {
        type: 'line',
        name: s.name,
        data: s.data,
        stack: stacked ? 'stack' : undefined,
        smooth: smooth ? 0.3 : false,
        symbol: 'none',
        itemStyle: {
          color,
        },
        lineStyle: {
          color,
          width: 1,
        },
        areaStyle: {
          color: stacked
            ? adjustColorOpacity(color, opacity)
            : createGradientColor(color, opacity),
        },
        emphasis: {
          focus: 'series',
        },
      };
    });

    // Legend config
    const legend = showLegend
      ? {
          show: yColumns.length > 1,
          data: processedData.series.map((s) => s.name),
          top: 10,
        }
      : undefined;

    // Y axis format
    const yAxisFormat = stacked && stackType === 'percent' ? 'percent' : 'number';

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
            .map((p) => {
              if (p.value === null) {
                return `<div>${p.marker} ${p.seriesName}: -</div>`;
              }
              const formatted =
                stackType === 'percent'
                  ? `${p.value.toFixed(1)}%`
                  : formatAxisLabel(p.value, 'compact');
              return `<div>${p.marker} ${p.seriesName}: ${formatted}</div>`;
            })
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
        data: processedData.categories,
        name: xAxisLabel,
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: {
          rotate: processedData.categories.length > 10 ? 45 : 0,
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
        max: stackType === 'percent' ? 100 : undefined,
        axisLabel: {
          formatter: (value: number) => {
            if (stackType === 'percent') {
              return `${value.toFixed(0)}%`;
            }
            return formatAxisLabel(value, yAxisFormat);
          },
        },
      },
      series,
    };
  }, [
    isEmpty,
    chartData,
    stacked,
    stackType,
    smooth,
    showLegend,
    opacity,
    seriesColors,
    xAxisLabel,
    yAxisLabel,
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

export default AreaChart;
