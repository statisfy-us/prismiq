/**
 * Hook for transforming QueryResult to chart-ready format.
 */

import { useMemo } from 'react';
import type { QueryResult } from '../types';
import type { ChartDataOptions, ChartDataResult, ChartSeries } from '../charts/types';

/**
 * Transforms a QueryResult into chart-ready data format.
 *
 * Features:
 * - Extracts categories and series from query result
 * - Supports grouping by column for multi-series
 * - Sorting by X or Y values
 * - Limiting number of data points
 * - Memoized for performance
 *
 * @example
 * ```tsx
 * const { categories, series, isEmpty } = useChartData(queryResult, {
 *   xColumn: 'month',
 *   yColumns: ['revenue', 'cost'],
 *   sortBy: 'y',
 *   sortDirection: 'desc',
 *   limit: 10,
 * });
 * ```
 */
export function useChartData(
  result: QueryResult | null,
  options: ChartDataOptions
): ChartDataResult {
  const { xColumn, yColumns, groupColumn, sortBy = 'none', sortDirection = 'asc', limit } = options;

  return useMemo(() => {
    // Handle null/undefined result
    if (!result || result.rows.length === 0) {
      return {
        categories: [],
        series: [],
        isEmpty: true,
        totalRows: 0,
      };
    }

    // Find column indices
    const xIndex = result.columns.indexOf(xColumn);
    if (xIndex === -1) {
      return {
        categories: [],
        series: [],
        isEmpty: true,
        totalRows: result.row_count,
      };
    }

    const yIndices = yColumns
      .map((col) => ({ name: col, index: result.columns.indexOf(col) }))
      .filter((item) => item.index !== -1);

    if (yIndices.length === 0) {
      return {
        categories: [],
        series: [],
        isEmpty: true,
        totalRows: result.row_count,
      };
    }

    // Check if we need to group by a column
    const groupIndex = groupColumn ? result.columns.indexOf(groupColumn) : -1;

    if (groupIndex !== -1) {
      // Grouped multi-series
      return processGroupedData(result, xIndex, yIndices, groupIndex, sortBy, sortDirection, limit);
    }

    // Standard multi-column series
    return processStandardData(result, xIndex, yIndices, sortBy, sortDirection, limit);
  }, [result, xColumn, yColumns, groupColumn, sortBy, sortDirection, limit]);
}

/**
 * Process data without grouping - each Y column becomes a series.
 */
function processStandardData(
  result: QueryResult,
  xIndex: number,
  yIndices: Array<{ name: string; index: number }>,
  sortBy: 'x' | 'y' | 'none',
  sortDirection: 'asc' | 'desc',
  limit?: number
): ChartDataResult {
  // Build data points with all values
  const dataPoints = result.rows.map((row) => {
    const xValue = row[xIndex];
    const yValues = yIndices.map((yi) => {
      const val = row[yi.index];
      return val === null || val === undefined ? null : Number(val);
    });
    return {
      x: xValue === null ? '' : String(xValue),
      y: yValues,
    };
  });

  // Sort if requested
  let sortedPoints = dataPoints;
  if (sortBy !== 'none') {
    sortedPoints = [...dataPoints].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'x') {
        comparison = a.x.localeCompare(b.x);
      } else if (sortBy === 'y') {
        // Sort by first Y column
        const aVal = a.y[0] ?? 0;
        const bVal = b.y[0] ?? 0;
        comparison = aVal - bVal;
      }

      return sortDirection === 'desc' ? -comparison : comparison;
    });
  }

  // Apply limit
  const limitedPoints = limit ? sortedPoints.slice(0, limit) : sortedPoints;

  // Extract categories and series
  const categories = limitedPoints.map((p) => p.x);
  const series: ChartSeries[] = yIndices.map((yi, seriesIndex) => ({
    name: yi.name,
    data: limitedPoints.map((p) => p.y[seriesIndex] ?? null),
  }));

  return {
    categories,
    series,
    isEmpty: categories.length === 0,
    totalRows: result.row_count,
  };
}

/**
 * Process data with grouping - group column values become series.
 */
function processGroupedData(
  result: QueryResult,
  xIndex: number,
  yIndices: Array<{ name: string; index: number }>,
  groupIndex: number,
  sortBy: 'x' | 'y' | 'none',
  sortDirection: 'asc' | 'desc',
  limit?: number
): ChartDataResult {
  // Use first Y column for grouped data
  const yInfo = yIndices[0];
  if (!yInfo) {
    return {
      categories: [],
      series: [],
      isEmpty: true,
      totalRows: result.row_count,
    };
  }

  // Collect unique categories and groups
  const categorySet = new Set<string>();
  const groupMap = new Map<string, Map<string, number | null>>();

  result.rows.forEach((row) => {
    const xValue = row[xIndex];
    const groupValue = row[groupIndex];
    const yValue = row[yInfo.index];

    const category = xValue === null ? '' : String(xValue);
    const group = groupValue === null ? '' : String(groupValue);
    const value = yValue === null || yValue === undefined ? null : Number(yValue);

    categorySet.add(category);

    if (!groupMap.has(group)) {
      groupMap.set(group, new Map());
    }
    const groupData = groupMap.get(group);
    if (groupData) {
      groupData.set(category, value);
    }
  });

  // Get sorted categories
  let categories = Array.from(categorySet);
  if (sortBy === 'x') {
    categories = categories.sort((a, b) =>
      sortDirection === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
    );
  }

  // Apply limit to categories
  if (limit) {
    categories = categories.slice(0, limit);
  }

  // Build series from groups
  const groupNames = Array.from(groupMap.keys()).sort();
  const series: ChartSeries[] = groupNames.map((groupName) => {
    const groupData = groupMap.get(groupName);
    return {
      name: groupName,
      data: categories.map((cat) => groupData?.get(cat) ?? null),
    };
  });

  // Sort by Y if requested (sort categories by first series value)
  if (sortBy === 'y' && series.length > 0) {
    const firstSeries = series[0];
    if (firstSeries) {
      const indices = categories.map((_, i) => i);
      indices.sort((a, b) => {
        const aVal = firstSeries.data[a] ?? 0;
        const bVal = firstSeries.data[b] ?? 0;
        const comparison = aVal - bVal;
        return sortDirection === 'desc' ? -comparison : comparison;
      });

      const sortedCategories = indices.map((i) => categories[i]).filter((c): c is string => c !== undefined);
      categories = sortedCategories;
      series.forEach((s) => {
        s.data = indices.map((i) => s.data[i] ?? null);
      });
    }
  }

  return {
    categories,
    series,
    isEmpty: categories.length === 0,
    totalRows: result.row_count,
  };
}

export default useChartData;
