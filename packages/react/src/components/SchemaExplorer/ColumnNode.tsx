/**
 * ColumnNode component for displaying a column in the schema explorer.
 */

import { useCallback, type MouseEvent, type DragEvent } from 'react';

import type { ColumnSchema, TableSchema } from '../../types';
import { Icon, Tooltip } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface ColumnNodeProps {
  /** The column schema. */
  column: ColumnSchema;
  /** The parent table schema. */
  table: TableSchema;
  /** Whether this column is selected. */
  isSelected?: boolean;
  /** Callback when column is clicked. */
  onClick?: (table: TableSchema, column: ColumnSchema) => void;
  /** Callback when column drag starts. */
  onDragStart?: (table: TableSchema, column: ColumnSchema) => void;
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
  padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
  paddingLeft: 'var(--prismiq-spacing-xl)',
  cursor: 'pointer',
  transition: 'background-color 0.1s',
  userSelect: 'none',
};

const selectedStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-surface)',
};

const iconStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  flexShrink: 0,
};

const nameStyles: React.CSSProperties = {
  flex: 1,
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const typeStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
  fontFamily: 'var(--prismiq-font-mono)',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the icon name for a column based on its properties.
 */
function getColumnIcon(column: ColumnSchema): 'key' | 'link' | 'column' {
  if (column.is_primary_key) return 'key';
  // Note: foreign key detection would come from relationships, not column itself
  return 'column';
}

/**
 * Format the data type for display.
 */
function formatDataType(dataType: string): string {
  // Shorten common PostgreSQL types
  const typeMap: Record<string, string> = {
    'character varying': 'varchar',
    'timestamp without time zone': 'timestamp',
    'timestamp with time zone': 'timestamptz',
    'double precision': 'double',
    'boolean': 'bool',
    'integer': 'int',
    'bigint': 'int8',
    'smallint': 'int2',
  };
  return typeMap[dataType] ?? dataType;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single column node in the schema explorer tree.
 */
export function ColumnNode({
  column,
  table,
  isSelected = false,
  onClick,
  onDragStart,
  className,
}: ColumnNodeProps): JSX.Element {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClick?.(table, column);
    },
    [onClick, table, column]
  );

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData(
        'application/prismiq-column',
        JSON.stringify({ table: table.name, column: column.name })
      );
      e.dataTransfer.effectAllowed = 'copy';
      onDragStart?.(table, column);
    },
    [onDragStart, table, column]
  );

  const iconName = getColumnIcon(column);
  const formattedType = formatDataType(column.data_type);

  return (
    <div
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      className={className}
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(table, column);
        }
      }}
      style={{
        ...nodeStyles,
        ...(isSelected ? selectedStyles : {}),
      }}
    >
      <Tooltip
        content={
          column.is_primary_key
            ? 'Primary Key'
            : column.is_nullable
              ? 'Nullable column'
              : 'Required column'
        }
        position="right"
        delay={500}
      >
        <span style={iconStyles}>
          <Icon name={iconName} size={14} />
        </span>
      </Tooltip>
      <span style={nameStyles}>{column.name}</span>
      <span style={typeStyles}>{formattedType}</span>
    </div>
  );
}
