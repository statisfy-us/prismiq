/**
 * Guided configuration for Pie Chart widgets.
 *
 * Provides a simplified interface to configure:
 * - Label column (slices)
 * - Value (size of each slice)
 * - Optional filters
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { FilterBuilder } from '../../../components/FilterBuilder';
import type {
  DatabaseSchema,
  QueryDefinition,
  AggregationType,
  FilterDefinition,
  ColumnSchema,
} from '../../../types';

export interface PieConfigProps {
  /** Database schema for table/column selection. */
  schema: DatabaseSchema;
  /** Current query (for restoring state). */
  query: QueryDefinition | null;
  /** Callback when query changes. */
  onChange: (query: QueryDefinition) => void;
}

/**
 * Available aggregations for pie values.
 */
const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
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
 * Check if a column is categorical (good for labels).
 */
function isCategoricalColumn(col: ColumnSchema): boolean {
  const categoricalTypes = ['character varying', 'varchar', 'text', 'char', 'character'];
  return categoricalTypes.some((t) => col.data_type.toLowerCase().includes(t));
}

/**
 * Guided pie chart configuration component.
 */
export function PieConfig({
  schema,
  query,
  onChange,
}: PieConfigProps): JSX.Element {
  const { theme } = useTheme();

  // Extract state from existing query
  const initialTable = query?.tables[0]?.name ?? '';
  const initialLabel = query?.columns.find((c) => c.aggregation === 'none')?.column ?? '';
  const measureCol = query?.columns.find((c) => c.aggregation !== 'none');
  const initialValueColumn = measureCol?.column ?? '';
  const initialAggregation = measureCol?.aggregation ?? 'sum';

  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [labelColumn, setLabelColumn] = useState(initialLabel);
  const [valueColumn, setValueColumn] = useState(initialValueColumn);
  const [aggregation, setAggregation] = useState<AggregationType>(initialAggregation);
  const [filters, setFilters] = useState<FilterDefinition[]>(query?.filters ?? []);

  // Get table options
  const tableOptions = useMemo(() => {
    return schema.tables.map((t) => ({
      value: t.name,
      label: t.name,
    }));
  }, [schema.tables]);

  // Get current table schema
  const currentTable = useMemo(() => {
    return schema.tables.find((t) => t.name === selectedTable);
  }, [schema.tables, selectedTable]);

  // Get categorical columns for labels
  const labelOptions = useMemo(() => {
    if (!currentTable) return [];
    const cols = currentTable.columns.filter(isCategoricalColumn);
    return cols.map((c) => ({
      value: c.name,
      label: `${c.name} (${c.data_type})`,
    }));
  }, [currentTable]);

  // Get numeric columns for values
  const valueColumnOptions = useMemo(() => {
    if (!currentTable) return [];
    const numericCols = currentTable.columns.filter(isNumericColumn);
    return numericCols.map((c) => ({
      value: c.name,
      label: `${c.name} (${c.data_type})`,
    }));
  }, [currentTable]);

  // Build and emit query when config changes
  useEffect(() => {
    if (!selectedTable || !labelColumn) return;

    // For count, we don't need a value column
    const needsValueColumn = aggregation !== 'count';
    if (needsValueColumn && !valueColumn) return;

    const tableId = 't1';
    const tables = [{ id: tableId, name: selectedTable }];

    // Build columns: label column + value column
    const columns = [
      // Label column (no aggregation)
      {
        table_id: tableId,
        column: labelColumn,
        aggregation: 'none' as AggregationType,
      },
      // Value column (with aggregation)
      {
        table_id: tableId,
        column: needsValueColumn ? valueColumn : '*',
        aggregation,
        alias: 'value',
      },
    ];

    // Group by the label column
    const groupBy = [{ table_id: tableId, column: labelColumn }];

    const queryDef: QueryDefinition = {
      tables,
      columns,
      group_by: groupBy,
      filters: filters.length > 0 ? filters : undefined,
      order_by: [{ table_id: tableId, column: labelColumn, direction: 'ASC' }],
    };

    onChange(queryDef);
  }, [selectedTable, labelColumn, valueColumn, aggregation, filters, onChange]);

  // Handle table change
  const handleTableChange = useCallback((value: string) => {
    setSelectedTable(value);
    setLabelColumn('');
    setValueColumn('');
    setFilters([]);
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

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
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

      {/* Label Column (Slices) */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Slices (Labels)</label>
          {labelOptions.length > 0 ? (
            <Select
              value={labelColumn}
              onChange={setLabelColumn}
              options={[{ value: '', label: 'Select a column...' }, ...labelOptions]}
            />
          ) : (
            <span style={helpTextStyle}>No categorical columns available</span>
          )}
          <span style={helpTextStyle}>Each unique value becomes a slice</span>
        </div>
      )}

      {/* Value */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Size (Value)</label>
          <div style={rowStyle}>
            <Select
              value={aggregation}
              onChange={(value) => setAggregation(value as AggregationType)}
              options={AGGREGATIONS}
              style={{ width: '120px' }}
            />
            {aggregation !== 'count' && (
              <>
                <span style={{ color: theme.colors.textMuted }}>of</span>
                {valueColumnOptions.length > 0 ? (
                  <Select
                    value={valueColumn}
                    onChange={setValueColumn}
                    options={[{ value: '', label: 'Select column...' }, ...valueColumnOptions]}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <span style={{ ...helpTextStyle, flex: 1 }}>No numeric columns</span>
                )}
              </>
            )}
          </div>
          <span style={helpTextStyle}>Determines the size of each slice</span>
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
