/**
 * FilterRow component for a single filter condition.
 */

import { useCallback, useMemo } from 'react';

import type {
  DatabaseSchema,
  FilterDefinition,
  FilterOperator,
  QueryTable,
} from '../../types';
import { Icon, Select, type SelectOption } from '../ui';
import { FilterValueInput } from './FilterValueInput';

// ============================================================================
// Types
// ============================================================================

export interface FilterRowProps {
  /** The filter definition. */
  filter: FilterDefinition;
  /** Tables in the query. */
  tables: QueryTable[];
  /** Database schema. */
  schema: DatabaseSchema;
  /** Callback when the filter changes. */
  onChange: (filter: FilterDefinition) => void;
  /** Callback when the filter should be removed. */
  onRemove: () => void;
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
};

const columnSelectStyles: React.CSSProperties = {
  width: '200px',
  flexShrink: 0,
};

const operatorSelectStyles: React.CSSProperties = {
  width: '140px',
  flexShrink: 0,
};

const valueInputStyles: React.CSSProperties = {
  flex: 1,
  minWidth: '150px',
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

const allOperators: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'like', label: 'LIKE' },
  { value: 'ilike', label: 'ILIKE' },
  { value: 'not_like', label: 'NOT LIKE' },
  { value: 'not_ilike', label: 'NOT ILIKE' },
  { value: 'in_', label: 'IN' },
  { value: 'not_in', label: 'NOT IN' },
  { value: 'in_or_null', label: 'IN OR NULL' },
  { value: 'between', label: 'BETWEEN' },
  { value: 'is_null', label: 'IS NULL' },
  { value: 'is_not_null', label: 'IS NOT NULL' },
];

/**
 * Get available operators based on column data type.
 */
function getOperatorsForType(dataType?: string): SelectOption<FilterOperator>[] {
  if (!dataType) return allOperators;

  const type = dataType.toLowerCase();

  // Numeric types
  if (
    type.includes('int') ||
    type.includes('numeric') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double') ||
    type.includes('real')
  ) {
    return allOperators.filter((op) =>
      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in_', 'not_in', 'in_or_null', 'between', 'is_null', 'is_not_null'].includes(op.value)
    );
  }

  // Date/time types
  if (type.includes('date') || type.includes('time') || type.includes('timestamp')) {
    return allOperators.filter((op) =>
      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in_', 'not_in', 'in_or_null', 'between', 'is_null', 'is_not_null'].includes(op.value)
    );
  }

  // Boolean
  if (type === 'boolean' || type === 'bool') {
    return allOperators.filter((op) =>
      ['eq', 'neq', 'is_null', 'is_not_null'].includes(op.value)
    );
  }

  // String types - all operators (including not_like, not_ilike)
  return allOperators;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A single filter row with column, operator, and value inputs.
 */
export function FilterRow({
  filter,
  tables,
  schema,
  onChange,
  onRemove,
  className,
}: FilterRowProps): JSX.Element {
  // Build column options grouped by table
  const columnOptions = useMemo(() => {
    const options: SelectOption<string>[] = [];

    tables.forEach((table) => {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) return;

      tableSchema.columns.forEach((column) => {
        options.push({
          value: `${table.id}.${column.name}`,
          label: `${table.alias ?? table.name}.${column.name}`,
        });
      });
    });

    return options;
  }, [tables, schema]);

  // Get current table for passing to FilterValueInput
  const currentTable = useMemo(
    () => tables.find((t) => t.id === filter.table_id),
    [tables, filter.table_id]
  );

  // Get current column's schema for type-aware operators
  const currentColumnSchema = useMemo(() => {
    if (!currentTable) return undefined;

    const tableSchema = schema.tables.find((t) => t.name === currentTable.name);
    if (!tableSchema) return undefined;

    return tableSchema.columns.find((c) => c.name === filter.column);
  }, [currentTable, schema, filter.column]);

  const operatorOptions = useMemo(
    () => getOperatorsForType(currentColumnSchema?.data_type),
    [currentColumnSchema]
  );

  const handleColumnChange = useCallback(
    (columnId: string) => {
      const [tableId, columnName] = columnId.split('.');
      if (tableId && columnName) {
        onChange({
          ...filter,
          table_id: tableId,
          column: columnName,
          // Reset value when column changes
          value: undefined,
        });
      }
    },
    [filter, onChange]
  );

  const handleOperatorChange = useCallback(
    (operator: FilterOperator) => {
      // Reset value for null operators
      const value = operator === 'is_null' || operator === 'is_not_null' ? undefined : filter.value;
      onChange({ ...filter, operator, value });
    },
    [filter, onChange]
  );

  const handleValueChange = useCallback(
    (value: unknown) => {
      onChange({ ...filter, value });
    },
    [filter, onChange]
  );

  const currentColumnId = `${filter.table_id}.${filter.column}`;

  return (
    <div className={className} style={rowStyles}>
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

      <div style={operatorSelectStyles}>
        <Select
          value={filter.operator}
          onChange={handleOperatorChange}
          options={operatorOptions}
          size="sm"
        />
      </div>

      <div style={valueInputStyles}>
        <FilterValueInput
          operator={filter.operator}
          value={filter.value}
          onChange={handleValueChange}
          dataType={currentColumnSchema?.data_type}
          tableName={currentTable?.name}
          columnName={filter.column}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        style={removeButtonStyles}
        aria-label="Remove filter"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
