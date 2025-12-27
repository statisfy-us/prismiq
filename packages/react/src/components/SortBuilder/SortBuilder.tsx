/**
 * SortBuilder component for defining sort order.
 */

import { useCallback, useMemo } from 'react';

import type { DatabaseSchema, QueryTable, SortDefinition } from '../../types';
import { Button, Icon } from '../ui';
import { SortRow } from './SortRow';

// ============================================================================
// Types
// ============================================================================

export interface SortBuilderProps {
  /** Tables in the query. */
  tables: QueryTable[];
  /** Current sort definitions. */
  sorts: SortDefinition[];
  /** Callback when sorts change. */
  onChange: (sorts: SortDefinition[]) => void;
  /** Database schema. */
  schema: DatabaseSchema;
  /** Maximum number of sorts allowed. */
  maxSorts?: number;
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

const emptyStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  textAlign: 'center',
  color: 'var(--prismiq-color-text-muted)',
  fontSize: 'var(--prismiq-font-size-sm)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px dashed var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
};

const sortsListStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-sm)',
};

const actionsStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--prismiq-spacing-sm)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Sort builder component for defining sort order.
 *
 * @example
 * ```tsx
 * <SortBuilder
 *   tables={query.tables}
 *   sorts={query.order_by ?? []}
 *   onChange={(sorts) => setQuery({ ...query, order_by: sorts })}
 *   schema={schema}
 *   maxSorts={3}
 * />
 * ```
 */
export function SortBuilder({
  tables,
  sorts,
  onChange,
  schema,
  maxSorts = 3,
  className,
  style,
}: SortBuilderProps): JSX.Element {
  // Track used columns to prevent duplicates
  const usedColumns = useMemo(
    () => sorts.map((s) => ({ table_id: s.table_id, column: s.column })),
    [sorts]
  );

  // Get default sort for new entry
  const getDefaultSort = useCallback((): SortDefinition | null => {
    if (tables.length === 0) return null;

    // Find first unused column
    for (const table of tables) {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      for (const column of tableSchema.columns) {
        const isUsed = usedColumns.some(
          (used) => used.table_id === table.id && used.column === column.name
        );

        if (!isUsed) {
          return {
            table_id: table.id,
            column: column.name,
            direction: 'ASC',
          };
        }
      }
    }

    return null;
  }, [tables, schema, usedColumns]);

  const handleAddSort = useCallback(() => {
    const defaultSort = getDefaultSort();
    if (defaultSort) {
      onChange([...sorts, defaultSort]);
    }
  }, [sorts, onChange, getDefaultSort]);

  const handleUpdateSort = useCallback(
    (index: number, sort: SortDefinition) => {
      const newSorts = [...sorts];
      newSorts[index] = sort;
      onChange(newSorts);
    },
    [sorts, onChange]
  );

  const handleRemoveSort = useCallback(
    (index: number) => {
      const newSorts = [...sorts];
      newSorts.splice(index, 1);
      onChange(newSorts);
    },
    [sorts, onChange]
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newSorts = [...sorts];
      const [removed] = newSorts.splice(fromIndex, 1);
      if (removed) {
        newSorts.splice(toIndex, 0, removed);
        onChange(newSorts);
      }
    },
    [sorts, onChange]
  );

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const isEmpty = sorts.length === 0;
  const hasNoTables = tables.length === 0;
  const canAddMore = sorts.length < maxSorts && getDefaultSort() !== null;

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={headerStyles}>
        <span style={titleStyles}>
          <Icon
            name="sort-asc"
            size={14}
            style={{
              marginRight: 'var(--prismiq-spacing-xs)',
              verticalAlign: 'middle',
            }}
          />
          Sort Order
        </span>
        <span style={countStyles}>
          {sorts.length} / {maxSorts} sorts
        </span>
      </div>

      {isEmpty ? (
        <div style={emptyStyles}>
          {hasNoTables ? (
            <>Select a table first to add sorting</>
          ) : (
            <>No sorting applied. Click "Add Sort" to order results.</>
          )}
        </div>
      ) : (
        <div style={sortsListStyles}>
          {sorts.map((sort, index) => (
            <SortRow
              key={`${sort.table_id}-${sort.column}-${index}`}
              sort={sort}
              tables={tables}
              schema={schema}
              index={index}
              onChange={(updated) => handleUpdateSort(index, updated)}
              onRemove={() => handleRemoveSort(index)}
              onDragEnd={handleDragEnd}
              usedColumns={usedColumns}
            />
          ))}
        </div>
      )}

      <div style={actionsStyles}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Icon name="plus" size={14} />}
          onClick={handleAddSort}
          disabled={!canAddMore}
        >
          Add Sort
        </Button>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="trash" size={14} />}
            onClick={handleClearAll}
          >
            Clear All
          </Button>
        )}
      </div>
    </div>
  );
}
