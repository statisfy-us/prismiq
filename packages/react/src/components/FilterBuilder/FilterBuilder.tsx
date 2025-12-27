/**
 * FilterBuilder component for building filter conditions.
 */

import { useCallback } from 'react';

import type { DatabaseSchema, FilterDefinition, QueryTable } from '../../types';
import { Button, Icon } from '../ui';
import { FilterRow } from './FilterRow';

// ============================================================================
// Types
// ============================================================================

export interface FilterBuilderProps {
  /** Tables in the query. */
  tables: QueryTable[];
  /** Current filter definitions. */
  filters: FilterDefinition[];
  /** Callback when filters change. */
  onChange: (filters: FilterDefinition[]) => void;
  /** Database schema. */
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

const emptyStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  textAlign: 'center',
  color: 'var(--prismiq-color-text-muted)',
  fontSize: 'var(--prismiq-font-size-sm)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px dashed var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
};

const filtersListStyles: React.CSSProperties = {
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
 * Filter builder component for creating filter conditions.
 *
 * @example
 * ```tsx
 * <FilterBuilder
 *   tables={query.tables}
 *   filters={query.filters ?? []}
 *   onChange={(filters) => setQuery({ ...query, filters })}
 *   schema={schema}
 * />
 * ```
 */
export function FilterBuilder({
  tables,
  filters,
  onChange,
  schema,
  className,
  style,
}: FilterBuilderProps): JSX.Element {
  // Get default table and column for new filter
  const getDefaultFilter = useCallback((): FilterDefinition | null => {
    if (tables.length === 0) return null;

    const firstTable = tables[0];
    if (!firstTable) return null;

    const tableSchema = schema.tables.find((t) => t.name === firstTable.name);
    const firstColumn = tableSchema?.columns[0];

    if (!firstColumn) return null;

    return {
      table_id: firstTable.id,
      column: firstColumn.name,
      operator: 'eq',
      value: undefined,
    };
  }, [tables, schema]);

  const handleAddFilter = useCallback(() => {
    const defaultFilter = getDefaultFilter();
    if (defaultFilter) {
      onChange([...filters, defaultFilter]);
    }
  }, [filters, onChange, getDefaultFilter]);

  const handleUpdateFilter = useCallback(
    (index: number, filter: FilterDefinition) => {
      const newFilters = [...filters];
      newFilters[index] = filter;
      onChange(newFilters);
    },
    [filters, onChange]
  );

  const handleRemoveFilter = useCallback(
    (index: number) => {
      const newFilters = [...filters];
      newFilters.splice(index, 1);
      onChange(newFilters);
    },
    [filters, onChange]
  );

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const isEmpty = filters.length === 0;
  const hasNoTables = tables.length === 0;

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={headerStyles}>
        <span style={titleStyles}>
          <Icon
            name="filter"
            size={14}
            style={{
              marginRight: 'var(--prismiq-spacing-xs)',
              verticalAlign: 'middle',
            }}
          />
          Filters
        </span>
        <span style={countStyles}>
          {filters.length} {filters.length === 1 ? 'filter' : 'filters'}
        </span>
      </div>

      {isEmpty ? (
        <div style={emptyStyles}>
          {hasNoTables ? (
            <>Select a table first to add filters</>
          ) : (
            <>No filters applied. Click "Add Filter" to filter results.</>
          )}
        </div>
      ) : (
        <div style={filtersListStyles}>
          {filters.map((filter, index) => (
            <FilterRow
              key={`${filter.table_id}-${filter.column}-${index}`}
              filter={filter}
              tables={tables}
              schema={schema}
              onChange={(updated) => handleUpdateFilter(index, updated)}
              onRemove={() => handleRemoveFilter(index)}
            />
          ))}
        </div>
      )}

      <div style={actionsStyles}>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Icon name="plus" size={14} />}
          onClick={handleAddFilter}
          disabled={hasNoTables}
        >
          Add Filter
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
