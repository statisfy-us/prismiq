/**
 * SortRow component for a single sort condition.
 */

import { useCallback, useMemo, useState, type DragEvent } from 'react';

import type { DatabaseSchema, QueryTable, SortDefinition, SortDirection } from '../../types';
import { Icon, Select, type SelectOption } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface SortRowProps {
  /** The sort definition. */
  sort: SortDefinition;
  /** Tables in the query. */
  tables: QueryTable[];
  /** Database schema. */
  schema: DatabaseSchema;
  /** Index of this sort in the list. */
  index: number;
  /** Callback when the sort changes. */
  onChange: (sort: SortDefinition) => void;
  /** Callback when the sort should be removed. */
  onRemove: () => void;
  /** Callback when drag ends with reorder. */
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  /** Already used columns to prevent duplicates. */
  usedColumns: Array<{ table_id: string; column: string }>;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const rowStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  cursor: 'grab',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const draggingStyles: React.CSSProperties = {
  opacity: 0.5,
  borderColor: 'var(--prismiq-color-primary)',
};

const dragOverStyles: React.CSSProperties = {
  borderColor: 'var(--prismiq-color-primary)',
  backgroundColor: 'var(--prismiq-color-surface-hover)',
};

const priorityStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  backgroundColor: 'var(--prismiq-color-primary)',
  color: 'var(--prismiq-color-text-inverse)',
  borderRadius: 'var(--prismiq-radius-full)',
  fontSize: 'var(--prismiq-font-size-xs)',
  fontWeight: 600,
  flexShrink: 0,
};

const dragHandleStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  cursor: 'grab',
  flexShrink: 0,
};

const columnSelectStyles: React.CSSProperties = {
  flex: 1,
  minWidth: '150px',
};

const directionButtonStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--prismiq-spacing-xs)',
  padding: 'var(--prismiq-spacing-xs) var(--prismiq-spacing-sm)',
  backgroundColor: 'var(--prismiq-color-background)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  color: 'var(--prismiq-color-text)',
  fontSize: 'var(--prismiq-font-size-sm)',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  flexShrink: 0,
  minWidth: '80px',
};

const removeButtonStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-xs)',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 'var(--prismiq-radius-sm)',
  color: 'var(--prismiq-color-text-muted)',
  cursor: 'pointer',
  transition: 'color 0.15s',
  flexShrink: 0,
};

// ============================================================================
// Component
// ============================================================================

/**
 * A single sort row with column and direction.
 */
export function SortRow({
  sort,
  tables,
  schema,
  index,
  onChange,
  onRemove,
  onDragEnd,
  usedColumns,
  className,
}: SortRowProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Build column options excluding already used columns
  const columnOptions = useMemo(() => {
    const options: SelectOption<string>[] = [];

    tables.forEach((table) => {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) return;

      tableSchema.columns.forEach((column) => {
        const isUsed = usedColumns.some(
          (used) =>
            used.table_id === table.id &&
            used.column === column.name &&
            !(sort.table_id === table.id && sort.column === column.name)
        );

        options.push({
          value: `${table.id}.${column.name}`,
          label: `${table.alias ?? table.name}.${column.name}`,
          disabled: isUsed,
        });
      });
    });

    return options;
  }, [tables, schema, usedColumns, sort.table_id, sort.column]);

  const handleColumnChange = useCallback(
    (columnId: string) => {
      const [tableId, columnName] = columnId.split('.');
      if (tableId && columnName) {
        onChange({
          ...sort,
          table_id: tableId,
          column: columnName,
        });
      }
    },
    [sort, onChange]
  );

  const handleDirectionToggle = useCallback(() => {
    const newDirection: SortDirection = sort.direction === 'ASC' ? 'DESC' : 'ASC';
    onChange({ ...sort, direction: newDirection });
  }, [sort, onChange]);

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.effectAllowed = 'move';
      setIsDragging(true);
    },
    [index]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIndex) && fromIndex !== index) {
        onDragEnd(fromIndex, index);
      }
    },
    [index, onDragEnd]
  );

  const currentColumnId = `${sort.table_id}.${sort.column}`;

  return (
    <div
      className={className}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        ...rowStyles,
        ...(isDragging ? draggingStyles : {}),
        ...(isDragOver ? dragOverStyles : {}),
      }}
    >
      <span style={priorityStyles}>{index + 1}</span>

      <span style={dragHandleStyles}>
        <Icon name="drag" size={16} />
      </span>

      <div style={columnSelectStyles}>
        <Select
          value={currentColumnId}
          onChange={handleColumnChange}
          options={columnOptions}
          placeholder="Select column"
          size="sm"
          searchable
        />
      </div>

      <button
        type="button"
        onClick={handleDirectionToggle}
        style={directionButtonStyles}
      >
        <Icon name={sort.direction === 'ASC' ? 'sort-asc' : 'sort-desc'} size={14} />
        {sort.direction}
      </button>

      <button
        type="button"
        onClick={onRemove}
        style={removeButtonStyles}
        aria-label="Remove sort"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
