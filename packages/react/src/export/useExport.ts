'use client';

import { useCallback, useMemo, useState } from 'react';
import type { QueryResult } from '../types';
import { exportToCSV } from './csv';
import { exportToExcel } from './excel';
import type { ExcelExportOptions, ExportOptions } from './types';

/**
 * Options for the useExport hook.
 */
export interface UseExportOptions {
  /** Data to export */
  data: QueryResult | null;
  /** Default filename for exports */
  filename?: string;
  /** Columns to export (defaults to all) */
  columns?: string[];
  /** Custom column headers */
  headers?: Record<string, string>;
}

/**
 * Result of the useExport hook.
 */
export interface UseExportResult {
  /** Export to CSV file */
  exportCSV: () => void;
  /** Export to Excel file */
  exportExcel: (options?: ExcelExportOptions) => void;
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Whether export is possible (data is available) */
  canExport: boolean;
}

/**
 * Hook for exporting query data to CSV or Excel.
 *
 * @param options - Export options
 * @returns Export functions and state
 *
 * @example
 * ```tsx
 * function DataTable({ data }) {
 *   const { exportCSV, exportExcel, canExport, isExporting } = useExport({
 *     data,
 *     filename: 'sales-report',
 *     columns: ['id', 'name', 'amount'],
 *     headers: { id: 'ID', name: 'Name', amount: 'Amount' }
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={exportCSV} disabled={!canExport || isExporting}>
 *         Export CSV
 *       </button>
 *       <button onClick={() => exportExcel()} disabled={!canExport || isExporting}>
 *         Export Excel
 *       </button>
 *       {isExporting && <span>Exporting...</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExport(options: UseExportOptions): UseExportResult {
  const { data, filename, columns, headers } = options;
  const [isExporting, setIsExporting] = useState(false);

  // Check if export is possible
  const canExport = useMemo(() => {
    return data !== null && data.rows.length > 0;
  }, [data]);

  // Generate timestamp for filename
  const generateFilename = useCallback(() => {
    const base = filename ?? 'export';
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${base}-${timestamp}`;
  }, [filename]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!canExport || !data) return;

    setIsExporting(true);
    try {
      const exportOptions: ExportOptions = {
        filename: generateFilename(),
        columns,
        headers,
      };
      exportToCSV(data, exportOptions);
    } finally {
      setIsExporting(false);
    }
  }, [canExport, data, generateFilename, columns, headers]);

  // Export to Excel
  const handleExportExcel = useCallback(async (excelOptions?: ExcelExportOptions) => {
    if (!canExport || !data) return;

    setIsExporting(true);
    try {
      const exportOptions: ExcelExportOptions = {
        filename: generateFilename(),
        columns,
        headers,
        ...excelOptions,
      };
      await exportToExcel(data, exportOptions);
    } finally {
      setIsExporting(false);
    }
  }, [canExport, data, generateFilename, columns, headers]);

  return {
    exportCSV: handleExportCSV,
    exportExcel: handleExportExcel,
    isExporting,
    canExport,
  };
}

export default useExport;
