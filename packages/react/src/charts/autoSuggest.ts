/**
 * Auto-suggest utility for recommending chart types based on data.
 */

import type { QueryResult, ColumnSelection } from '../types';
import type { ChartSuggestion } from './types';

/**
 * Column type categories for chart suggestion.
 */
type ColumnCategory = 'date' | 'numeric' | 'categorical' | 'unknown';

/**
 * Determines the category of a column based on its data type.
 */
function categorizeColumn(dataType: string): ColumnCategory {
  const normalizedType = dataType.toLowerCase();

  // Date types
  if (
    normalizedType.includes('date') ||
    normalizedType.includes('time') ||
    normalizedType.includes('timestamp')
  ) {
    return 'date';
  }

  // Numeric types
  if (
    normalizedType.includes('int') ||
    normalizedType.includes('numeric') ||
    normalizedType.includes('decimal') ||
    normalizedType.includes('float') ||
    normalizedType.includes('double') ||
    normalizedType.includes('real') ||
    normalizedType.includes('money')
  ) {
    return 'numeric';
  }

  // Categorical types (strings, booleans)
  if (
    normalizedType.includes('char') ||
    normalizedType.includes('text') ||
    normalizedType.includes('varchar') ||
    normalizedType.includes('bool') ||
    normalizedType.includes('uuid')
  ) {
    return 'categorical';
  }

  return 'unknown';
}

/**
 * Counts unique values in a column.
 */
function countUniqueValues(result: QueryResult, columnIndex: number): number {
  const uniqueValues = new Set<unknown>();
  result.rows.forEach((row) => {
    uniqueValues.add(row[columnIndex]);
  });
  return uniqueValues.size;
}

/**
 * Analyzes columns to determine their types and characteristics.
 */
function analyzeColumns(
  result: QueryResult,
  selections: ColumnSelection[]
): Array<{
  name: string;
  category: ColumnCategory;
  uniqueCount: number;
  hasAggregation: boolean;
}> {
  return selections.map((sel) => {
    const columnIndex = result.columns.indexOf(sel.alias || sel.column);
    const typeIndex = columnIndex !== -1 ? columnIndex : 0;
    const dataType = result.column_types[typeIndex] || 'unknown';

    return {
      name: sel.alias || sel.column,
      category: categorizeColumn(dataType),
      uniqueCount: columnIndex !== -1 ? countUniqueValues(result, columnIndex) : 0,
      hasAggregation: sel.aggregation !== 'none',
    };
  });
}

/**
 * Suggests the best chart types for a given query result and column selections.
 *
 * Rules:
 * - Single numeric value -> MetricCard
 * - Date + numeric -> Line/Area chart
 * - Category + numeric -> Bar chart
 * - Category + numeric (few categories <= 7) -> Pie chart
 * - Two numerics -> Scatter chart
 * - Multiple numerics, no date -> Grouped bar chart
 *
 * @param result - The query result to analyze
 * @param columns - The selected columns
 * @returns Array of chart suggestions sorted by confidence
 *
 * @example
 * ```tsx
 * const suggestions = suggestChartType(queryResult, [
 *   { table_id: 't1', column: 'month', aggregation: 'none' },
 *   { table_id: 't1', column: 'revenue', aggregation: 'sum' },
 * ]);
 * // Returns [{ type: 'bar', confidence: 0.9, reason: '...', config: {...} }]
 * ```
 */
