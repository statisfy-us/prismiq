/**
 * Guided configuration for Table widgets.
 *
 * Provides a simplified interface to configure:
 * - Table selection
 * - Column selection (which columns to display)
 * - Optional filters
 * - Row limit
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { FilterBuilder } from '../../../components/FilterBuilder';
import type {
  DatabaseSchema,
  QueryDefinition,
  FilterDefinition,
  AggregationType,
} from '../../../types';

export interface TableConfigProps {
  /** Database schema for table/column selection. */
  schema: DatabaseSchema;
  /** Current query (for restoring state). */
  query: QueryDefinition | null;
  /** Callback when query changes. */
  onChange: (query: QueryDefinition) => void;
}

/**
 * Guided table configuration component.
 */
export function TableConfig({
  schema,
  query,
  onChange,
}: TableConfigProps): JSX.Element {
  const { theme } = useTheme();

  // Extract state from existing query
  const initialTable = query?.tables[0]?.name ?? '';
  const initialColumns = query?.columns.map((c) => c.column) ?? [];

  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialColumns);
  const [filters, setFilters] = useState<FilterDefinition[]>(query?.filters ?? []);
  const [limit, setLimit] = useState(query?.limit ?? 100);

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

  // Build and emit query when config changes
  useEffect(() => {
    if (!selectedTable) return;

    const tableId = 't1';
    const tables = [{ id: tableId, name: selectedTable }];

    // If no columns selected, select all columns
    const columnsToUse =
      selectedColumns.length > 0 ? selectedColumns : currentTable?.columns.map((c) => c.name) ?? [];

    if (columnsToUse.length === 0) return;

    const columns = columnsToUse.map((col) => ({
      table_id: tableId,
      column: col,
      aggregation: 'none' as AggregationType,
    }));

    const queryDef: QueryDefinition = {
      tables,
      columns,
      filters: filters.length > 0 ? filters : undefined,
      limit,
    };

    onChange(queryDef);
  }, [selectedTable, selectedColumns, filters, limit, currentTable, onChange]);

  // Handle table change
  const handleTableChange = useCallback((value: string) => {
    setSelectedTable(value);
    setSelectedColumns([]);
    setFilters([]);
  }, []);

  // Handle column toggle
  const toggleColumn = useCallback((columnName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnName) ? prev.filter((c) => c !== columnName) : [...prev, columnName]
    );
  }, []);

  // Select all columns
  const selectAllColumns = useCallback(() => {
    if (currentTable) {
      setSelectedColumns(currentTable.columns.map((c) => c.name));
    }
  }, [currentTable]);

  // Clear all columns
  const clearAllColumns = useCallback(() => {
    setSelectedColumns([]);
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

  const columnsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    maxHeight: '200px',
    overflowY: 'auto',
  };

  const columnActionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
    fontSize: theme.fontSizes.xs,
  };

  const linkStyle: React.CSSProperties = {
    color: theme.colors.primary,
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
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

      {/* Column Selection */}
      {selectedTable && currentTable && (
        <div style={fieldStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>Columns</label>
            <div style={columnActionsStyle}>
              <span style={linkStyle} onClick={selectAllColumns}>
                Select all
              </span>
              <span style={linkStyle} onClick={clearAllColumns}>
                Clear all
              </span>
            </div>
          </div>
          <div style={columnsContainerStyle}>
            {currentTable.columns.map((col) => (
              <Checkbox
                key={col.name}
                label={`${col.name} (${col.data_type})`}
                checked={selectedColumns.includes(col.name)}
                onChange={() => toggleColumn(col.name)}
              />
            ))}
          </div>
          <span style={helpTextStyle}>
            {selectedColumns.length === 0
              ? 'All columns will be shown'
              : `${selectedColumns.length} column(s) selected`}
          </span>
        </div>
      )}

      {/* Row Limit */}
      {selectedTable && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Maximum Rows</label>
          <div style={rowStyle}>
            <Select
              value={String(limit)}
              onChange={(value) => setLimit(parseInt(value, 10))}
              options={[
                { value: '25', label: '25 rows' },
                { value: '50', label: '50 rows' },
                { value: '100', label: '100 rows' },
                { value: '250', label: '250 rows' },
                { value: '500', label: '500 rows' },
                { value: '1000', label: '1000 rows' },
              ]}
              style={{ width: '150px' }}
            />
          </div>
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
