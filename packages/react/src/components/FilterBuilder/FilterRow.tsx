/**
 * FilterRow component for a single filter condition.
 */

import { useCallback, useMemo } from 'react';

import type {
  CalculatedField,
  DatabaseSchema,
  FilterDefinition,
  FilterOperator,
  QueryTable,
} from '../../types';
import { Icon, Select, type SelectOption } from '../ui';
import { findPresetKey, getDatePresets, type DatePreset } from './datePresets';
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
  /** Calculated fields defined in the query, available for filtering. */
  calculatedFields?: CalculatedField[];
  /** Callback when the filter changes. */
  onChange: (filter: FilterDefinition) => void;
  /** Callback when the filter should be removed. */
  onRemove: () => void;
  /** Month (1-12) when the fiscal year starts. Defaults to 1 (January). */
  fiscalYearStartMonth?: number;
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
  width: '220px',
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

/** Check if a data type is a date/time type. */
function isDateType(dataType?: string): boolean {
  if (!dataType) return false;
  const type = dataType.toLowerCase();
  return type.includes('date') || type.includes('time') || type.includes('timestamp');
}

/**
 * Get available operators based on column data type.
 * For date types, includes date preset options prefixed with 'preset:'.
 */
function getOperatorsForType(
  dataType?: string,
  datePresets?: DatePreset[],
): SelectOption<string>[] {
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
  if (isDateType(dataType)) {
    const standardOps = allOperators.filter((op) =>
      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'].includes(op.value)
    );

    if (!datePresets || datePresets.length === 0) return standardOps;

    // Add separator and date presets
    const separator: SelectOption<string> = {
      value: '---',
      label: '── Date Presets ──',
      disabled: true,
    };
    const presetOptions: SelectOption<string>[] = datePresets.map((p) => ({
      value: `preset:${p.key}`,
      label: p.label,
    }));

    return [...standardOps, separator, ...presetOptions];
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
  calculatedFields,
  onChange,
  onRemove,
  fiscalYearStartMonth = 1,
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

    // Add calculated fields as filterable options with a distinct prefix
    calculatedFields?.forEach((cf) => {
      if (!cf.name) return;
      options.push({
        value: `__calc__.${cf.name}`,
        label: `fx: ${cf.name}`,
      });
    });

    return options;
  }, [tables, schema, calculatedFields]);

  // Get current table for passing to FilterValueInput
  const currentTable = useMemo(
    () => tables.find((t) => t.id === filter.table_id),
    [tables, filter.table_id]
  );

  // Check if the current filter targets a calculated field
  const isCalculatedField = useMemo(
    () => calculatedFields?.some((cf) => cf.name === filter.column) ?? false,
    [calculatedFields, filter.column]
  );

  // Get current column's schema for type-aware operators
  const currentColumnSchema = useMemo(() => {
    if (isCalculatedField) {
      const calcField = calculatedFields?.find((cf) => cf.name === filter.column);
      if (calcField) {
        return { name: filter.column, data_type: calcField.data_type ?? 'numeric', is_nullable: false };
      }
      return undefined;
    }

    if (!currentTable) return undefined;

    const tableSchema = schema.tables.find((t) => t.name === currentTable.name);
    if (!tableSchema) return undefined;

    return tableSchema.columns.find((c) => c.name === filter.column);
  }, [currentTable, schema, filter.column, calculatedFields, isCalculatedField]);

  // Get date presets when the column is a date type
  const datePresets = useMemo(
    () => isDateType(currentColumnSchema?.data_type) ? getDatePresets(fiscalYearStartMonth) : [],
    [currentColumnSchema?.data_type, fiscalYearStartMonth]
  );

  const operatorOptions = useMemo(
    () => getOperatorsForType(currentColumnSchema?.data_type, datePresets),
    [currentColumnSchema, datePresets]
  );

  // Compute the current operator select value (may be a preset key)
  const currentOperatorSelectValue = useMemo(() => {
    if (datePresets.length > 0) {
      const presetKey = findPresetKey(filter.operator, filter.value, fiscalYearStartMonth);
      if (presetKey) return `preset:${presetKey}`;
    }
    return filter.operator;
  }, [filter.operator, filter.value, datePresets, fiscalYearStartMonth]);

  const handleColumnChange = useCallback(
    (columnId: string) => {
      const [rawTableId, columnName] = columnId.split('.');
      if (rawTableId && columnName) {
        // Map __calc__ back to first table's ID for the backend
        const tableId = rawTableId === '__calc__' ? (tables[0]?.id ?? 't1') : rawTableId;
        onChange({
          ...filter,
          table_id: tableId,
          column: columnName,
          operator: 'eq',
          // Reset value when column changes
          value: undefined,
        });
      }
    },
    [filter, onChange]
  );

  const handleOperatorChange = useCallback(
    (selected: string) => {
      // Handle date preset selection
      if (selected.startsWith('preset:')) {
        const presetKey = selected.slice(7);
        const preset = datePresets.find((p) => p.key === presetKey);
        if (preset) {
          onChange({ ...filter, operator: preset.operator as FilterOperator, value: preset.defaultValue });
          return;
        }
      }

      const operator = selected as FilterOperator;
      // Reset value for null operators
      const value = operator === 'is_null' || operator === 'is_not_null' ? undefined : filter.value;
      onChange({ ...filter, operator, value });
    },
    [filter, onChange, datePresets]
  );

  const handleValueChange = useCallback(
    (value: unknown) => {
      onChange({ ...filter, value });
    },
    [filter, onChange]
  );

  const currentColumnId = isCalculatedField
    ? `__calc__.${filter.column}`
    : `${filter.table_id}.${filter.column}`;

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
        <Select<string>
          value={currentOperatorSelectValue}
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
          tableName={isCalculatedField ? undefined : currentTable?.name}
          columnName={isCalculatedField ? undefined : filter.column}
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
