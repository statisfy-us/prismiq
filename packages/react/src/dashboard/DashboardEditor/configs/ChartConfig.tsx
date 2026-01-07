/**
 * Guided configuration for Chart widgets (Bar, Line, Area).
 *
 * Provides a simplified interface to configure:
 * - Group by (X-Axis) - categorical column for grouping
 * - Measure (Y-Axis) - aggregated numeric column(s)
 * - Optional filters
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { FilterBuilder } from '../../../components/FilterBuilder';
import type {
  DatabaseSchema,
  QueryDefinition,
  AggregationType,
  FilterDefinition,
  ColumnSchema,
} from '../../../types';

export interface ChartConfigProps {
  /** Database schema for table/column selection. */
  schema: DatabaseSchema;
  /** Current query (for restoring state). */
  query: QueryDefinition | null;
  /** Callback when query changes. */
  onChange: (query: QueryDefinition) => void;
}

/**
 * A measure (aggregated column) definition.
 */
interface MeasureConfig {
  column: string;
  aggregation: AggregationType;
}

/**
 * Available aggregations for measures.
 */
const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count' },
  { value: 'count_distinct', label: 'Count distinct' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
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
 * Check if a column is categorical (good for grouping).
 */
function isCategoricalColumn(col: ColumnSchema): boolean {
  const categoricalTypes = ['character varying', 'varchar', 'text', 'char', 'character'];
  return categoricalTypes.some((t) => col.data_type.toLowerCase().includes(t));
}

/**
 * Guided chart configuration component.
 */
export function ChartConfig({
  schema,
  query,
  onChange,
}: ChartConfigProps): JSX.Element {
  const { theme } = useTheme();

  // Extract state from existing query
  const initialTable = query?.tables[0]?.name ?? '';
  const initialGroupBy =
    query?.columns.find((c) => c.aggregation === 'none')?.column ??
    query?.group_by?.[0]?.column ??
    '';
  const initialMeasures: MeasureConfig[] =
    query?.columns
      .filter((c) => c.aggregation !== 'none')
      .map((c) => ({ column: c.column, aggregation: c.aggregation })) ?? [];

  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [groupByColumn, setGroupByColumn] = useState(initialGroupBy);
  const [measures, setMeasures] = useState<MeasureConfig[]>(
    initialMeasures.length > 0 ? initialMeasures : [{ column: '', aggregation: 'sum' }]
  );
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

  // Get categorical columns for grouping
  const groupByOptions = useMemo(() => {
    if (!currentTable) return [];
    // Include categorical columns and also date/timestamp columns
    const cols = currentTable.columns.filter(
      (c) =>
        isCategoricalColumn(c) ||
        c.data_type.toLowerCase().includes('date') ||
        c.data_type.toLowerCase().includes('timestamp')
    );
    return cols.map((c) => ({
      value: c.name,
      label: `${c.name} (${c.data_type})`,
    }));
  }, [currentTable]);

  // Get numeric columns for measures
  const measureColumnOptions = useMemo(() => {
    if (!currentTable) return [];
    const numericCols = currentTable.columns.filter(isNumericColumn);
    return numericCols.map((c) => ({
      value: c.name,
      label: `${c.name} (${c.data_type})`,
    }));
  }, [currentTable]);

  // Build and emit query when config changes
  useEffect(() => {
    if (!selectedTable || !groupByColumn) return;

    // Check if we have at least one valid measure
    const validMeasures = measures.filter((m) => m.column);
    if (validMeasures.length === 0) return;

    const tableId = 't1';
    const tables = [{ id: tableId, name: selectedTable }];

    // Build columns: group by column + measure columns
    const columns = [
      // Group by column (no aggregation)
      {
        table_id: tableId,
        column: groupByColumn,
        aggregation: 'none' as AggregationType,
      },
      // Measure columns (with aggregation)
      ...validMeasures.map((m, i) => ({
        table_id: tableId,
        column: m.column,
        aggregation: m.aggregation,
        alias: validMeasures.length > 1 ? `value_${i + 1}` : undefined,
      })),
    ];

    // Group by the dimension column
    const groupBy = [{ table_id: tableId, column: groupByColumn }];

    const queryDef: QueryDefinition = {
      tables,
      columns,
      group_by: groupBy,
      filters: filters.length > 0 ? filters : undefined,
      order_by: [{ table_id: tableId, column: groupByColumn, direction: 'ASC' }],
    };

    onChange(queryDef);
  }, [selectedTable, groupByColumn, measures, filters, onChange]);

  // Handle table change
  const handleTableChange = useCallback((value: string) => {
    setSelectedTable(value);
    setGroupByColumn('');
    setMeasures([{ column: '', aggregation: 'sum' }]);
    setFilters([]);
  }, []);

  // Handle measure change
  const updateMeasure = useCallback((index: number, updates: Partial<MeasureConfig>) => {
    setMeasures((prev) => prev.map((m, i) => (i === index ? { ...m, ...updates } : m)));
  }, []);

  // Add a new measure
  const addMeasure = useCallback(() => {
    setMeasures((prev) => [...prev, { column: '', aggregation: 'sum' }]);
  }, []);

  // Remove a measure
  const removeMeasure = useCallback((index: number) => {
    setMeasures((prev) => prev.filter((_, i) => i !== index));
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

  const measureRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
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

      {/* Group By (X-Axis) */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Group By (X-Axis)</label>
          {groupByOptions.length > 0 ? (
            <Select
              value={groupByColumn}
              onChange={setGroupByColumn}
              options={[{ value: '', label: 'Select a column...' }, ...groupByOptions]}
            />
          ) : (
            <span style={helpTextStyle}>No categorical columns available</span>
          )}
          <span style={helpTextStyle}>Categories to group data by</span>
        </div>
      )}

      {/* Measures (Y-Axis) */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Measures (Y-Axis)</label>
          {measures.map((measure, index) => (
            <div key={index} style={measureRowStyle}>
              <Select
                value={measure.aggregation}
                onChange={(value) => updateMeasure(index, { aggregation: value as AggregationType })}
                options={AGGREGATIONS}
                style={{ width: '120px' }}
              />
              <span style={{ color: theme.colors.textMuted }}>of</span>
              {measureColumnOptions.length > 0 ? (
                <Select
                  value={measure.column}
                  onChange={(value) => updateMeasure(index, { column: value })}
                  options={[{ value: '', label: 'Select column...' }, ...measureColumnOptions]}
                  style={{ flex: 1 }}
                />
              ) : (
                <span style={{ ...helpTextStyle, flex: 1 }}>No numeric columns</span>
              )}
              {measures.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeMeasure(index)}>
                  <Icon name="x" size={14} />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={addMeasure}
            style={{ alignSelf: 'flex-start' }}
          >
            <Icon name="plus" size={14} />
            <span style={{ marginLeft: theme.spacing.xs }}>Add measure</span>
          </Button>
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
