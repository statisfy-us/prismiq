/**
 * ResultsTable component for displaying query results.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { QueryResult } from '../../types';
import { Button, Icon } from '../ui';
import { Pagination } from './Pagination';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';

// ============================================================================
// CSV Export Utility
// ============================================================================

/**
 * Escape a value for CSV format.
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert QueryResult to CSV string.
 */
function convertToCSV(result: QueryResult): string {
  const lines: string[] = [];

  // Header row
  lines.push(result.columns.map(escapeCSVValue).join(','));

  // Data rows
  for (const row of result.rows) {
    lines.push(row.map(escapeCSVValue).join(','));
  }

  return lines.join('\n');
}

/**
 * Download a string as a file.
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Types
// ============================================================================

export interface ResultsTableProps {
  /** Query result data. */
  result: QueryResult | null;
  /** Whether data is currently loading. */
  loading?: boolean;
  /** Error that occurred during query execution. */
  error?: Error | null;
  /** Number of rows per page. */
  pageSize?: number;
  /** Whether columns are sortable. */
  sortable?: boolean;
  /** Callback when a column is sorted. */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  /** Callback when a row is clicked. */
  onRowClick?: (row: unknown[], index: number) => void;
  /** Callback when a cell is clicked. */
  onCellClick?: (value: unknown, column: string, rowIndex: number) => void;
  /** Custom formatters by column name. */
  formatters?: Record<string, (value: unknown) => string>;
  /** Callback when export is requested. */
  onExport?: (format: 'csv' | 'json') => void;
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  backgroundColor: 'var(--prismiq-color-background)',
  overflow: 'hidden',
  height: '100%', // Fill parent container
};

const tableContainerStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  // Height will be constrained by the parent container
};

const tableStyles: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontFamily: 'var(--prismiq-font-sans)',
};

const loadingStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--prismiq-spacing-xl)',
  color: 'var(--prismiq-color-text-muted)',
  gap: 'var(--prismiq-spacing-sm)',
};

const errorStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--prismiq-spacing-xl)',
  color: 'var(--prismiq-color-error)',
  gap: 'var(--prismiq-spacing-sm)',
  textAlign: 'center',
};

const emptyStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--prismiq-spacing-xl)',
  color: 'var(--prismiq-color-text-muted)',
  gap: 'var(--prismiq-spacing-sm)',
};

const truncatedWarningStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-warning)',
  color: '#000000',
  fontSize: 'var(--prismiq-font-size-xs)',
  textAlign: 'center',
};

const toolbarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  backgroundColor: 'var(--prismiq-color-surface)',
};

const toolbarLeftStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
};

const toolbarRightStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
};

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton(): JSX.Element {
  return (
    <div style={loadingStyles}>
      <div
        style={{
          width: 24,
          height: 24,
          border: '2px solid var(--prismiq-color-border)',
          borderTopColor: 'var(--prismiq-color-primary)',
          borderRadius: '50%',
          animation: 'prismiq-spin 0.6s linear infinite',
        }}
      />
      <span>Loading results...</span>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Data grid component for displaying query results.
 *
 * @example
 * ```tsx
 * <ResultsTable
 *   result={queryResult}
 *   loading={isLoading}
 *   error={error}
 *   pageSize={25}
 *   sortable
 *   onSort={(column, direction) => handleSort(column, direction)}
 *   onRowClick={(row, index) => handleRowClick(row, index)}
 * />
 * ```
 */
export function ResultsTable({
  result,
  loading = false,
  error = null,
  pageSize: initialPageSize = 25,
  sortable = false,
  onSort,
  onRowClick,
  onCellClick,
  formatters,
  className,
  style,
}: ResultsTableProps): JSX.Element {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle sort
  const handleSort = useCallback(
    (column: string, direction: 'asc' | 'desc') => {
      setSortColumn(column);
      setSortDirection(direction);
      onSort?.(column, direction);
    },
    [onSort]
  );

  // Handle cell click
  const handleCellClick = useCallback(
    (value: unknown, columnIndex: number, rowIndex: number) => {
      if (!onCellClick || !result) return;
      const column = result.columns[columnIndex];
      if (column) {
        onCellClick(value, column, rowIndex);
      }
    },
    [onCellClick, result]
  );

  // Convert formatters from column names to indices
  const formattersByIndex = useMemo(() => {
    if (!formatters || !result) return undefined;
    const byIndex: Record<number, (value: unknown) => string> = {};
    result.columns.forEach((column, index) => {
      if (formatters[column]) {
        byIndex[index] = formatters[column];
      }
    });
    return byIndex;
  }, [formatters, result]);

  // Sort and paginate rows
  const paginatedRows = useMemo(() => {
    if (!result) return [];

    // Apply client-side sorting if sortColumn is set
    let sortedRows = result.rows;
    if (sortColumn) {
      const columnIndex = result.columns.indexOf(sortColumn);
      if (columnIndex >= 0) {
        sortedRows = [...result.rows].sort((a, b) => {
          const aVal = a[columnIndex];
          const bVal = b[columnIndex];

          // Handle nulls - always sort to end
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;

          // Numeric comparison
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
          }

          // String comparison (case-insensitive)
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          const comparison = aStr.localeCompare(bStr);
          return sortDirection === 'asc' ? comparison : -comparison;
        });
      }
    }

    const startIndex = (currentPage - 1) * pageSize;
    return sortedRows.slice(startIndex, startIndex + pageSize);
  }, [result, currentPage, pageSize, sortColumn, sortDirection]);

  // Reset to first page when results change
  useEffect(() => {
    setCurrentPage(1);
  }, [result?.row_count]);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  }, []);

  // Handle CSV export
  const handleExportCSV = useCallback(() => {
    if (!result) return;
    const csv = convertToCSV(result);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `export-${timestamp}.csv`, 'text/csv;charset=utf-8;');
  }, [result]);

  // Handle JSON export
  const handleExportJSON = useCallback(() => {
    if (!result) return;
    // Convert to array of objects for easier consumption
    const data = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      result.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
    const json = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadFile(json, `export-${timestamp}.json`, 'application/json');
  }, [result]);

  // Render states
  if (loading) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={errorStyles}>
          <Icon name="error" size={32} />
          <div>
            <strong>Query Error</strong>
          </div>
          <div style={{ fontSize: 'var(--prismiq-font-size-sm)' }}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={emptyStyles}>
          <Icon name="table" size={32} />
          <div>No results</div>
          <div style={{ fontSize: 'var(--prismiq-font-size-xs)' }}>
            Execute a query to see results
          </div>
        </div>
      </div>
    );
  }

  if (result.row_count === 0) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div style={emptyStyles}>
          <Icon name="table" size={32} />
          <div>No rows returned</div>
          <div style={{ fontSize: 'var(--prismiq-font-size-xs)' }}>
            The query executed successfully but returned no data
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      {result.truncated && (
        <div style={truncatedWarningStyles}>
          Results truncated. Showing {result.row_count.toLocaleString()} rows.
        </div>
      )}

      {/* Toolbar with row count and export buttons */}
      <div style={toolbarStyles}>
        <div style={toolbarLeftStyles}>
          <Icon name="table" size={14} />
          <span>
            {result.row_count.toLocaleString()} row{result.row_count !== 1 ? 's' : ''}
            {result.columns.length > 0 && ` × ${result.columns.length} column${result.columns.length !== 1 ? 's' : ''}`}
          </span>
          {result.execution_time_ms !== undefined && (
            <span style={{ borderLeft: '1px solid var(--prismiq-color-border)', paddingLeft: 'var(--prismiq-spacing-sm)' }}>
              {result.execution_time_ms < 1000
                ? `${Math.round(result.execution_time_ms)}ms`
                : `${(result.execution_time_ms / 1000).toFixed(2)}s`}
            </span>
          )}
        </div>
        <div style={toolbarRightStyles}>
          <Button variant="ghost" size="sm" onClick={handleExportCSV} title="Export as CSV">
            <Icon name="download" size={14} />
            <span>CSV</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportJSON} title="Export as JSON">
            <Icon name="download" size={14} />
            <span>JSON</span>
          </Button>
        </div>
      </div>

      <div style={tableContainerStyles}>
        <table style={tableStyles}>
          <TableHeader
            columns={result.columns}
            columnTypes={result.column_types}
            sortable={sortable}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <tbody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={index}
                row={row}
                index={(currentPage - 1) * pageSize + index}
                columnTypes={result.column_types}
                formatters={formattersByIndex}
                onRowClick={onRowClick}
                onCellClick={onCellClick ? handleCellClick : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={result.row_count}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
