/**
 * ResultsTable component for displaying query results.
 */

import { useCallback, useMemo, useState } from 'react';

import type { QueryResult } from '../../types';
import { Icon } from '../ui';
import { Pagination } from './Pagination';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';

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
};

const tableContainerStyles: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  maxHeight: '500px',
};

const tableStyles: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
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

  // Paginate rows
  const paginatedRows = useMemo(() => {
    if (!result) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return result.rows.slice(startIndex, startIndex + pageSize);
  }, [result, currentPage, pageSize]);

  // Reset to first page when results change
  useMemo(() => {
    setCurrentPage(1);
  }, [result?.row_count]);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  }, []);

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
