/**
 * useSchema hook.
 *
 * Provides convenient access to database schema with helper methods.
 */

import { useCallback, useMemo } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { DatabaseSchema, Relationship, TableSchema } from '../types';

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
  /** Whether the schema is currently loading. */
  isLoading: boolean;
  /** Error that occurred during schema loading, if any. */
  error: Error | null;
  /** Get a table by name. */
  getTable: (name: string) => TableSchema | undefined;
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
  const { schema, isLoading, error } = useAnalytics();

  // Extract tables and relationships from schema
  const tables = useMemo(() => schema?.tables ?? [], [schema]);
  const relationships = useMemo(() => schema?.relationships ?? [], [schema]);

  // Helper function to get a table by name
  const getTable = useCallback(
    (name: string): TableSchema | undefined => {
      return tables.find((table) => table.name === name);
    },
    [tables]
  );

  return {
    schema,
    tables,
    relationships,
    isLoading,
    error,
    getTable,
  };
}
