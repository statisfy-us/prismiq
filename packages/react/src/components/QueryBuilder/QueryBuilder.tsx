/**
 * QueryBuilder component - main container combining all query building components.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAnalytics, useSchema, useQuery as useQueryHook } from '../../hooks';
import type {
  ColumnSelection,
  ColumnSchema,
  FilterDefinition,
  JoinDefinition,
  QueryDefinition,
  QueryResult,
  SortDefinition,
  TableSchema,
} from '../../types';
import { ColumnSelector } from '../ColumnSelector';
import { FilterBuilder } from '../FilterBuilder';
import { JoinBuilder } from '../JoinBuilder';
import { ResultsTable } from '../ResultsTable';
import { SchemaExplorer } from '../SchemaExplorer';
import { SortBuilder } from '../SortBuilder';
import { QueryBuilderToolbar } from './QueryBuilderToolbar';
import { QueryPreview } from './QueryPreview';

// ============================================================================
// Types
// ============================================================================

export interface QueryBuilderProps {
  /** Initial query definition. */
  initialQuery?: QueryDefinition;
  /** Callback when query changes. */
  onQueryChange?: (query: QueryDefinition) => void;
  /** Callback when query is executed successfully. */
  onExecute?: (result: QueryResult) => void;
  /** Callback when an error occurs. */
  onError?: (error: Error) => void;
  /** Whether to auto-execute on query change. */
  autoExecute?: boolean;
  /** Delay before auto-execute (ms). */
  autoExecuteDelay?: number;
  /** Whether to show SQL preview panel. */
  showSqlPreview?: boolean;
  /** Whether to show results table. */
  showResultsTable?: boolean;
  /** Layout direction. */
  layout?: 'horizontal' | 'vertical';
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

export interface QueryBuilderState {
  query: QueryDefinition;
  result: QueryResult | null;
  isExecuting: boolean;
  error: Error | null;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-md)',
  height: '100%',
  fontFamily: 'var(--prismiq-font-sans)',
};

const horizontalLayoutStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--prismiq-spacing-md)',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const sidebarStyles: React.CSSProperties = {
  width: '240px',
  flexShrink: 0,
  overflow: 'hidden',
};

const mainStyles: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-md)',
  minWidth: 0,
  overflow: 'hidden',
};

const builderSectionStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-md)',
};

const resultsStyles: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

// ============================================================================
// Default Query
// ============================================================================

const createDefaultQuery = (): QueryDefinition => ({
  tables: [],
  columns: [],
  filters: [],
  order_by: [],
});

// ============================================================================
// Component
// ============================================================================

/**
 * Main QueryBuilder component combining all query building components.
 *
 * @example
 * ```tsx
 * <QueryBuilder
 *   onQueryChange={(query) => console.log('Query:', query)}
 *   onExecute={(result) => console.log('Result:', result)}
 *   showSqlPreview
 *   showResultsTable
 * />
 * ```
 */
