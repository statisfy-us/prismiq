/**
 * ScatterChart component for Prismiq.
 */

import { useMemo } from 'react';
import { useTheme } from '../../theme';
import { EChartWrapper } from '../EChartWrapper';
import {
  isQueryResult,
  isChartDataEmpty,
  createEmptyStateGraphic,
  formatAxisLabel,
  getChartColors,
} from '../utils';
import type { ScatterChartProps, ChartClickParams, ChartDataPoint } from '../types';
import type { QueryResult } from '../../types';

/**
 * Extracts scatter data from QueryResult or ChartDataPoint array.
 */
function extractScatterData(
  data: QueryResult | ChartDataPoint[],
  xColumn: string,
  yColumn: string,
  sizeColumn?: string,
  colorColumn?: string,
  labelColumn?: string
): {
  points: Array<{
    x: number;
    y: number;
    size?: number;
    color?: string;
    label?: string;
    index: number;
  }>;
  colorCategories: string[];
} {
  const points: Array<{
    x: number;
    y: number;
    size?: number;
    color?: string;
    label?: string;
    index: number;
  }> = [];
  const colorSet = new Set<string>();

  if (isQueryResult(data)) {
    const xIndex = data.columns.indexOf(xColumn);
    const yIndex = data.columns.indexOf(yColumn);
    const sizeIndex = sizeColumn ? data.columns.indexOf(sizeColumn) : -1;
    const colorIndex = colorColumn ? data.columns.indexOf(colorColumn) : -1;
    const labelIndex = labelColumn ? data.columns.indexOf(labelColumn) : -1;

    if (xIndex === -1 || yIndex === -1) {
      return { points: [], colorCategories: [] };
    }

    data.rows.forEach((row, index) => {
      const x = row[xIndex];
      const y = row[yIndex];

      if (x !== null && y !== null) {
        const size = sizeIndex >= 0 ? row[sizeIndex] : undefined;
        const color = colorIndex >= 0 ? String(row[colorIndex]) : undefined;
        const label = labelIndex >= 0 ? String(row[labelIndex]) : undefined;

        if (color) colorSet.add(color);

        points.push({
          x: typeof x === 'number' ? x : Number(x),
          y: typeof y === 'number' ? y : Number(y),
          size: size !== null && size !== undefined ? Number(size) : undefined,
          color,
          label,
          index,
        });
      }
    });
  } else {
    data.forEach((point, index) => {
      const x = point[xColumn];
      const y = point[yColumn];

      if (x !== null && x !== undefined && y !== null && y !== undefined) {
        const size = sizeColumn ? point[sizeColumn] : undefined;
        const color = colorColumn ? String(point[colorColumn]) : undefined;
        const label = labelColumn ? String(point[labelColumn]) : undefined;

        if (color) colorSet.add(color);

        points.push({
          x: typeof x === 'number' ? x : Number(x),
          y: typeof y === 'number' ? y : Number(y),
          size: size !== null && size !== undefined ? Number(size) : undefined,
          color,
          label,
          index,
        });
      }
    });
  }

  return { points, colorCategories: Array.from(colorSet) };
}

/**
 * Calculates linear regression for trendline.
 */
function calculateTrendline(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number; minX: number; maxX: number } | null {
  if (points.length < 2) return null;

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let minX = Infinity;
  let maxX = -Infinity;

  points.forEach((p) => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  });

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, minX, maxX };
}

/**
 * A scatter/bubble chart component.
 *
 * @example
 * ```tsx
 * <ScatterChart
 *   data={queryResult}
 *   xAxis="revenue"
 *   yAxis="profit"
 *   sizeColumn="market_cap"
 *   colorColumn="sector"
 *   showTrendline={true}
 * />
 * ```
 */
