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
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { TableSelector } from '../../../components/TableSelector';
import { JoinBuilder } from '../../../components/JoinBuilder';
import { TimeSeriesConfig } from '../../../components/TimeSeriesConfig';
import { CalculatedFieldBuilder } from '../../../components/CalculatedFieldBuilder';
import type {
  DatabaseSchema,
  QueryDefinition,
  QueryTable,
  JoinDefinition,
  AggregationType,
  FilterDefinition,
  ColumnSchema,
  DateTruncInterval,
  TimeSeriesConfig as TimeSeriesConfigType,
  CalculatedField,
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
 * Check if a column is a date/timestamp type.
 */
function isDateColumn(col: ColumnSchema): boolean {
  const type = col.data_type.toLowerCase();
  return type.includes('date') || type.includes('time') || type.includes('timestamp');
}

/**
 * Date truncation options.
 */
const DATE_TRUNC_OPTIONS: { value: DateTruncInterval | ''; label: string }[] = [
  { value: '', label: 'No truncation' },
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'day', label: 'Day' },
  { value: 'hour', label: 'Hour' },
  { value: 'minute', label: 'Minute' },
];

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
  const initialTables: QueryTable[] = query?.tables ?? [];
  const groupByCol = query?.columns.find((c) => c.aggregation === 'none');
  const initialGroupBy = groupByCol?.column ?? query?.group_by?.[0]?.column ?? '';
  const initialGroupByTableId = groupByCol?.table_id ?? query?.tables?.[0]?.id ?? 't1';
  const initialDateTrunc = groupByCol?.date_trunc ?? '';
  const initialMeasures: MeasureConfig[] =
    query?.columns
      .filter((c) => c.aggregation !== 'none')
      .map((c) => ({ column: c.column, aggregation: c.aggregation })) ?? [];
  const initialJoins: JoinDefinition[] = query?.joins ?? [];

  const [tables, setTables] = useState<QueryTable[]>(initialTables);
  const [joins, setJoins] = useState<JoinDefinition[]>(initialJoins);
  const [groupByColumn, setGroupByColumn] = useState(initialGroupBy);
  const [groupByTableId, setGroupByTableId] = useState(initialGroupByTableId);
  const [dateTrunc, setDateTrunc] = useState<DateTruncInterval | ''>(initialDateTrunc);
  const [measures, setMeasures] = useState<MeasureConfig[]>(
    initialMeasures.length > 0 ? initialMeasures : [{ column: '', aggregation: 'sum' }]
  );
  const [filters, setFilters] = useState<FilterDefinition[]>(query?.filters ?? []);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesConfigType | undefined>(query?.time_series);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>(
    query?.calculated_fields ?? []
  );

  // Derived state
  const primaryTable = tables[0];
  const selectedTable = primaryTable?.name ?? '';

  // Get table options for the primary table dropdown
  const tableOptions = useMemo(() => {
    return schema.tables.map((t) => ({
      value: t.name,
      label: t.name,
    }));
  }, [schema.tables]);

  // Get current primary table schema
  const currentTable = useMemo(() => {
    return schema.tables.find((t) => t.name === selectedTable);
  }, [schema.tables, selectedTable]);

  // Get categorical columns for grouping (from all selected tables)
  const groupByOptions = useMemo(() => {
    const options: { value: string; label: string; tableId: string }[] = [];

    for (const table of tables) {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      const cols = tableSchema.columns.filter(
        (c) =>
          isCategoricalColumn(c) ||
          c.data_type.toLowerCase().includes('date') ||
          c.data_type.toLowerCase().includes('timestamp')
      );

      for (const col of cols) {
        options.push({
          value: `${table.id}.${col.name}`,
          label: tables.length > 1
            ? `${table.alias ?? table.name}.${col.name} (${col.data_type})`
            : `${col.name} (${col.data_type})`,
          tableId: table.id,
        });
      }
    }

    return options;
  }, [tables, schema.tables]);

  // Get numeric columns for measures (from all selected tables)
  const measureColumnOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];

    for (const table of tables) {
      const tableSchema = schema.tables.find((t) => t.name === table.name);
      if (!tableSchema) continue;

      const numericCols = tableSchema.columns.filter(isNumericColumn);

      for (const col of numericCols) {
        options.push({
          value: `${table.id}.${col.name}`,
          label: tables.length > 1
            ? `${table.alias ?? table.name}.${col.name} (${col.data_type})`
            : `${col.name} (${col.data_type})`,
        });
      }
    }

    return options;
  }, [tables, schema.tables]);

  // Check if selected group by column is a date type
  const groupByColumnSchema = useMemo(() => {
    if (!groupByColumn || !groupByTableId) return null;
    const table = tables.find((t) => t.id === groupByTableId);
    if (!table) return null;
    const tableSchema = schema.tables.find((t) => t.name === table.name);
    if (!tableSchema) return null;
    return tableSchema.columns.find((c) => c.name === groupByColumn) ?? null;
  }, [tables, schema.tables, groupByColumn, groupByTableId]);

  const isGroupByDate = groupByColumnSchema ? isDateColumn(groupByColumnSchema) : false;

  // Build and emit query when config changes
  useEffect(() => {
    if (tables.length === 0 || !groupByColumn) return;

    // Check if we have at least one valid measure
    const validMeasures = measures.filter((m) => m.column);
    if (validMeasures.length === 0) return;

    // Build columns: group by column + measure columns
    const columns = [
      // Group by column (no aggregation, with optional date truncation)
      {
        table_id: groupByTableId,
        column: groupByColumn,
        aggregation: 'none' as AggregationType,
        date_trunc: dateTrunc || undefined,
      },
      // Measure columns (with aggregation) - parse table_id.column format
      ...validMeasures.map((m, i) => {
        let measureTableId: string;
        let measureColumn: string;
        if (m.column.includes('.')) {
          const parts = m.column.split('.');
          measureTableId = parts[0] ?? tables[0]?.id ?? 't1';
          measureColumn = parts[1] ?? m.column;
        } else {
          measureTableId = tables[0]?.id ?? 't1';
          measureColumn = m.column;
        }
        return {
          table_id: measureTableId,
          column: measureColumn,
          aggregation: m.aggregation,
          alias: validMeasures.length > 1 ? `value_${i + 1}` : undefined,
        };
      }),
    ];

    // Group by the dimension column
    const groupBy = [{ table_id: groupByTableId, column: groupByColumn }];

    const queryDef: QueryDefinition = {
      tables,
      joins: joins.length > 0 ? joins : undefined,
      columns,
      group_by: groupBy,
      filters: filters.length > 0 ? filters : undefined,
      order_by: [{ table_id: groupByTableId, column: groupByColumn, direction: 'ASC' }],
      time_series: timeSeries,
      calculated_fields: calculatedFields.length > 0 ? calculatedFields : undefined,
    };

    onChange(queryDef);
  }, [tables, joins, groupByColumn, groupByTableId, dateTrunc, measures, filters, timeSeries, calculatedFields, onChange]);

  // Handle primary table change
  const handleTableChange = useCallback((value: string) => {
    if (!value) {
      setTables([]);
    } else {
      setTables([{ id: 't1', name: value }]);
    }
    setJoins([]);
    setGroupByColumn('');
    setGroupByTableId('t1');
    setDateTrunc('');
    setMeasures([{ column: '', aggregation: 'sum' }]);
    setFilters([]);
  }, []);

  // Handle tables change (for multi-table selection)
  const handleTablesChange = useCallback((newTables: QueryTable[]) => {
    setTables(newTables);
    // Clear joins that reference removed tables
    const tableIds = new Set(newTables.map((t) => t.id));
    setJoins((prev) =>
      prev.filter((j) => tableIds.has(j.from_table_id) && tableIds.has(j.to_table_id))
    );
    // Clear group by if its table was removed
    if (!tableIds.has(groupByTableId)) {
      setGroupByColumn('');
      setGroupByTableId(newTables[0]?.id ?? 't1');
    }
  }, [groupByTableId]);

  // Handle group by column change (now includes table_id)
  const handleGroupByChange = useCallback((value: string) => {
    if (value.includes('.')) {
      const parts = value.split('.');
      const tableId = parts[0] ?? 't1';
      const column = parts[1] ?? '';
      setGroupByTableId(tableId);
      setGroupByColumn(column);
    } else {
      setGroupByColumn(value);
    }
    setDateTrunc(''); // Reset date truncation when column changes
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

  // Get current group by value in tableId.column format
  const groupByValue = groupByColumn && groupByTableId
    ? `${groupByTableId}.${groupByColumn}`
    : '';

  return (
    <div style={containerStyle}>
      {/* Primary Table Selection */}
      <div style={fieldStyle}>
        <label style={labelStyle}>From Table</label>
        <Select
          value={selectedTable}
          onChange={handleTableChange}
          options={[{ value: '', label: 'Select a table...' }, ...tableOptions]}
        />
      </div>

      {/* Additional Tables and Joins */}
      {selectedTable && (
        <CollapsibleSection title="Join Tables" defaultOpen={tables.length > 1}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            <TableSelector
              schema={schema}
              tables={tables}
              onChange={handleTablesChange}
              maxTables={5}
              showRelationships={true}
            />

            {/* Show JoinBuilder when 2+ tables selected */}
            {tables.length >= 2 && (
              <div style={fieldStyle}>
                <label style={labelStyle}>Join Conditions</label>
                <JoinBuilder
                  schema={schema}
                  tables={tables}
                  joins={joins}
                  onChange={setJoins}
                />
                {joins.length === 0 && tables.length >= 2 && (
                  <span style={helpTextStyle}>
                    Define how tables relate to each other
                  </span>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Group By (X-Axis) */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Group By (X-Axis)</label>
          {groupByOptions.length > 0 ? (
            <Select
              value={groupByValue}
              onChange={handleGroupByChange}
              options={[{ value: '', label: 'Select a column...' }, ...groupByOptions]}
            />
          ) : (
            <span style={helpTextStyle}>No categorical columns available</span>
          )}
          <span style={helpTextStyle}>Categories to group data by</span>
        </div>
      )}

      {/* Date Truncation (for date columns) */}
      {selectedTable && groupByColumn && isGroupByDate && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Date Granularity</label>
          <Select
            value={dateTrunc}
            onChange={(value) => setDateTrunc(value as DateTruncInterval | '')}
            options={DATE_TRUNC_OPTIONS}
          />
          <span style={helpTextStyle}>Truncate dates to this interval</span>
        </div>
      )}

      {/* Time Series Configuration (for date-based charts) */}
      {selectedTable && isGroupByDate && (
        <CollapsibleSection title="Time Series Options" defaultOpen={timeSeries !== undefined}>
          <TimeSeriesConfig
            schema={schema}
            tables={tables}
            config={timeSeries}
            onChange={setTimeSeries}
            selectedDateColumn={
              groupByColumn && groupByTableId
                ? { table_id: groupByTableId, column: groupByColumn }
                : undefined
            }
          />
        </CollapsibleSection>
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
            tables={tables}
            filters={filters}
            onChange={setFilters}
            schema={schema}
          />
        </div>
      )}

      {/* Calculated Fields */}
      {selectedTable && (
        <CollapsibleSection
          title="Calculated Fields"
          defaultOpen={calculatedFields.length > 0}
        >
          <CalculatedFieldBuilder
            fields={calculatedFields}
            onChange={setCalculatedFields}
            tables={tables}
            schema={schema}
            maxFields={5}
          />
        </CollapsibleSection>
      )}
    </div>
  );
}
