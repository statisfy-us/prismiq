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
import { createDateFormatters, pivotQueryResult } from '../../utils';
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
}

/**
 * Render text/markdown content.
 */
function TextContent({ config }: { config: WidgetConfig }): JSX.Element {
  const { theme } = useTheme();

  const contentStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    fontSize: theme.fontSizes.base,
    color: theme.colors.text,
    lineHeight: 1.6,
  };

  // If no text content, render nothing (title is shown in widget header)
  if (!config.content) {
    return <></>;
  }

  // For now, just render plain text. In the future, could add markdown support.
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
 * Widget content renderer.
 *
 * Renders the appropriate visualization based on widget type.
 */
export function WidgetContent({
  widget,
  result,
  isLoading = false,
  error,
}: WidgetContentProps): JSX.Element {
  const { theme } = useTheme();

  // Get cross-filter context (may be null if not wrapped in CrossFilterProvider)
  const crossFilterContext = useCrossFilterOptional();

  // Convert result rows to chart data format - must be called unconditionally (Rules of Hooks)
  const data = useMemo(() => (result ? resultToDataPoints(result) : []), [result]);

  // Determine if cross-filtering is enabled for this widget
  const crossFilterEnabled = widget.config.cross_filter?.enabled ?? false;
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
    console.log('[WidgetContent DEBUG] widget.type:', widget.type);
    console.log('[WidgetContent DEBUG] widget.config.dateFormats:', widget.config.dateFormats);
    if (widget.type === 'table' && widget.config.dateFormats) {
      const formatters = createDateFormatters(widget.config.dateFormats);
      console.log('[WidgetContent DEBUG] Created dateFormatters:', Object.keys(formatters));
      return formatters;
    }
    console.log('[WidgetContent DEBUG] No dateFormatters created');
    return undefined;
  }, [widget.type, widget.config.dateFormats]);

  // Container style
  const containerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  };

  // Handle loading state
  if (isLoading && !result) {
    return (
      <div style={containerStyle}>
        <LoadingState />
      </div>
    );
  }

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

      return (
        <div style={containerStyle}>
          <MetricCard
            title=""
            value={typeof value === 'number' ? value : Number(value) || 0}
            format={widget.config.format ?? 'number'}
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
        </div>
      );
    }

    case 'bar_chart':
      return (
        <div style={containerStyle}>
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
            height="100%"
            crossFilter={crossFilterConfig}
            selectedValue={selectedValue}
            onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
          />
        </div>
      );

    case 'line_chart':
      return (
        <div style={containerStyle}>
          <LineChart
            data={data}
            xAxis={xAxis}
            yAxis={yAxis}
            seriesColumn={widget.config.series_column}
            showLegend={showLegend}
            showDataLabels={showDataLabels}
            colors={colors}
            xAxisFormat={widget.config.dateFormats?.[xAxis]}
            height="100%"
            crossFilter={crossFilterConfig}
            selectedValue={selectedValue}
            onDataPointClick={crossFilterEnabled ? handleChartClick : undefined}
          />
        </div>
      );

    case 'area_chart':
      return (
        <div style={containerStyle}>
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
        </div>
      );

    case 'pie_chart':
      return (
        <div style={containerStyle}>
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
        </div>
      );

    case 'scatter_chart':
      return (
        <div style={containerStyle}>
          <ScatterChart
            data={data}
            xAxis={xAxis}
            yAxis={yAxis[0] ?? ''}
            height="100%"
          />
        </div>
      );

    case 'table': {
      // Check if this is a pivot table
      let tableResult = result;

      if (widget.config.pivot_column && widget.config.value_column) {
        // Get dimension columns (all columns except pivot and value)
        const dimensionColumns = result.columns.filter(
          (col) => col !== widget.config.pivot_column && col !== widget.config.value_column
        );

        console.log('[PIVOT DEBUG] Pivoting table:', {
          pivot_column: widget.config.pivot_column,
          value_column: widget.config.value_column,
          dimensions: dimensionColumns,
          original_columns: result.columns,
        });

        // Pivot the data
        tableResult = pivotQueryResult(result, {
          pivotColumn: widget.config.pivot_column,
          valueColumn: widget.config.value_column,
          dimensionColumns,
        });

        console.log('[PIVOT DEBUG] Pivoted result:', {
          columns: tableResult.columns,
          row_count: tableResult.row_count,
          sample_rows: tableResult.rows.slice(0, 3),
        });
      }

      return (
        <div style={containerStyle}>
          <ResultsTable
            result={tableResult}
            pageSize={widget.config.page_size ?? 10}
            sortable={widget.config.sortable ?? true}
            formatters={dateFormatters}
          />
        </div>
      );
    }

    default:
      return (
        <div style={containerStyle}>
          <EmptyState />
        </div>
      );
  }
}
