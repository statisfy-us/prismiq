/**
 * PieChart component for Prismiq.
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
} from '../utils';
import type { PieChartProps, ChartClickParams } from '../types';

/**
 * A pie/donut chart component.
 *
 * @example
 * ```tsx
 * <PieChart
 *   data={queryResult}
 *   labelColumn="category"
 *   valueColumn="amount"
 *   variant="donut"
 *   showPercentage={true}
 *   showLabels={true}
 * />
 * ```
 */
export function PieChart({
  data,
  labelColumn,
  valueColumn,
  variant = 'pie',
  donutRatio = 0.5,
  showLabels = true,
  labelPosition = 'outside',
  showPercentage = false,
  showLegend = true,
  colors,
  startAngle = 90,
  sortSlices = 'none',
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
}: PieChartProps): JSX.Element {
  const { theme } = useTheme();

  // Transform data
  const chartData = useMemo(
    () => toChartData(data, labelColumn, [valueColumn]),
    [data, labelColumn, valueColumn]
  );

  // Get pie data from transformed data
  const pieData = useMemo(() => {
    if (chartData.series.length === 0) {
      return [];
    }

    const series = chartData.series[0];
    if (!series) {
      return [];
    }

    const items = chartData.categories.map((name, index) => ({
      name,
      value: series.data[index] ?? 0,
    }));

    // Sort if requested
    if (sortSlices === 'asc') {
      items.sort((a, b) => (a.value || 0) - (b.value || 0));
    } else if (sortSlices === 'desc') {
      items.sort((a, b) => (b.value || 0) - (a.value || 0));
    }

    return items;
  }, [chartData, sortSlices]);

  // Get colors
  const seriesColors = useMemo(
    () => colors || getChartColors(theme, pieData.length),
    [colors, theme, pieData.length]
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

    // Calculate total for percentages
    const total = pieData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Radius configuration
    const innerRadius = variant === 'donut' ? `${donutRatio * 50}%` : '0%';
    const outerRadius = labelPosition === 'outside' ? '60%' : '75%';

    // Label configuration
    const label = showLabels
      ? {
          show: true,
          position: labelPosition,
          formatter: (params: { name: string; value: number; percent: number }) => {
            if (showPercentage) {
              return labelPosition === 'inside'
                ? `${params.percent.toFixed(0)}%`
                : `${params.name}: ${params.percent.toFixed(1)}%`;
            }
            return labelPosition === 'inside'
              ? formatAxisLabel(params.value, 'compact')
              : `${params.name}: ${formatAxisLabel(params.value, 'compact')}`;
          },
          color: labelPosition === 'inside' ? '#ffffff' : theme.colors.text,
          fontSize: labelPosition === 'inside' ? 11 : 12,
        }
      : { show: false };

    // Label line for outside labels
    const labelLine = showLabels && labelPosition === 'outside'
      ? {
          show: true,
          length: 10,
          length2: 10,
          lineStyle: {
            color: theme.colors.border,
          },
        }
      : { show: false };

    // Legend config
    const legend = showLegend
      ? {
          show: true,
          orient: 'vertical' as const,
          right: 10,
          top: 'center',
          data: pieData.map((item) => item.name),
          formatter: (name: string) => {
            const item = pieData.find((d) => d.name === name);
            if (!item || total === 0) return name;
            const percent = ((item.value || 0) / total) * 100;
            return `${name} (${percent.toFixed(1)}%)`;
          },
        }
      : undefined;

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name: string; value: number; percent: number; marker: string }) => {
          const formatted = formatAxisLabel(params.value, 'number');
          return `${params.marker} ${params.name}<br/>Value: ${formatted}<br/>Percent: ${params.percent.toFixed(1)}%`;
        },
      },
      legend,
      series: [
        {
          type: 'pie',
          radius: [innerRadius, outerRadius],
          center: showLegend ? ['40%', '50%'] : ['50%', '50%'],
          startAngle,
          data: pieData.map((item, index) => ({
            ...item,
            itemStyle: {
              color: seriesColors[index] ?? theme.colors.primary,
            },
          })),
          label,
          labelLine,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          animationType: 'scale',
          animationEasing: 'elasticOut',
        },
      ],
    };
  }, [
    isEmpty,
    pieData,
    variant,
    donutRatio,
    showLabels,
    labelPosition,
    showPercentage,
    showLegend,
    startAngle,
    seriesColors,
    theme,
  ]);

  // Handle click events
  const handleEvents = useMemo(() => {
    if (!onDataPointClick) return undefined;

    return {
      click: (params: unknown) => {
        const p = params as { seriesName?: string; dataIndex?: number; value?: number; name?: string };
        const clickParams: ChartClickParams = {
          seriesName: p.seriesName ?? valueColumn,
          dataIndex: p.dataIndex ?? 0,
          value: p.value ?? 0,
          name: p.name ?? '',
        };
        onDataPointClick(clickParams);
      },
    };
  }, [onDataPointClick, valueColumn]);

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

export default PieChart;
