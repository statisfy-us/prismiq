/**
 * Base wrapper component for ECharts integration.
 */

import React, { useCallback, useRef } from 'react';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { useTheme } from '../theme';
import { applyThemeToOption } from './utils';
import type { EChartWrapperProps } from './types';

// Register required ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

/**
 * Base chart wrapper that handles theme integration, loading states,
 * and event handling for all Prismiq charts.
 */
export function EChartWrapper({
  option,
  loading = false,
  height = 300,
  width = '100%',
  theme: themeOverride,
  onEvents,
  className,
}: EChartWrapperProps): JSX.Element {
  const { theme, resolvedMode } = useTheme();
  const chartRef = useRef<ReactEChartsCore>(null);

  // Apply Prismiq theme to the chart option
  const themedOption = applyThemeToOption(option, theme);

  // Determine which theme to use
  const effectiveTheme = themeOverride || resolvedMode;

  // Handle resize
  const handleResize = useCallback(() => {
    if (chartRef.current) {
      const chartInstance = chartRef.current.getEchartsInstance();
      chartInstance?.resize();
    }
  }, []);

  // Container styles
  const containerStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    position: 'relative',
  };

  // Loading overlay styles
  const loadingStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    opacity: 0.9,
    zIndex: 10,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'prismiq-spin 0.8s linear infinite',
  };

  return (
    <div style={containerStyle} className={className}>
      {/* Spinner keyframes */}
      <style>{`
        @keyframes prismiq-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Loading overlay */}
      {loading && (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
        </div>
      )}

      {/* ECharts instance */}
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={themedOption}
        notMerge={true}
        lazyUpdate={true}
        theme={effectiveTheme === 'dark' ? 'dark' : undefined}
        onEvents={onEvents}
        style={{ width: '100%', height: '100%' }}
        opts={{ renderer: 'canvas' }}
        onChartReady={handleResize}
      />
    </div>
  );
}

export default EChartWrapper;
