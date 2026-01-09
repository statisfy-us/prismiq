/**
 * BarChart component for Prismiq.
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
} from '../utils';
import type { BarChartProps, ChartClickParams } from '../types';

/**
 * A bar chart component with support for vertical/horizontal orientation,
 * stacking, multi-series, and reference lines.
 *
 * @example
 * ```tsx
 * <BarChart
 *   data={queryResult}
 *   xAxis="month"
 *   yAxis={["revenue", "cost"]}
 *   orientation="vertical"
 *   stacked={false}
 *   showDataLabels={true}
 *   referenceLines={[{ value: 100000, label: "Target" }]}
 * />
 * ```
 */
export function BarChart({
  data,
  xAxis,
  yAxis,
  orientation = 'vertical',
  stacked = false,
  showDataLabels = false,
  showLegend = true,
  legendPosition = 'top',
  referenceLines,
  colors,
  xAxisLabel,
  yAxisLabel,
  yAxisFormat = 'number',
  currencySymbol = '$',
  compactNotation,
  decimalDigits = 0,
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
  crossFilter,
  selectedValue,
}: BarChartProps): JSX.Element {
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

    const isHorizontal = orientation === 'horizontal';

    // Category axis config
    const categoryAxis = {
      type: 'category',
      data: chartData.categories,
      name: isHorizontal ? yAxisLabel : xAxisLabel,
      nameLocation: 'middle',
      nameGap: 35,
      axisLabel: {
        rotate: isHorizontal ? 0 : chartData.categories.length > 10 ? 45 : 0,
        interval: 0,
        hideOverlap: true,
      },
    };

    // Value axis config
    const valueAxis = {
      type: 'value',
      name: isHorizontal ? xAxisLabel : yAxisLabel,
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: {
        formatter: (value: number) =>
          formatAxisLabel(value, yAxisFormat, {
            currencySymbol,
            decimals: decimalDigits,
            compactNotation,
          }),
      },
    };

    // Build series with cross-filter highlight support
    const series = chartData.series.map((s, index) => {
      const baseColor = seriesColors[index] ?? theme.colors.primary;

      return {
        type: 'bar',
        name: s.name,
        data: s.data.map((value, dataIndex) => {
          const categoryValue = chartData.categories[dataIndex];
          const isSelected = selectedValue != null && categoryValue === selectedValue;
          const isOther = selectedValue != null && categoryValue !== selectedValue;

          return {
            value,
            itemStyle: {
              color: baseColor,
              opacity: isOther ? 0.3 : 1,
              borderRadius: stacked ? 0 : [4, 4, 0, 0],
              // Highlight selected bar
              ...(isSelected && {
                borderColor: theme.colors.primary,
                borderWidth: 2,
              }),
            },
          };
        }),
        stack: stacked ? 'stack' : undefined,
        label: showDataLabels
          ? {
              show: true,
              position: isHorizontal ? 'right' : 'top',
              formatter: (params: { value: number | null | { value?: number } }) => {
                // Extract value (ECharts may wrap it in an object)
                const rawValue = typeof params.value === 'object' && params.value !== null
                  ? (params.value as { value?: number }).value
                  : params.value;

                return rawValue !== null && rawValue !== undefined
                  ? formatAxisLabel(rawValue, yAxisFormat, {
                      currencySymbol,
                      decimals: decimalDigits,
                      compactNotation,
                    })
                  : '';
              },
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
          selectedMode: 'multiple' as const,
          [legendPosition === 'left' || legendPosition === 'right'
            ? 'orient'
            : 'orient']: legendPosition === 'left' || legendPosition === 'right' ? 'vertical' : 'horizontal',
          [legendPosition]: legendPosition === 'left' || legendPosition === 'right' ? 10 : legendPosition === 'top' ? 10 : undefined,
          bottom: legendPosition === 'bottom' ? 10 : undefined,
        }
      : undefined;

    // Grid adjustments for legend position
    const grid = {
      left: legendPosition === 'left' ? 100 : 60,
      right: legendPosition === 'right' ? 100 : 20,
      top: legendPosition === 'top' ? 50 : 40,
      bottom: legendPosition === 'bottom' ? 50 : 40,
      containLabel: false,
    };

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: Array<{ seriesName: string; value: number | null | { value?: number }; marker: string; name: string }>) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const firstParam = params[0];
          if (!firstParam) return '';
          const header = `<div style="font-weight: 600; margin-bottom: 4px;">${firstParam.name}</div>`;
          const items = params
            .map(
              (p) => {
                // Extract value (ECharts may wrap it in an object)
                const rawValue = typeof p.value === 'object' && p.value !== null
                  ? (p.value as { value?: number }).value
                  : p.value;

                return `<div>${p.marker} ${p.seriesName}: ${
                  rawValue !== null && rawValue !== undefined
                    ? formatAxisLabel(rawValue, yAxisFormat, {
                        currencySymbol,
                        decimals: decimalDigits,
                        compactNotation,
                      })
                    : '-'
                }</div>`;
              }
            )
            .join('');
          return header + items;
        },
      },
      legend,
      grid,
      xAxis: isHorizontal ? valueAxis : categoryAxis,
      yAxis: isHorizontal ? categoryAxis : valueAxis,
      series,
    };
  }, [
    isEmpty,
    orientation,
    chartData,
    xAxisLabel,
    yAxisLabel,
    yAxisFormat,
    stacked,
    seriesColors,
    showDataLabels,
    showLegend,
    legendPosition,
    referenceLines,
    theme,
    yColumns.length,
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

export default BarChart;
