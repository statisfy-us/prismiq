/**
 * CSV export functionality.
 */

import type { QueryResult } from '../types';
import type { ExportData, ExportOptions } from './types';

/**
 * Check if data is a QueryResult.
 */
function isQueryResult(data: ExportData): data is QueryResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'columns' in data &&
    'rows' in data &&
    Array.isArray((data as QueryResult).columns) &&
    Array.isArray((data as QueryResult).rows)
  );
}

/**
 * Convert data to array of objects format.
 */
function normalizeData(data: ExportData): {
  columns: string[];
  rows: Record<string, unknown>[];
} {
  if (isQueryResult(data)) {
    const rows = data.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      data.columns.forEach((col, index) => {
        obj[col] = row[index];
      });
      return obj;
    });
    return { columns: data.columns, rows };
  }

  if (Array.isArray(data) && data.length > 0) {
    const firstRow = data[0];
    if (firstRow && typeof firstRow === 'object') {
      const columns = Object.keys(firstRow);
      return { columns, rows: data };
    }
  }

  return { columns: [], rows: [] };
}

/**
 * Escape a value for CSV.
 *
 * Handles:
 * - Commas (wrap in quotes)
 * - Quotes (double them)
 * - Newlines (wrap in quotes)
 * - Leading/trailing whitespace (wrap in quotes)
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // Check if we need to quote the value
  const needsQuoting =
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r') ||
    stringValue.startsWith(' ') ||
    stringValue.endsWith(' ');

  if (needsQuoting) {
    // Double any existing quotes and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Format a value for CSV export.
 */
function formatValue(
  value: unknown,
  options?: ExportOptions
): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle dates
  if (value instanceof Date) {
    if (options?.dateFormat) {
      // Simple date formatting (could be extended with a library)
      return value.toISOString();
    }
    return value.toISOString();
  }

  // Handle numbers
  if (typeof value === 'number') {
    if (options?.numberFormat) {
      return new Intl.NumberFormat(undefined, options.numberFormat).format(value);
    }
    return String(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Handle objects/arrays
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Generate CSV content from data.
 *
 * @param data - Array of row objects
 * @param columns - Column names
 * @param headers - Custom header names
 * @param options - Export options
 * @returns CSV string
 */
export function generateCSV(
  data: Record<string, unknown>[],
  columns: string[],
  headers?: Record<string, string>,
  options?: ExportOptions
): string {
  const lines: string[] = [];

  // Header row
  const headerRow = columns.map((col) => {
    const headerName = headers?.[col] ?? col;
    return escapeCSVValue(headerName);
  });
  lines.push(headerRow.join(','));

  // Data rows
  for (const row of data) {
    const rowValues = columns.map((col) => {
      const value = row[col];
      const formatted = formatValue(value, options);
      return escapeCSVValue(formatted);
    });
    lines.push(rowValues.join(','));
  }

  return lines.join('\n');
}

/**
 * Trigger a file download in the browser.
 *
 * @param content - File content
 * @param filename - File name with extension
 * @param mimeType - MIME type
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  // Create blob
  const blob = new Blob([content], { type: mimeType });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV and trigger download.
 *
 * @param data - QueryResult or array of objects
 * @param options - Export options
 *
 * @example
 * ```tsx
 * // Export query result
 * exportToCSV(queryResult, { filename: 'sales-report' });
 *
 * // Export with custom columns
 * exportToCSV(data, {
 *   columns: ['id', 'name', 'value'],
 *   headers: { id: 'ID', name: 'Name', value: 'Value' }
 * });
 * ```
 */
export function exportToCSV(
  data: ExportData,
  options?: ExportOptions
): void {
  const { columns: allColumns, rows } = normalizeData(data);

  // Use specified columns or all columns
  const exportColumns = options?.columns ?? allColumns;

  // Generate CSV
  const csv = generateCSV(rows, exportColumns, options?.headers, options);

  // Generate filename
  const filename = options?.filename ?? 'export';
  const fullFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  // Download
  downloadFile(csv, fullFilename, 'text/csv;charset=utf-8');
}
