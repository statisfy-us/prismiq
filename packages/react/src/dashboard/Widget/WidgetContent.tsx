/**
 * Widget content renderer that displays the appropriate chart or component.
 */

import { useMemo, useCallback } from 'react';
import { useTheme } from '../../theme';
import {
  MetricCard,
  BarChart,
  LineChart,
  AreaChart,
  PieChart,
  ScatterChart,
} from '../../charts';
import { ResultsTable } from '../../components';
import { useCrossFilterOptional } from '../../context';
import { createDateFormatters, pivotQueryResult, parseMarkdownSafe } from '../../utils';
import type { Widget, WidgetConfig } from '../types';
import type { QueryResult } from '../../types';
import type { ChartDataPoint, ChartClickParams, CrossFilterConfig } from '../../charts/types';

/**
 * Props for WidgetContent.
 */
export interface WidgetContentProps {
  /** Widget to render. */
  widget: Widget;
  /** Query result data. */
  result: QueryResult | null;
  /** Whether data is loading. */
  isLoading?: boolean;
  /** Error if query failed. */
  error?: Error | null;
  /** Whether widget is being force-refreshed (shows spinner overlay). */
  isRefreshing?: boolean;
}

/**
 * Render text/markdown content.
 */
function TextContent({ config }: { config: WidgetConfig }): JSX.Element {
  const { theme } = useTheme();

  // Map alignment config to CSS text-align
  const textAlignMap: Record<string, React.CSSProperties['textAlign']> = {
    Left: 'left',
    Center: 'center',
    Right: 'right',
  };
  const textAlign = textAlignMap[config.alignment as string] ?? 'left';

  // Map fontSize config to theme font sizes
  const fontSizeMap: Record<string, string> = {
    Small: theme.fontSizes.sm,
    Normal: theme.fontSizes.base,
    Large: theme.fontSizes.lg,
    XLarge: theme.fontSizes.xl,
  };
  const fontSize = fontSizeMap[config.fontSize as string] ?? theme.fontSizes.base;

  const contentStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    fontSize,
    color: theme.colors.text,
    lineHeight: 1.6,
    textAlign,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
  };

  // If no text content, render nothing (title is shown in widget header)
  if (!config.content) {
    return <></>;
  }

  // Render markdown if enabled
  if (config.markdown) {
    const codeStyle = `background: ${theme.colors.surface}; padding: 0.1em 0.3em; border-radius: 3px; font-family: ${theme.fonts.mono};`;
    return (
      <div
        style={contentStyle}
        dangerouslySetInnerHTML={{ __html: parseMarkdownSafe(config.content, codeStyle) }}
      />
    );
  }

  // Plain text with line breaks
  return (
    <div style={contentStyle}>
      {config.content.split('\n').map((line, i) => (
        <p key={i} style={{ margin: `${theme.spacing.xs} 0` }}>
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * Render loading state.
 */
function LoadingState(): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '100px',
    color: theme.colors.textMuted,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'prismiq-widget-spin 1s linear infinite',
  };

  return (
    <div style={containerStyle}>
      <div style={spinnerStyle} />
      <style>{`
        @keyframes prismiq-widget-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Render error state.
 */
function ErrorState({ error }: { error: Error }): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '100px',
    padding: theme.spacing.md,
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '24px',
    marginBottom: theme.spacing.sm,
    color: theme.colors.error,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.error,
  };

  return (
    <div style={containerStyle}>
      <div style={iconStyle}>!</div>
      <div style={messageStyle}>{error.message}</div>
    </div>
  );
}

/**
 * Render empty state.
 */
function EmptyState(): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '100px',
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
  };

  return <div style={containerStyle}>No data</div>;
}

/**
 * Convert QueryResult to ChartDataPoint array.
 */
function resultToDataPoints(result: QueryResult): ChartDataPoint[] {
  return result.rows.map((row) => {
    const record: ChartDataPoint = {};
    result.columns.forEach((col, i) => {
      const value = row[i];
      // Only include string, number, or null values
      if (typeof value === 'string' || typeof value === 'number' || value === null) {
        record[col] = value;
      } else if (value !== undefined) {
        record[col] = String(value);
      }
    });
    return record;
  });
}

/**
 * Spinner overlay shown during loading/refresh.
 * Uses theme-aware colors for proper dark/light mode support.
 */
function RefreshOverlay(): JSX.Element {
  const { theme } = useTheme();

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Use theme surface color with opacity for theme-aware overlay
    backgroundColor: `${theme.colors.surface}e6`, // e6 = ~90% opacity in hex
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  };

  const spinnerStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'prismiq-widget-spin 1s linear infinite',
  };

  return (
    <div style={overlayStyle}>
      <div style={spinnerStyle} />
      <style>{`
        @keyframes prismiq-widget-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Widget content renderer.
 *
 * Renders the appropriate visualization based on widget type.
 */
export function WidgetContent({
  widget,
  result,
  isLoading = false,
  error,
  isRefreshing = false,
}: WidgetContentProps): JSX.Element {
  const { theme } = useTheme();

  // Get cross-filter context (may be null if not wrapped in CrossFilterProvider)
  const crossFilterContext = useCrossFilterOptional();

  // Convert result rows to chart data format - must be called unconditionally (Rules of Hooks)
  const data = useMemo(() => (result ? resultToDataPoints(result) : []), [result]);

  // Determine if cross-filtering is enabled for this widget
  // By default, enable cross-filtering for chart types that support click interaction
  const chartTypesWithCrossFilter = ['bar_chart', 'pie_chart', 'line_chart', 'area_chart'];
  const defaultCrossFilterEnabled = chartTypesWithCrossFilter.includes(widget.type);
  const crossFilterEnabled = widget.config.cross_filter?.enabled ?? defaultCrossFilterEnabled;
  const crossFilterColumn = widget.config.cross_filter?.column ?? widget.config.x_axis;

  // Build cross-filter config for chart components
  const crossFilterConfig: CrossFilterConfig | undefined = useMemo(() => {
    if (!crossFilterEnabled || !crossFilterContext) return undefined;
    return {
      enabled: true,
      widgetId: widget.id,
      column: crossFilterColumn,
    };
  }, [crossFilterEnabled, crossFilterContext, widget.id, crossFilterColumn]);

  // Get selected value for this widget (from cross-filters applied by other widgets)
  const selectedValue = useMemo((): string | number | null => {
    if (!crossFilterContext) return null;
    // Find any filter that applies to this widget's filter column
    const applicableFilter = crossFilterContext.filters.find(
      (f) => f.sourceWidgetId !== widget.id && f.column === crossFilterColumn
    );
    if (!applicableFilter) return null;
    // If value is an array, use first value for single selection
    const value = applicableFilter.value;
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value;
  }, [crossFilterContext, widget.id, crossFilterColumn]);

  // Handle chart click for cross-filtering
  const handleChartClick = useCallback(
    (params: ChartClickParams) => {
      if (!crossFilterContext || !crossFilterEnabled) return;

      crossFilterContext.toggleFilter({
        sourceWidgetId: widget.id,
        column: crossFilterColumn ?? '',
        value: params.name,
      });
    },
    [crossFilterContext, crossFilterEnabled, widget.id, crossFilterColumn]
  );

  // Create date formatters for table widgets (must be called unconditionally per Rules of Hooks)
  const dateFormatters = useMemo(() => {
    if (widget.type === 'table' && widget.config.dateFormats) {
      return createDateFormatters(widget.config.dateFormats);
    }
    return undefined;
  }, [widget.type, widget.config.dateFormats]);

  // Container style
  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  };

  // Handle loading state - show spinner, hide old data
  // Same behavior for initial load and filter changes
  if (isLoading) {
    return (
      <div style={containerStyle}>
        <LoadingState />
      </div>
    );
  }

  // Wrapper for content (only shows refresh overlay for manual refresh)
  const wrapWithContainer = (content: JSX.Element): JSX.Element => {
    if (isRefreshing && result) {
      return (
        <div style={containerStyle}>
          <RefreshOverlay />
          {content}
        </div>
      );
    }
    return <div style={containerStyle}>{content}</div>;
  };

  // Handle error state
  if (error) {
    return (
      <div style={containerStyle}>
        <ErrorState error={error} />
      </div>
    );
  }

  // Handle text widgets (no query result needed)
  if (widget.type === 'text') {
    return (
      <div style={containerStyle}>
        <TextContent config={widget.config} />
      </div>
    );
  }

  // Handle empty result
  if (!result || result.row_count === 0) {
    return (
      <div style={containerStyle}>
        <EmptyState />
      </div>
    );
  }

  // Extract chart configuration from widget config
  const xAxis = widget.config.x_axis ?? result.columns[0] ?? '';
  const yAxisConfig = widget.config.y_axis ?? [result.columns[1] ?? result.columns[0] ?? ''];
  const yAxis: string[] = yAxisConfig.filter((y): y is string => y !== undefined);
  const showLegend = widget.config.show_legend ?? true;
  const showDataLabels = widget.config.show_data_labels ?? false;
  const colors = widget.config.colors ?? theme.chart.colors;

  // Render based on widget type
  switch (widget.type) {
    case 'metric': {
      const value = result.rows[0]?.[0];
      const comparisonValue = widget.config.trend_comparison
        ? result.rows[0]?.[result.columns.indexOf(widget.config.trend_comparison)]
        : undefined;

      return wrapWithContainer(
        <MetricCard
          title=""
          value={typeof value === 'number' ? value : Number(value) || 0}
          format={widget.config.format ?? 'number'}
          currencySymbol={widget.config.currencySymbol}
          decimals={widget.config.decimalDigits}
          compactNotation={widget.config.compactNotation}
          centered={true}
          trend={
            comparisonValue !== undefined
              ? {
                  value: Number(comparisonValue) || 0,
                  direction:
                    Number(comparisonValue) > 0
                      ? 'up'
                      : Number(comparisonValue) < 0
                        ? 'down'
                        : 'flat',
                }
              : undefined
          }
        />
      );
    }

    case 'bar_chart':
      return wrapWithContainer(
        <BarChart
          data={data}
          xAxis={xAxis}
          yAxis={yAxis}
          orientation={widget.config.orientation ?? 'vertical'}
          stacked={widget.config.stacked}
          showLegend={showLegend}
          showDataLabels={showDataLabels}
          colors={colors}
          xAxisFormat={widget.config.dateFormats?.[xAxis]}
          yAxisFormat={widget.config.valueFormat ?? 'number'}
          currencySymbol={widget.config.currencySymbol}
          compactNotation={widget.config.compactNotation}
          decimalDigits={widget.config.decimalDigits}
          referenceLines={widget.config.referenceLines}
          height="100%"
          crossFilter={crossFilterConfig}
          selectedValue={selectedValue}
          onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
        />
      );

    case 'line_chart':
      return wrapWithContainer(
        <LineChart
          data={data}
          xAxis={xAxis}
          yAxis={yAxis}
          seriesColumn={widget.config.series_column}
          maxSeries={widget.config.max_series}
          showLegend={showLegend}
          showDataLabels={showDataLabels}
          colors={colors}
          xAxisFormat={widget.config.dateFormats?.[xAxis]}
          referenceLines={widget.config.referenceLines}
          height="100%"
          crossFilter={crossFilterConfig}
          selectedValue={selectedValue}
          onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
        />
      );

    case 'area_chart':
      return wrapWithContainer(
        <AreaChart
          data={data}
          xAxis={xAxis}
          yAxis={yAxis}
          stacked={widget.config.stacked}
          showLegend={showLegend}
          colors={colors}
          xAxisFormat={widget.config.dateFormats?.[xAxis]}
          height="100%"
          crossFilter={crossFilterConfig}
          selectedValue={selectedValue}
          onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
        />
      );

    case 'pie_chart':
      return wrapWithContainer(
        <PieChart
          data={data}
          labelColumn={xAxis}
          valueColumn={yAxis[0] ?? ''}
          showLegend={showLegend}
          showLabels={showDataLabels}
          colors={colors}
          labelFormat={widget.config.dateFormats?.[xAxis]}
          height="100%"
          crossFilter={crossFilterConfig}
          selectedValue={selectedValue}
          onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
        />
      );

    case 'scatter_chart':
      return wrapWithContainer(
        <ScatterChart
          data={data}
          xAxis={xAxis}
          yAxis={yAxis[0] ?? ''}
          height="100%"
        />
      );

    case 'table': {
      // Check if this is a pivot table
      let tableResult = result;

      if (widget.config.pivot_column && widget.config.value_column) {
        // Get dimension columns (all columns except pivot and value)
        const dimensionColumns = result.columns.filter(
          (col) => col !== widget.config.pivot_column && col !== widget.config.value_column
        );

        // Pivot the data
        tableResult = pivotQueryResult(result, {
          pivotColumn: widget.config.pivot_column,
          valueColumn: widget.config.value_column,
          dimensionColumns,
        });
      }

      // For tables, use a non-scrolling container so the table handles its own scrolling
      // This allows the sticky header to work properly
      const tableContainerStyle: React.CSSProperties = {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Don't scroll here - let ResultsTable handle it
        position: 'relative',
      };

      const tableContent = (
        <ResultsTable
          result={tableResult}
          pageSize={widget.config.page_size ?? 10}
          sortable={widget.config.sortable ?? true}
          formatters={dateFormatters}
        />
      );

      // Handle refresh overlay for tables (manual refresh only)
      // Note: isLoading is handled earlier and shows LoadingState
      if (isRefreshing) {
        return (
          <div style={tableContainerStyle}>
            <RefreshOverlay />
            {tableContent}
          </div>
        );
      }

      return <div style={tableContainerStyle}>{tableContent}</div>;
    }

    default:
      return wrapWithContainer(<EmptyState />);
  }
}
