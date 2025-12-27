/**
 * TableHeader component for rendering the table header row.
 */

import { Icon } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface TableHeaderProps {
  /** Column names. */
  columns: string[];
  /** Column data types. */
  columnTypes?: string[];
  /** Whether columns are sortable. */
  sortable?: boolean;
  /** Currently sorted column. */
  sortColumn?: string;
  /** Current sort direction. */
  sortDirection?: 'asc' | 'desc';
  /** Callback when a column header is clicked for sorting. */
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const headerRowStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
};

const headerCellStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  borderBottom: '2px solid var(--prismiq-color-border)',
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  backgroundColor: 'var(--prismiq-color-surface)',
  zIndex: 1,
};

const sortableStyles: React.CSSProperties = {
  cursor: 'pointer',
  userSelect: 'none',
};

const headerContentStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs)',
};

const sortIconStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
};

const activeSortIconStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-primary)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Table header row with optional sorting.
 */
export function TableHeader({
  columns,
  sortable = false,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: TableHeaderProps): JSX.Element {
  const handleHeaderClick = (column: string) => {
    if (!sortable || !onSort) return;

    // Toggle direction if same column, otherwise default to asc
    const newDirection =
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column, newDirection);
  };

  return (
    <thead className={className}>
      <tr style={headerRowStyles}>
        {columns.map((column) => {
          const isActive = sortColumn === column;

          return (
            <th
              key={column}
              onClick={() => handleHeaderClick(column)}
              style={{
                ...headerCellStyles,
                ...(sortable ? sortableStyles : {}),
              }}
            >
              <div style={headerContentStyles}>
                <span>{column}</span>
                {sortable && (
                  <span
                    style={isActive ? activeSortIconStyles : sortIconStyles}
                  >
                    {isActive ? (
                      <Icon
                        name={sortDirection === 'asc' ? 'sort-asc' : 'sort-desc'}
                        size={14}
                      />
                    ) : (
                      <Icon name="sort-asc" size={14} style={{ opacity: 0.3 }} />
                    )}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
