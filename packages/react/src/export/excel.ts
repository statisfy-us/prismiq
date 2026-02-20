/**
 * Excel export functionality.
 *
 * Uses the xlsx library (SheetJS) for Excel file generation.
 */

import type { QueryResult } from '../types';
import type { ExcelExportOptions, ExportData } from './types';

type XLSXModule = typeof import('xlsx');

async function loadXLSX(): Promise<XLSXModule> {
  try {
    return await import('xlsx');
  } catch (err) {
    const detail = err instanceof Error ? `: ${err.message}` : '';
    throw new Error(
      `xlsx is required for Excel export. Install it with: npm install xlsx${detail}`
    );
  }
}

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
 * Calculate optimal column width based on content.
 */
function calculateColumnWidth(values: unknown[]): number {
  let maxLength = 0;

  for (const value of values) {
    const strValue = value === null || value === undefined ? '' : String(value);
    maxLength = Math.max(maxLength, strValue.length);
  }

  // Add some padding and cap at reasonable max
  return Math.min(Math.max(maxLength + 2, 8), 50);
}

/**
 * Export data to Excel and trigger download.
 *
 * @param data - QueryResult or array of objects
 * @param options - Export options
 *
 * @example
 * ```tsx
 * // Basic export
 * exportToExcel(queryResult, { filename: 'sales-report' });
 *
 * // With styling
 * exportToExcel(data, {
 *   filename: 'report',
 *   sheetName: 'Sales Data',
 *   freezeHeader: true,
 *   headerStyle: { bold: true, fill: '#e3f2fd', align: 'center' }
 * });
 * ```
 */
export async function exportToExcel(
  data: ExportData,
  options?: ExcelExportOptions
): Promise<void> {
  const XLSX = await loadXLSX();
  const { columns: allColumns, rows } = normalizeData(data);

  // Use specified columns or all columns
  const exportColumns = options?.columns ?? allColumns;

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();

  // Prepare data with headers
  const headers = exportColumns.map(col => options?.headers?.[col] ?? col);

  // Convert rows to array format for the worksheet
  const wsData: unknown[][] = [headers];

  for (const row of rows) {
    const rowData = exportColumns.map(col => {
      const value = row[col];
      // Handle special types
      if (value instanceof Date) {
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value;
    });
    wsData.push(rowData);
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = exportColumns.map((col, index) => {
    // Use custom width if specified
    if (options?.columnWidths?.[col]) {
      return { wch: options.columnWidths[col] };
    }

    // Calculate width from content
    const columnValues = [headers[index], ...rows.map(r => r[col])];
    return { wch: calculateColumnWidth(columnValues) };
  });
  worksheet['!cols'] = colWidths;

  // Freeze header row if requested
  if (options?.freezeHeader) {
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  }

  // Add worksheet to workbook
  const sheetName = options?.sheetName ?? 'Sheet1';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate filename
  const filename = options?.filename ?? 'export';
  const fullFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  // Write and download
  XLSX.writeFile(workbook, fullFilename);
}

/**
 * Export multiple sheets to a single Excel file.
 *
 * @param sheets - Object mapping sheet names to data
 * @param filename - Output filename
 *
 * @example
 * ```tsx
 * exportMultipleSheets({
 *   'Sales': salesData,
 *   'Customers': customerData,
 *   'Products': productData,
 * }, 'full-report');
 * ```
 */
export async function exportMultipleSheets(
  sheets: Record<string, ExportData>,
  filename: string
): Promise<void> {
  const XLSX = await loadXLSX();
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, data] of Object.entries(sheets)) {
    const { columns, rows } = normalizeData(data);

    // Prepare data with headers
    const wsData: unknown[][] = [columns];

    for (const row of rows) {
      const rowData = columns.map(col => {
        const value = row[col];
        if (value instanceof Date) {
          return value;
        }
        if (typeof value === 'object' && value !== null) {
          return JSON.stringify(value);
        }
        return value;
      });
      wsData.push(rowData);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-size columns
    const colWidths = columns.map((col, index) => {
      const columnValues = [columns[index], ...rows.map(r => r[col])];
      return { wch: calculateColumnWidth(columnValues) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const fullFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, fullFilename);
}
