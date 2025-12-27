/**
 * TableNode component for displaying a table in the schema explorer.
 */

import { useCallback, useState, type MouseEvent, type KeyboardEvent } from 'react';

import type { ColumnSchema, TableSchema } from '../../types';
import { Icon } from '../ui';
import { ColumnNode } from './ColumnNode';

// ============================================================================
// Types
// ============================================================================

export interface TableNodeProps {
  /** The table schema. */
  table: TableSchema;
  /** Whether the table is currently selected. */
  isSelected?: boolean;
  /** Array of selected column identifiers. */
  selectedColumns?: Array<{ table: string; column: string }>;
  /** Callback when table is clicked. */
  onTableClick?: (table: TableSchema) => void;
  /** Callback when a column is clicked. */
  onColumnClick?: (table: TableSchema, column: ColumnSchema) => void;
  /** Callback when column drag starts. */
  onColumnDragStart?: (table: TableSchema, column: ColumnSchema) => void;
  /** Whether the tree is collapsible. */
  collapsible?: boolean;
  /** Initial expanded state. */
  defaultExpanded?: boolean;
  /** Search filter to highlight matching items. */
  searchFilter?: string;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const nodeStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  userSelect: 'none',
};

const selectedStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
};

const chevronStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  transition: 'transform 0.15s',
  flexShrink: 0,
};

const iconStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-primary)',
  flexShrink: 0,
};

const nameStyles: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--prismiq-font-size-base)',
  fontWeight: 500,
  color: 'var(--prismiq-color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const countStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

const columnsContainerStyles: React.CSSProperties = {
  overflow: 'hidden',
};

// ============================================================================
// Component
// ============================================================================

/**
 * A table node in the schema explorer tree with expandable columns.
 */
export function TableNode({
  table,
  isSelected = false,
  selectedColumns = [],
  onTableClick,
  onColumnClick,
  onColumnDragStart,
  collapsible = true,
  defaultExpanded = false,
  searchFilter = '',
  className,
}: TableNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Filter columns based on search
  const filteredColumns = searchFilter
    ? table.columns.filter((col) =>
        col.name.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : table.columns;

  // Check if table name matches search
  const tableMatchesSearch =
    !searchFilter || table.name.toLowerCase().includes(searchFilter.toLowerCase());

  // If searching and table doesn't match but has matching columns, expand
  const shouldExpand = searchFilter
    ? filteredColumns.length > 0 || tableMatchesSearch
    : isExpanded;

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (collapsible) {
        setIsExpanded((prev) => !prev);
      }
      onTableClick?.(table);
    },
    [collapsible, onTableClick, table]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (collapsible) {
          setIsExpanded((prev) => !prev);
        }
        onTableClick?.(table);
      } else if (e.key === 'ArrowRight' && !isExpanded) {
        e.preventDefault();
        setIsExpanded(true);
      } else if (e.key === 'ArrowLeft' && isExpanded) {
        e.preventDefault();
        setIsExpanded(false);
      }
    },
    [collapsible, onTableClick, table, isExpanded]
  );

  const isColumnSelected = (columnName: string): boolean =>
    selectedColumns.some(
      (sel) => sel.table === table.name && sel.column === columnName
    );

  // Don't render if searching and no matches
  if (searchFilter && !tableMatchesSearch && filteredColumns.length === 0) {
    return <></>;
  }

  return (
    <div role="treeitem" aria-expanded={shouldExpand} className={className}>
      <div
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          ...nodeStyles,
          ...(isSelected ? selectedStyles : {}),
        }}
      >
        {collapsible && (
          <span
            style={{
              ...chevronStyles,
              transform: shouldExpand ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            <Icon name="chevron-right" size={14} />
          </span>
        )}
        <span style={iconStyles}>
          <Icon name="table" size={16} />
        </span>
        <span style={nameStyles}>{table.name}</span>
        <span style={countStyles}>({table.columns.length})</span>
      </div>

      {shouldExpand && (
        <div role="group" style={columnsContainerStyles}>
          {filteredColumns.map((column) => (
            <ColumnNode
              key={column.name}
              column={column}
              table={table}
              isSelected={isColumnSelected(column.name)}
              onClick={onColumnClick}
              onDragStart={onColumnDragStart}
            />
          ))}
        </div>
      )}
    </div>
  );
}
