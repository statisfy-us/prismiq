/**
 * TableCell component for rendering a single cell in the results table.
 */

import { useMemo } from 'react';

import { Tooltip } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface TableCellProps {
  /** Cell value. */
  value: unknown;
  /** Column data type. */
  columnType?: string;
  /** Custom formatter function. */
  formatter?: (value: unknown) => string;
  /** Maximum width before truncation. */
  maxWidth?: number;
  /** Callback when cell is clicked. */
  onClick?: () => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const cellStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  verticalAlign: 'middle',
  textAlign: 'left',
};

const nullStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  fontStyle: 'italic',
};

const numberStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-mono)',
  textAlign: 'right',
};

const truncatedStyles: React.CSSProperties = {
  maxWidth: '200px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a value for display based on its type.
 */
function formatValue(value: unknown, columnType?: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    // Format numbers with locale
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Format date strings
  if (columnType?.includes('timestamp') || columnType?.includes('date')) {
    const dateStr = String(value);
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        if (columnType?.includes('time')) {
          return date.toLocaleString();
        }
        return date.toLocaleDateString();
      }
    } catch {
      // Fall through to string
    }
  }

  // Format arrays/objects as JSON
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Check if value is numeric type.
 */
function isNumericType(columnType?: string): boolean {
  if (!columnType) return false;
  const type = columnType.toLowerCase();
  return (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single cell in the results table.
 */
export function TableCell({
  value,
  columnType,
  formatter,
  maxWidth = 200,
  onClick,
  className,
}: TableCellProps): JSX.Element {
  const isNull = value === null || value === undefined;
  const isNumeric = isNumericType(columnType);

  const formattedValue = useMemo(() => {
    if (formatter) {
      return formatter(value);
    }
    return formatValue(value, columnType);
  }, [value, columnType, formatter]);

  const needsTruncation = formattedValue.length > 50;

  const cellContent = (
    <td
      className={className}
      onClick={onClick}
      style={{
        ...cellStyles,
        ...(isNull ? nullStyles : {}),
        ...(isNumeric ? numberStyles : {}),
        ...(needsTruncation ? { ...truncatedStyles, maxWidth } : {}),
        ...(onClick ? { cursor: 'pointer' } : {}),
      }}
    >
      {formattedValue}
    </td>
  );

  if (needsTruncation) {
    return (
      <Tooltip content={formattedValue} position="top" delay={200}>
        {cellContent}
      </Tooltip>
    );
  }

  return cellContent;
}
