/**
 * ColumnSelector component for selecting and ordering columns in a query.
 */

import { useCallback, type DragEvent } from 'react';

import type { ColumnSelection, DatabaseSchema, QueryTable } from '../../types';
import { Icon } from '../ui';
import { SelectedColumn } from './SelectedColumn';

// ============================================================================
// Types
// ============================================================================

export interface ColumnSelectorProps {
  /** Tables in the query. */
  tables: QueryTable[];
  /** Selected columns. */
  columns: ColumnSelection[];
  /** Callback when columns change. */
  onChange: (columns: ColumnSelection[]) => void;
  /** Database schema for type information. */
  schema: DatabaseSchema;
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
  gap: 'var(--prismiq-spacing-sm)',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--prismiq-spacing-xs)',
};

const titleStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
};

const countStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

const dropZoneStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-lg)',
  border: '2px dashed var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  backgroundColor: 'var(--prismiq-color-surface)',
  color: 'var(--prismiq-color-text-muted)',
  fontSize: 'var(--prismiq-font-size-sm)',
  textAlign: 'center',
  transition: 'border-color 0.15s, background-color 0.15s',
};

const listStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-sm)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Column selector component for selecting and ordering columns.
 *
 * @example
 * ```tsx
 * <ColumnSelector
 *   tables={query.tables}
 *   columns={query.columns}
 *   onChange={(columns) => setQuery({ ...query, columns })}
 *   schema={schema}
 * />
 * ```
 */
export function ColumnSelector({
  tables,
  columns,
  onChange,
  schema,
  className,
  style,
}: ColumnSelectorProps): JSX.Element {
  // Get table schema for a given table ID
  const getTableSchema = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return undefined;
      return schema.tables.find((t) => t.name === table.name);
    },
    [tables, schema]
  );

  // Get table by ID
  const getTable = useCallback(
    (tableId: string) => {
      return tables.find((t) => t.id === tableId);
    },
    [tables]
  );

  // Handle removing a column
  const handleRemove = useCallback(
    (index: number) => {
      const newColumns = [...columns];
      newColumns.splice(index, 1);
      onChange(newColumns);
    },
    [columns, onChange]
  );

  // Handle updating a column
  const handleUpdate = useCallback(
    (index: number, column: ColumnSelection) => {
      const newColumns = [...columns];
      newColumns[index] = column;
      onChange(newColumns);
    },
    [columns, onChange]
  );

  // Handle reordering columns via drag and drop
  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newColumns = [...columns];
      const [removed] = newColumns.splice(fromIndex, 1);
      if (removed) {
        newColumns.splice(toIndex, 0, removed);
        onChange(newColumns);
      }
    },
    [columns, onChange]
  );

  // Handle dropping a column from the schema explorer
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('application/prismiq-column');
      if (!data) return;

      try {
        const { table: tableName, column: columnName } = JSON.parse(data) as {
          table: string;
          column: string;
        };

        // Find the table in the query
        const table = tables.find((t) => t.name === tableName);
        if (!table) {
          console.warn(`Table "${tableName}" is not in the query`);
          return;
        }

        // Check if column is already selected
        const alreadySelected = columns.some(
          (c) => c.table_id === table.id && c.column === columnName
        );
        if (alreadySelected) {
          return;
        }

        // Add the column
        const newColumn: ColumnSelection = {
          table_id: table.id,
          column: columnName,
          aggregation: 'none',
        };
        onChange([...columns, newColumn]);
      } catch {
        // Invalid data, ignore
      }
    },
    [tables, columns, onChange]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const isEmpty = columns.length === 0;

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={headerStyles}>
        <span style={titleStyles}>
          <Icon
            name="column"
            size={14}
            style={{
              marginRight: 'var(--prismiq-spacing-xs)',
              verticalAlign: 'middle',
            }}
          />
          Selected Columns
        </span>
        <span style={countStyles}>{columns.length} columns</span>
      </div>

      {isEmpty ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={dropZoneStyles}
        >
          <Icon name="column" size={24} />
          <div>Drag columns here from the Schema Explorer</div>
          <div style={{ fontSize: 'var(--prismiq-font-size-xs)' }}>
            or click on columns to add them
          </div>
        </div>
      ) : (
        <div style={listStyles}>
          {columns.map((column, index) => {
            const table = getTable(column.table_id);
            const tableSchema = getTableSchema(column.table_id);

            if (!table) return null;

            return (
              <SelectedColumn
                key={`${column.table_id}-${column.column}-${index}`}
                column={column}
                table={table}
                tableSchema={tableSchema}
                index={index}
                onRemove={() => handleRemove(index)}
                onUpdate={(updated) => handleUpdate(index, updated)}
                onDragEnd={handleDragEnd}
              />
            );
          })}

          {/* Drop zone at the end */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              ...dropZoneStyles,
              padding: 'var(--prismiq-spacing-sm)',
              minHeight: '40px',
            }}
          >
            <span>Drop column here to add</span>
          </div>
        </div>
      )}
    </div>
  );
}