export function QueryBuilder({
  initialQuery,
  onQueryChange,
  onExecute,
  onError,
  autoExecute = false,
  autoExecuteDelay = 500,
  showSqlPreview = true,
  showResultsTable = true,
  layout = 'horizontal',
  className,
  style,
}: QueryBuilderProps): JSX.Element {
  // Context and hooks
  const { client } = useAnalytics();
  const { schema, isLoading: schemaLoading } = useSchema();

  // State
  const [query, setQuery] = useState<QueryDefinition>(
    initialQuery ?? createDefaultQuery()
  );
  const [selectedTable, setSelectedTable] = useState<string | undefined>();
  const [sqlPreview, setSqlPreview] = useState<string | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  // Use the query hook for execution
  const [executeQuery, setExecuteQuery] = useState<QueryDefinition | null>(null);
  const { data: result, isLoading: isExecuting, error } = useQueryHook(
    executeQuery,
    { enabled: executeQuery !== null }
  );

  // Refs for auto-execute debouncing
  const autoExecuteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track selected columns for SchemaExplorer
  const selectedColumns = useMemo(
    () =>
      query.columns.map((col) => {
        const table = query.tables.find((t) => t.id === col.table_id);
        return {
          table: table?.name ?? '',
          column: col.column,
        };
      }),
    [query.columns, query.tables]
  );

  // Check if query can be executed
  const canExecute = useMemo(() => {
    return query.tables.length > 0 && query.columns.length > 0;
  }, [query.tables.length, query.columns.length]);

  // Generate SQL preview when query changes
  useEffect(() => {
    if (!canExecute) {
      setSqlPreview(null);
      setSqlError(null);
      return;
    }

    const generatePreview = async () => {
      try {
        const sql = await client.generateSql(query);
        setSqlPreview(sql);
        setSqlError(null);
      } catch (err) {
        setSqlError(err instanceof Error ? err.message : 'Failed to generate SQL');
        setSqlPreview(null);
      }
    };

    void generatePreview();
  }, [client, query, canExecute]);

  // Notify parent of query changes
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  // Handle execution results
  useEffect(() => {
    if (result) {
      onExecute?.(result);
    }
  }, [result, onExecute]);

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  // Auto-execute with debounce
  useEffect(() => {
    if (!autoExecute || !canExecute) return;

    if (autoExecuteTimeoutRef.current) {
      clearTimeout(autoExecuteTimeoutRef.current);
    }

    autoExecuteTimeoutRef.current = setTimeout(() => {
      setExecuteQuery({ ...query });
    }, autoExecuteDelay);

    return () => {
      if (autoExecuteTimeoutRef.current) {
        clearTimeout(autoExecuteTimeoutRef.current);
      }
    };
  }, [query, autoExecute, autoExecuteDelay, canExecute]);

  // Handle execute
  const handleExecute = useCallback(() => {
    setExecuteQuery({ ...query });
  }, [query]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canExecute && !isExecuting) {
          handleExecute();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canExecute, isExecuting, handleExecute]);

  // Handle table selection from schema explorer
  const handleTableSelect = useCallback((table: TableSchema) => {
    setSelectedTable(table.name);

    setQuery((prev) => {
      // Check if table is already in query
      const existingTable = prev.tables.find((t) => t.name === table.name);
      if (existingTable) return prev;

      // Add table to query
      const newTable = {
        id: `t${prev.tables.length + 1}`,
        name: table.name,
      };

      return {
        ...prev,
        tables: [...prev.tables, newTable],
      };
    });
  }, []);

  // Handle column selection from schema explorer
  const handleColumnSelect = useCallback((table: TableSchema, column: ColumnSchema) => {
    setQuery((prev) => {
      // Find or create table in query
      let queryTable = prev.tables.find((t) => t.name === table.name);

      if (!queryTable) {
        queryTable = {
          id: `t${prev.tables.length + 1}`,
          name: table.name,
        };
      }

      // Check if column already selected
      const alreadySelected = prev.columns.some(
        (c) => c.table_id === queryTable!.id && c.column === column.name
      );

      if (alreadySelected) return prev;

      // Add column
      const newColumn: ColumnSelection = {
        table_id: queryTable.id,
        column: column.name,
        aggregation: 'none',
      };

      const newTables = prev.tables.find((t) => t.name === table.name)
        ? prev.tables
        : [...prev.tables, queryTable];

      return {
        ...prev,
        tables: newTables,
        columns: [...prev.columns, newColumn],
      };
    });
  }, []);

  // Handle columns change
  const handleColumnsChange = useCallback((columns: ColumnSelection[]) => {
    setQuery((prev) => ({ ...prev, columns }));
  }, []);

  // Handle filters change
  const handleFiltersChange = useCallback((filters: FilterDefinition[]) => {
    setQuery((prev) => ({ ...prev, filters }));
  }, []);

  // Handle sorts change
  const handleSortsChange = useCallback((sorts: SortDefinition[]) => {
    setQuery((prev) => ({ ...prev, order_by: sorts }));
  }, []);

  // Handle joins change
  const handleJoinsChange = useCallback((joins: JoinDefinition[]) => {
    setQuery((prev) => ({ ...prev, joins }));
  }, []);

  // Handle preview (limited rows)
  const handlePreview = useCallback(() => {
    setExecuteQuery({ ...query, limit: 100 });
  }, [query]);

  // Handle clear
  const handleClear = useCallback(() => {
    setQuery(createDefaultQuery());
    setSelectedTable(undefined);
    setExecuteQuery(null);
  }, []);

  if (schemaLoading || !schema) {
    return (
      <div className={className} style={{ ...containerStyles, ...style }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--prismiq-color-text-muted)',
          }}
        >
          Loading schema...
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div style={horizontalLayoutStyles}>
        {layout === 'horizontal' && (
          <div style={sidebarStyles}>
            <SchemaExplorer
              selectedTable={selectedTable}
              selectedColumns={selectedColumns}
              onTableSelect={handleTableSelect}
              onColumnSelect={handleColumnSelect}
              style={{ height: '100%' }}
            />
          </div>
        )}

        <div style={mainStyles}>
          <div style={builderSectionStyles}>
            <ColumnSelector
              tables={query.tables}
              columns={query.columns}
              onChange={handleColumnsChange}
              schema={schema}
            />

            <JoinBuilder
              tables={query.tables}
              joins={query.joins ?? []}
              onChange={handleJoinsChange}
              schema={schema}
            />

            <FilterBuilder
              tables={query.tables}
              filters={query.filters ?? []}
              onChange={handleFiltersChange}
              schema={schema}
            />

            <SortBuilder
              tables={query.tables}
              sorts={query.order_by ?? []}
              onChange={handleSortsChange}
              schema={schema}
            />
          </div>

          <QueryBuilderToolbar
            isExecuting={isExecuting}
            canExecute={canExecute}
            onExecute={handleExecute}
            onPreview={handlePreview}
            onClear={handleClear}
          />

          {showSqlPreview && (
            <QueryPreview
              sql={sqlPreview}
              error={sqlError}
              collapsible
              defaultCollapsed={false}
            />
          )}

          {showResultsTable && (
            <div style={resultsStyles}>
              <ResultsTable
                result={result}
                loading={isExecuting}
                error={error}
                sortable
                style={{ height: '100%' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
