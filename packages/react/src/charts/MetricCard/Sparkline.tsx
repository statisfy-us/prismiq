/**
 * Sparkline component for MetricCard.
 */

import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { useTheme } from '../../theme';
import { createGradientColor } from '../utils';

// Register required ECharts components
echarts.use([LineChart, GridComponent, CanvasRenderer]);

export interface SparklineProps {
  /** Data points for the sparkline. */
  data: number[];
  /** Line/area color override. */
  color?: string;
  /** Height of the sparkline. */
  height?: number;
  /** Width of the sparkline. */
  width?: number | string;
}

/**
 * A minimal line chart for showing trends in a small space.
 */
export function Sparkline({
  data,
  color,
  height = 40,
  width = '100%',
}: SparklineProps): JSX.Element | null {
  const { theme } = useTheme();

  // Use first theme color if none provided
  const lineColor = color || theme.chart.colors[0] || theme.colors.primary;

  // Don't render if no data
  if (!data || data.length === 0) {
    return null;
  }

  const option: Record<string, unknown> = {
    animation: false,
    grid: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    xAxis: {
      type: 'category',
      show: false,
      data: data.map((_, i) => i),
    },
    yAxis: {
      type: 'value',
      show: false,
      min: 'dataMin',
      max: 'dataMax',
    },
    series: [
      {
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color: lineColor,
          width: 2,
        },
        areaStyle: {
          color: createGradientColor(lineColor, 0.3),
        },
      },
    ],
  };

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      style={{ width, height }}
      opts={{ renderer: 'canvas' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
}

export default Sparkline;
