/**
 * useSchema hook.
 *
 * Provides convenient access to database schema with helper methods.
 */

import { useCallback, useMemo } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { DatabaseSchema, DataSourceMeta, Relationship, TableSchema } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of the useSchema hook.
 */
export interface UseSchemaResult {
  /** The complete database schema, or null if not yet loaded. */
  schema: DatabaseSchema | null;
  /** List of tables in the schema. */
  tables: TableSchema[];
  /** List of relationships between tables. */
  relationships: Relationship[];
  /** Data source metadata (display names, descriptions). */
  dataSources: DataSourceMeta[];
  /** Whether the schema is currently loading. */
  isLoading: boolean;
  /** Error that occurred during schema loading, if any. */
  error: Error | null;
  /** Get a table by name. */
  getTable: (name: string) => TableSchema | undefined;
  /** Get the display name for a table (returns table name if no display name configured). */
  getDisplayName: (tableName: string) => string;
  /** Get the description for a table (returns empty string if no description configured). */
  getDescription: (tableName: string) => string;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for accessing the database schema.
 *
 * Provides the schema from the AnalyticsProvider context with
 * convenient helper methods for working with tables.
 *
 * @example
 * ```tsx
 * function TableExplorer() {
 *   const { tables, isLoading, getTable } = useSchema();
 *
 *   if (isLoading) return <Loading />;
 *
 *   const usersTable = getTable('users');
 *
 *   return (
 *     <ul>
 *       {tables.map(table => (
 *         <li key={table.name}>{table.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSchema(): UseSchemaResult {
  const { schema, dataSources, isLoading, error } = useAnalytics();

  // Extract tables and relationships from schema
  const tables = useMemo(() => schema?.tables ?? [], [schema]);
  const relationships = useMemo(() => schema?.relationships ?? [], [schema]);

  // Create lookup map from table name to data source metadata
  const dataSourceMap = useMemo(() => {
    const map = new Map<string, DataSourceMeta>();
    for (const ds of dataSources) {
      map.set(ds.table, ds);
    }
    return map;
  }, [dataSources]);

  // Helper function to get a table by name
  const getTable = useCallback(
    (name: string): TableSchema | undefined => {
      return tables.find((table) => table.name === name);
    },
    [tables]
  );

  // Get the display name for a table (returns table name if no display name configured)
  const getDisplayName = useCallback(
    (tableName: string): string => {
      return dataSourceMap.get(tableName)?.title ?? tableName;
    },
    [dataSourceMap]
  );

  // Get the description for a table (returns empty string if no description configured)
  const getDescription = useCallback(
    (tableName: string): string => {
      return dataSourceMap.get(tableName)?.subtitle ?? '';
    },
    [dataSourceMap]
  );

  return {
    schema,
    tables,
    relationships,
    dataSources,
    isLoading,
    error,
    getTable,
    getDisplayName,
    getDescription,
  };
}
