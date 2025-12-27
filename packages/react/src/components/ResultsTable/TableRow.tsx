/**
 * TableRow component for rendering a single data row.
 */

import { TableCell } from './TableCell';

// ============================================================================
// Types
// ============================================================================

export interface TableRowProps {
  /** Row data. */
  row: unknown[];
  /** Row index. */
  index: number;
  /** Column data types. */
  columnTypes?: string[];
  /** Custom formatters by column index or name. */
  formatters?: Record<string | number, (value: unknown) => string>;
  /** Callback when the row is clicked. */
  onRowClick?: (row: unknown[], index: number) => void;
  /** Callback when a cell is clicked. */
  onCellClick?: (value: unknown, columnIndex: number, rowIndex: number) => void;
  /** Whether the row is selected. */
  isSelected?: boolean;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const rowStyles: React.CSSProperties = {
  transition: 'background-color 0.1s',
};

const hoverStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface-hover)',
};

const selectedStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
};

const clickableStyles: React.CSSProperties = {
  cursor: 'pointer',
};

// ============================================================================
// Component
// ============================================================================

/**
 * A single data row in the results table.
 */
export function TableRow({
  row,
  index,
  columnTypes,
  formatters,
  onRowClick,
  onCellClick,
  isSelected = false,
  className,
}: TableRowProps): JSX.Element {
  const handleRowClick = () => {
    onRowClick?.(row, index);
  };

  const handleCellClick = (value: unknown, columnIndex: number) => {
    onCellClick?.(value, columnIndex, index);
  };

  return (
    <tr
      className={className}
      onClick={onRowClick ? handleRowClick : undefined}
      style={{
        ...rowStyles,
        ...(isSelected ? selectedStyles : {}),
        ...(onRowClick ? clickableStyles : {}),
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = hoverStyles.backgroundColor ?? '';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.backgroundColor = '';
        }
      }}
    >
      {row.map((cell, cellIndex) => (
        <TableCell
          key={cellIndex}
          value={cell}
          columnType={columnTypes?.[cellIndex]}
          formatter={formatters?.[cellIndex]}
          onClick={onCellClick ? () => handleCellClick(cell, cellIndex) : undefined}
        />
      ))}
    </tr>
  );
}