export function ScatterChart({
  data,
  xAxis,
  yAxis,
  sizeColumn,
  colorColumn,
  minSize = 10,
  maxSize = 50,
  showLabels = false,
  labelColumn,
  showTrendline = false,
  xAxisLabel,
  yAxisLabel,
  loading = false,
  error,
  height = 300,
  width = '100%',
  className,
  onDataPointClick,
}: ScatterChartProps): JSX.Element {
  const { theme } = useTheme();

  // Extract scatter data
  const { points, colorCategories } = useMemo(
    () => extractScatterData(data, xAxis, yAxis, sizeColumn, colorColumn, labelColumn),
    [data, xAxis, yAxis, sizeColumn, colorColumn, labelColumn]
  );

  // Get colors for categories
  const categoryColors = useMemo(
    () => getChartColors(theme, Math.max(colorCategories.length, 1)),
    [theme, colorCategories.length]
  );

  // Check for empty data
  const isEmpty = isChartDataEmpty(data) || points.length === 0;

  // Build ECharts option
  const option = useMemo(() => {
    if (isEmpty) {
      return {
        graphic: createEmptyStateGraphic(),
      };
    }

    // Compute size scale if bubble chart
    let sizeScale: (val: number) => number = () => minSize;
    if (sizeColumn) {
      const sizes = points
        .map((p) => p.size)
        .filter((s): s is number => s !== undefined);
      if (sizes.length > 0) {
        const minSizeVal = Math.min(...sizes);
        const maxSizeVal = Math.max(...sizes);
        const sizeRange = maxSizeVal - minSizeVal || 1;

        sizeScale = (val: number) => {
          const normalized = (val - minSizeVal) / sizeRange;
          return minSize + normalized * (maxSize - minSize);
        };
      }
    }

    // Group points by color category
    const seriesMap = new Map<string, Array<[number, number, number, string?, string?]>>();

    if (colorColumn && colorCategories.length > 0) {
      colorCategories.forEach((cat) => {
        seriesMap.set(cat, []);
      });

      points.forEach((p) => {
        const cat = p.color || 'default';
        const arr = seriesMap.get(cat);
        if (arr) {
          arr.push([
            p.x,
            p.y,
            p.size !== undefined ? sizeScale(p.size) : minSize,
            p.label,
            String(p.index),
          ]);
        }
      });
    } else {
      // Single series
      seriesMap.set('data', points.map((p) => [
        p.x,
        p.y,
        p.size !== undefined ? sizeScale(p.size) : minSize,
        p.label,
        String(p.index),
      ]));
    }

    // Build series
    const series: Array<Record<string, unknown>> = Array.from(seriesMap.entries()).map(
      ([name, seriesData], index) => ({
        type: 'scatter',
        name,
        data: seriesData,
        symbolSize: (dataItem: [number, number, number]) => dataItem[2],
        itemStyle: {
          color: categoryColors[index] ?? theme.colors.primary,
        },
        label: showLabels
          ? {
              show: true,
              position: 'top',
              formatter: (params: { data: [number, number, number, string?] }) =>
                params.data[3] || '',
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
      })
    );

    // Add trendline if requested
    if (showTrendline) {
      const trend = calculateTrendline(points);
      if (trend) {
        const y1 = trend.slope * trend.minX + trend.intercept;
        const y2 = trend.slope * trend.maxX + trend.intercept;

        series.push({
          type: 'line',
          name: 'Trendline',
          data: [
            [trend.minX, y1],
            [trend.maxX, y2],
          ],
          symbol: 'none',
          lineStyle: {
            color: theme.colors.textMuted,
            type: 'dashed',
            width: 2,
          },
          silent: true,
        });
      }
    }

    // Legend config
    const legend = colorColumn && colorCategories.length > 1
      ? {
          show: true,
          data: colorCategories,
          top: 10,
        }
      : undefined;

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: {
          seriesName: string;
          data: [number, number, number, string?, string?];
          marker: string;
        }) => {
          if (!params.data) return '';
          const [x, y, , label] = params.data;
          let html = `${params.marker}`;
          if (colorColumn) {
            html += ` ${params.seriesName}<br/>`;
          }
          if (label) {
            html += `${label}<br/>`;
          }
          html += `${xAxis}: ${formatAxisLabel(x, 'number')}<br/>`;
          html += `${yAxis}: ${formatAxisLabel(y, 'number')}`;
          return html;
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
        type: 'value',
        name: xAxisLabel || xAxis,
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: {
          formatter: (value: number) => formatAxisLabel(value, 'compact'),
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: yAxisLabel || yAxis,
        nameLocation: 'middle',
        nameGap: 50,
        axisLabel: {
          formatter: (value: number) => formatAxisLabel(value, 'compact'),
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      series,
    };
  }, [
    isEmpty,
    points,
    colorColumn,
    colorCategories,
    categoryColors,
    sizeColumn,
    minSize,
    maxSize,
    showLabels,
    showTrendline,
    xAxis,
    yAxis,
    xAxisLabel,
    yAxisLabel,
    theme,
  ]);

  // Handle click events
  const handleEvents = useMemo(() => {
    if (!onDataPointClick) return undefined;

    return {
      click: (params: unknown) => {
        const p = params as { seriesName?: string; dataIndex?: number; data?: [number, number, number, string?, string?] };
        if (!p.data) return;
        const [x, y, , , indexStr] = p.data;
        const clickParams: ChartClickParams = {
          seriesName: p.seriesName ?? '',
          dataIndex: indexStr ? parseInt(indexStr, 10) : (p.dataIndex ?? 0),
          value: y,
          name: String(x),
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

export default ScatterChart;