export function suggestChartType(
  result: QueryResult,
  columns: ColumnSelection[]
): ChartSuggestion[] {
  const suggestions: ChartSuggestion[] = [];

  // Handle empty result
  if (!result || result.rows.length === 0 || columns.length === 0) {
    return [];
  }

  // Analyze the selected columns
  const analyzedColumns = analyzeColumns(result, columns);

  // Separate by category
  const dateColumns = analyzedColumns.filter((c) => c.category === 'date');
  const numericColumns = analyzedColumns.filter((c) => c.category === 'numeric');
  const categoricalColumns = analyzedColumns.filter((c) => c.category === 'categorical');
  const aggregatedColumns = analyzedColumns.filter((c) => c.hasAggregation);

  // Rule 1: Single value -> MetricCard
  if (result.rows.length === 1 && numericColumns.length === 1) {
    const numericCol = numericColumns[0];
    if (numericCol) {
      const colIndex = result.columns.indexOf(numericCol.name);
      const value = colIndex !== -1 ? result.rows[0]?.[colIndex] : 0;
      suggestions.push({
        type: 'metric',
        confidence: 0.95,
        reason: 'Single numeric value is best displayed as a metric card',
        config: {
          title: numericCol.name,
          value: typeof value === 'number' ? value : 0,
          format: 'number',
        },
      });
    }
  }

  // Rule 2: Date + numeric -> Line/Area chart
  if (dateColumns.length >= 1 && numericColumns.length >= 1) {
    const dateCol = dateColumns[0];
    if (dateCol) {
      const xAxis = dateCol.name;
      const yAxis = numericColumns.map((c) => c.name);

      suggestions.push({
        type: 'line',
        confidence: 0.9,
        reason: 'Time series data is best visualized as a line chart',
        config: {
          xAxis,
          yAxis: yAxis.length === 1 ? yAxis[0] : yAxis,
          smooth: true,
          showPoints: result.rows.length <= 20,
        },
      });

      // Also suggest area chart for time series with stacking potential
      if (numericColumns.length > 1) {
        suggestions.push({
          type: 'area',
          confidence: 0.75,
          reason: 'Multiple time series can be compared with stacked area chart',
          config: {
            xAxis,
            yAxis,
            stacked: true,
            smooth: true,
          },
        });
      }
    }
  }

  // Rule 3: Category + numeric -> Bar chart
  if (categoricalColumns.length >= 1 && numericColumns.length >= 1) {
    const categoryCol = categoricalColumns[0];
    if (categoryCol) {
      const xAxis = categoryCol.name;
      const yAxis = numericColumns.map((c) => c.name);
      const uniqueCount = categoryCol.uniqueCount;

      // Bar chart is good for up to ~20 categories
      if (uniqueCount <= 20) {
        suggestions.push({
          type: 'bar',
          confidence: 0.85,
          reason: 'Categorical data with numeric values is best shown as a bar chart',
          config: {
            xAxis,
            yAxis: yAxis.length === 1 ? yAxis[0] : yAxis,
            orientation: uniqueCount > 10 ? 'horizontal' : 'vertical',
            stacked: numericColumns.length > 1,
          },
        });
      }

      // Rule 4: Few categories (<= 7) -> Pie chart
      if (uniqueCount <= 7 && numericColumns.length === 1) {
        const numericCol = numericColumns[0];
        if (numericCol) {
          suggestions.push({
            type: 'pie',
            confidence: 0.8,
            reason: 'Small number of categories is well suited for a pie chart',
            config: {
              labelColumn: xAxis,
              valueColumn: numericCol.name,
              variant: uniqueCount <= 5 ? 'donut' : 'pie',
              showPercentage: true,
            },
          });
        }
      }
    }
  }

  // Rule 5: Two numerics (no date/category dominant) -> Scatter chart
  if (numericColumns.length >= 2 && dateColumns.length === 0) {
    const hasEnoughPoints = result.rows.length >= 5;
    const numericCol0 = numericColumns[0];
    const numericCol1 = numericColumns[1];
    const numericCol2 = numericColumns[2];

    if (hasEnoughPoints && numericCol0 && numericCol1) {
      suggestions.push({
        type: 'scatter',
        confidence: 0.7,
        reason: 'Two numeric columns can show correlation in a scatter plot',
        config: {
          xAxis: numericCol0.name,
          yAxis: numericCol1.name,
          sizeColumn: numericCol2?.name,
          showTrendline: true,
        },
      });
    }
  }

  // Rule 6: Multiple numerics without date -> Grouped bar
  if (
    numericColumns.length > 1 &&
    categoricalColumns.length >= 1 &&
    dateColumns.length === 0 &&
    aggregatedColumns.length > 0
  ) {
    const categoryCol = categoricalColumns[0];
    if (categoryCol) {
      const xAxis = categoryCol.name;
      const yAxis = numericColumns.map((c) => c.name);

      // Only if we haven't already suggested a bar chart with high confidence
      const hasBarSuggestion = suggestions.some(
        (s) => s.type === 'bar' && s.confidence >= 0.85
      );

      if (!hasBarSuggestion) {
        suggestions.push({
          type: 'bar',
          confidence: 0.65,
          reason: 'Multiple numeric metrics can be compared with grouped bars',
          config: {
            xAxis,
            yAxis,
            orientation: 'vertical',
            stacked: false,
            showLegend: true,
          },
        });
      }
    }
  }

  // Fallback: If no good suggestions, provide a basic bar chart
  if (suggestions.length === 0 && analyzedColumns.length >= 2) {
    const firstCol = analyzedColumns[0];
    const secondCol = analyzedColumns[1];

    if (firstCol && secondCol) {
      suggestions.push({
        type: 'bar',
        confidence: 0.5,
        reason: 'Default visualization for the selected data',
        config: {
          xAxis: firstCol.name,
          yAxis: secondCol.name,
        },
      });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

export default suggestChartType;
