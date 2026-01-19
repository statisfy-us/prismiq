/**
 * Pivot utility for transforming query results from long format to wide format.
 */

import type { QueryResult } from '../types';

export interface PivotConfig {
  /** Column whose unique values become new columns. */
  pivotColumn: string;
  /** Column containing values to distribute across pivot columns. */
  valueColumn: string;
  /** Columns to keep as-is (dimension/grouping columns). */
  dimensionColumns: string[];
}

/**
 * Pivot a query result by transforming unique values in pivotColumn
 * into separate columns.
 *
 * Example:
 * Input (long format):
 *   account | date       | name | value
 *   Cerby   | 2025-02-01 | MAU  | 9
 *   Cerby   | 2025-02-01 | Searches | 1
 *
 * Output (wide format):
 *   account | date       | MAU | Searches
 *   Cerby   | 2025-02-01 | 9   | 1
 *
 * @param result - The query result to pivot
 * @param config - Pivot configuration
 * @returns Pivoted query result
 */
export function pivotQueryResult(
  result: QueryResult,
  config: PivotConfig
): QueryResult {
  const { pivotColumn, valueColumn, dimensionColumns } = config;

  // Find column indices
  const pivotColIndex = result.columns.indexOf(pivotColumn);
  const valueColIndex = result.columns.indexOf(valueColumn);

  if (pivotColIndex === -1 || valueColIndex === -1) {
    console.warn(
      `[pivot] Cannot pivot: columns not found (pivot=${pivotColIndex}, value=${valueColIndex})`
    );
    return result; // Can't pivot, return as-is
  }

  // Get unique pivot values (these become new columns)
  const pivotValues = Array.from(
    new Set(result.rows.map((row) => String(row[pivotColIndex])))
  ).sort();

  // Build dimension column indices
  const dimIndices = dimensionColumns
    .map((col) => result.columns.indexOf(col))
    .filter((idx) => idx !== -1);

  // Group rows by dimension values
  const grouped = new Map<string, Map<string, unknown>>();

  for (const row of result.rows) {
    // Create key from dimension column values
    const dimValues = dimIndices.map((i) => row[i]);
    const key = dimValues.map((v) => String(v ?? '')).join('|');

    if (!grouped.has(key)) {
      // Store dimension values for this group
      const group = new Map<string, unknown>();
      group.set('__dim_values__', dimValues);
      grouped.set(key, group);
    }

    const pivotValue = String(row[pivotColIndex]);
    const value = row[valueColIndex];
    grouped.get(key)!.set(pivotValue, value);
  }

  // Build pivoted result
  const newColumns = [...dimensionColumns, ...pivotValues];
  const newRows: unknown[][] = [];

  for (const [_key, valueMap] of grouped.entries()) {
    const dimValues = valueMap.get('__dim_values__') as unknown[];
    const newRow = [
      ...dimValues,
      ...pivotValues.map((pv) => valueMap.get(pv) ?? null),
    ];
    newRows.push(newRow);
  }

  // Build column_types array (dimension types + value type for each pivot column)
  const dimColTypes = dimensionColumns
    .map((col) => {
      const idx = result.columns.indexOf(col);
      return idx !== -1 && result.column_types && result.column_types[idx]
        ? result.column_types[idx]
        : 'text';
    })
    .filter((t): t is string => t !== undefined);

  const valueColType = (result.column_types && result.column_types[valueColIndex]) ?? 'numeric';
  const newColumnTypes = [...dimColTypes, ...pivotValues.map(() => valueColType)];

  return {
    columns: newColumns,
    column_types: newColumnTypes,
    rows: newRows,
    row_count: newRows.length,
    truncated: result.truncated,
    execution_time_ms: result.execution_time_ms,
  };
}
