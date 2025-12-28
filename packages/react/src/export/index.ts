/**
 * Export functionality for data export to CSV and Excel.
 *
 * @example
 * ```tsx
 * import { exportToCSV, exportToExcel, useExport } from '@prismiq/react';
 *
 * // Direct export
 * exportToCSV(queryResult, { filename: 'data' });
 * exportToExcel(queryResult, { filename: 'data', freezeHeader: true });
 *
 * // Hook for components
 * const { exportCSV, exportExcel, canExport } = useExport({ data });
 * ```
 */

// Types
export type {
  ExportOptions,
  ExcelExportOptions,
  ExcelCellStyle,
  ExportData,
} from './types';

// CSV export
export { exportToCSV, generateCSV, downloadFile } from './csv';

// Excel export
export { exportToExcel, exportMultipleSheets } from './excel';

// Hook
export { useExport } from './useExport';
export type { UseExportOptions, UseExportResult } from './useExport';
