/**
 * SelectedColumn component for displaying a selected column in the query.
 */

import { useCallback, useState, type DragEvent } from 'react';

import type { AggregationType, ColumnSelection, DateTruncInterval, QueryTable, TableSchema } from '../../types';
import { Badge, Icon, Input, Select, type SelectOption } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface SelectedColumnProps {
  /** The column selection. */
  column: ColumnSelection;
  /** The table this column belongs to. */
  table: QueryTable;
  /** The table schema for type information. */
  tableSchema: TableSchema | undefined;
  /** Index of this column in the list. */
  index: number;
  /** Callback when the column should be removed. */
  onRemove: () => void;
  /** Callback when the column selection is updated. */
  onUpdate: (column: ColumnSelection) => void;
  /** Callback when drag ends with reorder. */
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  /** Additional class name. */
  className?: string;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
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

const dragHandleStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  cursor: 'grab',
  flexShrink: 0,
};

const columnInfoStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
  overflow: 'hidden',
};

const columnNameStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-base)',
  fontWeight: 500,
  color: 'var(--prismiq-color-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const tableNameStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

const aggregationStyles: React.CSSProperties = {
  width: '120px',
  flexShrink: 0,
};

const aliasStyles: React.CSSProperties = {
  width: '100px',
  flexShrink: 0,
};

const dateTruncStyles: React.CSSProperties = {
  width: '100px',
  flexShrink: 0,
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
// Constants
// ============================================================================

const aggregationOptions: SelectOption<AggregationType>[] = [
  { value: 'none', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count Distinct' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
];

const dateTruncOptions: SelectOption<DateTruncInterval | ''>[] = [
  { value: '', label: 'No truncate' },
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'hour', label: 'Hour' },
  { value: 'minute', label: 'Minute' },
];

/**
 * Check if a column is a date/timestamp type.
 */
function isDateColumn(dataType: string | undefined): boolean {
  if (!dataType) return false;
  const type = dataType.toLowerCase();
  return type.includes('date') || type.includes('time') || type.includes('timestamp');
}

/**
 * Get aggregation options based on column data type.
 */
function getAggregationOptions(dataType: string | undefined): SelectOption<AggregationType>[] {
  if (!dataType) return aggregationOptions;

  const type = dataType.toLowerCase();

  // Numeric types - all aggregations available
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  ) {
    return aggregationOptions;
  }

  // Date/time types - count, count_distinct, min, max
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return aggregationOptions.filter((opt) =>
      ['none', 'count', 'count_distinct', 'min', 'max'].includes(opt.value)
    );
  }

  // Boolean - count, count_distinct
  if (type === 'boolean' || type === 'bool') {
    return aggregationOptions.filter((opt) =>
      ['none', 'count', 'count_distinct'].includes(opt.value)
    );
  }

  // String/other - count, count_distinct
  return aggregationOptions.filter((opt) =>
    ['none', 'count', 'count_distinct'].includes(opt.value)
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * A selected column in the query with aggregation and alias options.
 */
export function SelectedColumn({
  column,
  table,
  tableSchema,
  index,
  onRemove,
  onUpdate,
  onDragEnd,
  className,
}: SelectedColumnProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Get column schema for type information
  const columnSchema = tableSchema?.columns.find((c) => c.name === column.column);
  const availableAggregations = getAggregationOptions(columnSchema?.data_type);

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

  const handleAggregationChange = useCallback(
    (aggregation: AggregationType) => {
      onUpdate({ ...column, aggregation });
    },
    [column, onUpdate]
  );

  const handleAliasChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const alias = e.target.value || undefined;
      onUpdate({ ...column, alias });
    },
    [column, onUpdate]
  );

  const handleDateTruncChange = useCallback(
    (value: DateTruncInterval | '') => {
      const date_trunc = value || undefined;
      onUpdate({ ...column, date_trunc });
    },
    [column, onUpdate]
  );

  // Check if this column is a date type
  const isDate = isDateColumn(columnSchema?.data_type);

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
        ...containerStyles,
        ...(isDragging ? draggingStyles : {}),
        ...(isDragOver ? dragOverStyles : {}),
      }}
    >
      <span style={dragHandleStyles}>
        <Icon name="drag" size={16} />
      </span>

      <div style={columnInfoStyles}>
        <span style={columnNameStyles}>{column.column}</span>
        <span style={tableNameStyles}>{table.alias ?? table.name}</span>
      </div>

      {columnSchema && (
        <Badge size="sm" variant="default">
          {columnSchema.data_type}
        </Badge>
      )}

      <div style={aggregationStyles}>
        <Select
          value={column.aggregation}
          onChange={handleAggregationChange}
          options={availableAggregations}
          size="sm"
        />
      </div>

      {isDate && (
        <div style={dateTruncStyles}>
          <Select
            value={column.date_trunc ?? ''}
            onChange={handleDateTruncChange}
            options={dateTruncOptions}
            size="sm"
          />
        </div>
      )}

      <div style={aliasStyles}>
        <Input
          inputSize="sm"
          placeholder="Alias"
          value={column.alias ?? ''}
          onChange={handleAliasChange}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        style={removeButtonStyles}
        aria-label={`Remove ${column.column}`}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
