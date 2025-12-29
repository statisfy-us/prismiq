/**
 * JoinRow component for configuring a single join.
 */

import { useCallback, useMemo } from 'react';

import type { DatabaseSchema, JoinDefinition, JoinType, QueryTable } from '../../types';
import { Button, Icon, Select } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface JoinRowProps {
  /** The join definition. */
  join: JoinDefinition;
  /** Tables in the query. */
  tables: QueryTable[];
  /** Database schema. */
  schema: DatabaseSchema;
  /** Row index. */
  index: number;
  /** Callback when join changes. */
  onChange: (join: JoinDefinition) => void;
  /** Callback when join is removed. */
  onRemove: () => void;
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
  flexWrap: 'wrap',
};

const selectWrapperStyles: React.CSSProperties = {
  minWidth: '120px',
};

const labelStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text-muted)',
  flexShrink: 0,
};

// ============================================================================
// Constants
// ============================================================================

const JOIN_TYPE_OPTIONS: Array<{ value: JoinType; label: string }> = [
  { value: 'INNER', label: 'Inner Join' },
  { value: 'LEFT', label: 'Left Join' },
  { value: 'RIGHT', label: 'Right Join' },
  { value: 'FULL', label: 'Full Join' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * A single join row in the join builder.
 */
export function JoinRow({
  join,
  tables,
  schema,
  index,
  onChange,
  onRemove,
}: JoinRowProps): JSX.Element {
  // Get table options
  const tableOptions = useMemo(() => {
    return tables.map((t) => ({
      value: t.id,
      label: t.alias ?? t.name,
    }));
  }, [tables]);

  // Get columns for from table
  const fromColumnOptions = useMemo(() => {
    const table = tables.find((t) => t.id === join.from_table_id);
    if (!table) return [];

    const tableSchema = schema.tables.find((t) => t.name === table.name);
    if (!tableSchema) return [];

    return tableSchema.columns.map((col) => ({
      value: col.name,
      label: col.name,
    }));
  }, [tables, schema, join.from_table_id]);

  // Get columns for to table
  const toColumnOptions = useMemo(() => {
    const table = tables.find((t) => t.id === join.to_table_id);
    if (!table) return [];

    const tableSchema = schema.tables.find((t) => t.name === table.name);
    if (!tableSchema) return [];

    return tableSchema.columns.map((col) => ({
      value: col.name,
      label: col.name,
    }));
  }, [tables, schema, join.to_table_id]);

  const handleFromTableChange = useCallback(
    (value: string) => {
      const table = tables.find((t) => t.id === value);
      const tableSchema = table
        ? schema.tables.find((t) => t.name === table.name)
        : null;
      const firstColumn = tableSchema?.columns[0]?.name ?? '';

      onChange({
        ...join,
        from_table_id: value,
        from_column: firstColumn,
      });
    },
    [join, onChange, tables, schema]
  );

  const handleFromColumnChange = useCallback(
    (value: string) => {
      onChange({ ...join, from_column: value });
    },
    [join, onChange]
  );

  const handleToTableChange = useCallback(
    (value: string) => {
      const table = tables.find((t) => t.id === value);
      const tableSchema = table
        ? schema.tables.find((t) => t.name === table.name)
        : null;
      const firstColumn = tableSchema?.columns[0]?.name ?? '';

      onChange({
        ...join,
        to_table_id: value,
        to_column: firstColumn,
      });
    },
    [join, onChange, tables, schema]
  );

  const handleToColumnChange = useCallback(
    (value: string) => {
      onChange({ ...join, to_column: value });
    },
    [join, onChange]
  );

  const handleJoinTypeChange = useCallback(
    (value: string) => {
      onChange({ ...join, join_type: value as JoinType });
    },
    [join, onChange]
  );

  return (
    <div style={rowStyles}>
      <span style={labelStyles}>{index + 1}.</span>

      {/* Join Type */}
      <div style={selectWrapperStyles}>
        <Select
          value={join.join_type}
          options={JOIN_TYPE_OPTIONS}
          onChange={handleJoinTypeChange}
          size="sm"
        />
      </div>

      {/* From Table */}
      <div style={selectWrapperStyles}>
        <Select
          value={join.from_table_id}
          options={tableOptions}
          onChange={handleFromTableChange}
          placeholder="From table"
          size="sm"
        />
      </div>

      {/* From Column */}
      <div style={selectWrapperStyles}>
        <Select
          value={join.from_column}
          options={fromColumnOptions}
          onChange={handleFromColumnChange}
          placeholder="Column"
          size="sm"
        />
      </div>

      <span style={labelStyles}>=</span>

      {/* To Table */}
      <div style={selectWrapperStyles}>
        <Select
          value={join.to_table_id}
          options={tableOptions}
          onChange={handleToTableChange}
          placeholder="To table"
          size="sm"
        />
      </div>

      {/* To Column */}
      <div style={selectWrapperStyles}>
        <Select
          value={join.to_column}
          options={toColumnOptions}
          onChange={handleToColumnChange}
          placeholder="Column"
          size="sm"
        />
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        aria-label="Remove join"
        style={{ marginLeft: 'auto' }}
      >
        <Icon name="x" size={14} />
      </Button>
    </div>
  );
}
