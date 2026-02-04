/**
 * Guided configuration for Metric widgets.
 *
 * Provides a simplified interface to configure a single aggregated value:
 * - Select a table
 * - Select an aggregation (COUNT, SUM, AVG, etc.)
 * - Select a column (for SUM, AVG, etc.)
 * - Optional filters
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '../../../theme';
import { useSchema } from '../../../hooks/useSchema';
import { Select } from '../../../components/ui/Select';
import { FilterBuilder } from '../../../components/FilterBuilder';
import type {
  DatabaseSchema,
  QueryDefinition,
  AggregationType,
  FilterDefinition,
  ColumnSchema,
} from '../../../types';

export interface MetricConfigProps {
  /** Database schema for table/column selection. */
  schema: DatabaseSchema;
  /** Current query (for restoring state). */
  query: QueryDefinition | null;
  /** Callback when query changes. */
  onChange: (query: QueryDefinition) => void;
}

/**
 * Available aggregations for metrics.
 */
const AGGREGATIONS: { value: AggregationType; label: string; needsColumn: boolean }[] = [
  { value: 'count', label: 'Count of rows', needsColumn: false },
  { value: 'count_distinct', label: 'Count distinct', needsColumn: true },
  { value: 'sum', label: 'Sum', needsColumn: true },
  { value: 'avg', label: 'Average', needsColumn: true },
  { value: 'min', label: 'Minimum', needsColumn: true },
  { value: 'max', label: 'Maximum', needsColumn: true },
];

/**
 * Check if a column is numeric.
 */
function isNumericColumn(col: ColumnSchema): boolean {
  const numericTypes = [
    'integer',
    'bigint',
    'smallint',
    'decimal',
    'numeric',
    'real',
    'double precision',
    'float',
    'int',
    'int4',
    'int8',
    'float4',
    'float8',
  ];
  return numericTypes.some((t) => col.data_type.toLowerCase().includes(t));
}

/**
 * Guided metric configuration component.
 */
export function MetricConfig({
  schema,
  query,
  onChange,
}: MetricConfigProps): JSX.Element {
  const { theme } = useTheme();
  const { getDisplayName } = useSchema();

  // Extract state from existing query if present
  const initialTable = query?.tables[0]?.name ?? '';
  const initialAggregation = query?.columns[0]?.aggregation ?? 'count';
  const initialColumn = query?.columns[0]?.column ?? '*';
  // Remap filter table_ids to 't1' since MetricConfig only uses single-table queries
  const initialFilters = (query?.filters ?? []).map((f) => ({
    ...f,
    table_id: 't1',
  }));

  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [aggregation, setAggregation] = useState<AggregationType>(initialAggregation);
  const [selectedColumn, setSelectedColumn] = useState(initialColumn);
  const [filters, setFilters] = useState<FilterDefinition[]>(initialFilters);

  // Get table options with display names
  const tableOptions = useMemo(() => {
    return schema.tables.map((t) => ({
      value: t.name,
      label: getDisplayName(t.name),
    }));
  }, [schema.tables, getDisplayName]);

  // Get current table schema
  const currentTable = useMemo(() => {
    return schema.tables.find((t) => t.name === selectedTable);
  }, [schema.tables, selectedTable]);

  // Get numeric column options for the selected table
  const columnOptions = useMemo(() => {
    if (!currentTable) return [];
    const numericCols = currentTable.columns.filter(isNumericColumn);
    return numericCols.map((c) => ({
      value: c.name,
      label: `${c.name} (${c.data_type})`,
    }));
  }, [currentTable]);

  // Check if current aggregation needs a column
  const needsColumn = useMemo(() => {
    return AGGREGATIONS.find((a) => a.value === aggregation)?.needsColumn ?? false;
  }, [aggregation]);

  // Build and emit query when config changes
  useEffect(() => {
    if (!selectedTable) return;

    const tableId = 't1';
    const tables = [{ id: tableId, name: selectedTable }];

    // For COUNT(*), use '*' as column, otherwise use selected column
    const column = needsColumn ? selectedColumn : '*';

    // Don't emit if we need a column but don't have one selected
    if (needsColumn && !selectedColumn) return;

    const queryDef: QueryDefinition = {
      tables,
      columns: [
        {
          table_id: tableId,
          column,
          aggregation,
          alias: 'value',
        },
      ],
      filters: filters.length > 0 ? filters : undefined,
    };

    onChange(queryDef);
  }, [selectedTable, aggregation, selectedColumn, needsColumn, filters, onChange]);

  // Handle table change
  const handleTableChange = useCallback((value: string) => {
    setSelectedTable(value);
    setSelectedColumn(''); // Reset column when table changes
    setFilters([]); // Reset filters when table changes
  }, []);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  };

  return (
    <div style={containerStyle}>
      {/* Table Selection */}
      <div style={fieldStyle}>
        <label style={labelStyle}>From Table</label>
        <Select
          value={selectedTable}
          onChange={handleTableChange}
          options={[{ value: '', label: 'Select a table...' }, ...tableOptions]}
        />
      </div>

      {/* Aggregation Selection */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Metric</label>
        <Select
          value={aggregation}
          onChange={(value) => setAggregation(value as AggregationType)}
          options={AGGREGATIONS.map((a) => ({
            value: a.value,
            label: a.label,
          }))}
        />
        <span style={helpTextStyle}>
          {aggregation === 'count'
            ? 'Counts the number of rows'
            : `Calculates the ${aggregation} of a numeric column`}
        </span>
      </div>

      {/* Column Selection (only for aggregations that need it) */}
      {needsColumn && selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Column</label>
          {columnOptions.length > 0 ? (
            <Select
              value={selectedColumn}
              onChange={setSelectedColumn}
              options={[{ value: '', label: 'Select a column...' }, ...columnOptions]}
            />
          ) : (
            <span style={helpTextStyle}>No numeric columns available in this table</span>
          )}
        </div>
      )}

      {/* Optional Filters */}
      {selectedTable && currentTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Filters (optional)</label>
          <FilterBuilder
            tables={[{ id: 't1', name: selectedTable }]}
            filters={filters}
            onChange={setFilters}
            schema={schema}
          />
        </div>
      )}
    </div>
  );
}
