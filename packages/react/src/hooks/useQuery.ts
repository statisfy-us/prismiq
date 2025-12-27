/**
 * useQuery hook.
 *
 * Executes queries against the Prismiq backend with caching and cancellation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { QueryDefinition, QueryResult } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useQuery hook.
 */
export interface UseQueryOptions {
  /**
   * Whether the query should be executed.
   * Set to false to disable automatic execution.
   * @default true
   */
  enabled?: boolean;
  /**
   * Whether to use the preview endpoint (limited results).
   * @default false
   */
  preview?: boolean;
  /**
   * Maximum number of rows to return when using preview.
   * @default 100
   */
  previewLimit?: number;
}

/**
 * Result of the useQuery hook.
 */
export interface UseQueryResult {
  /** The query result data, or null if not yet loaded. */
  data: QueryResult | null;
  /** Whether the query is currently loading. */
  isLoading: boolean;
  /** Error that occurred during query execution, if any. */
  error: Error | null;
  /** Function to manually re-execute the query. */
  refetch: () => Promise<void>;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Deep comparison of query definitions to determine if they're equivalent.
 */
function queryEquals(
  a: QueryDefinition | null,
  b: QueryDefinition | null
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for executing queries against the Prismiq backend.
 *
 * The query is automatically executed when:
 * - The query definition changes
 * - enabled is true
 * - The query is not null
 *
 * Supports cancellation when the component unmounts or the query changes.
 *
 * @param query - The query definition to execute, or null to skip.
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * function QueryResults() {
 *   const query: QueryDefinition = {
 *     tables: [{ id: 't1', name: 'users' }],
 *     columns: [
 *       { table_id: 't1', column: 'name', aggregation: 'none' },
 *     ],
 *   };
 *
 *   const { data, isLoading, error } = useQuery(query, { preview: true });
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <table>
 *       <thead>
 *         <tr>
 *           {data?.columns.map(col => <th key={col}>{col}</th>)}
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {data?.rows.map((row, i) => (
 *           <tr key={i}>
 *             {row.map((cell, j) => <td key={j}>{String(cell)}</td>)}
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   );
 * }
 * ```
 */
export function useQuery(
  query: QueryDefinition | null,
  options: UseQueryOptions = {}
): UseQueryResult {
  const { enabled = true, preview = false, previewLimit = 100 } = options;

  const { client } = useAnalytics();

  // State
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the current query for memoization
  const previousQueryRef = useRef<QueryDefinition | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Execute query function
  const executeQuery = useCallback(async () => {
    // Don't execute if query is null or disabled
    if (query === null || !enabled) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const result = preview
        ? await client.previewQuery(query, previewLimit)
        : await client.executeQuery(query);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setData(result);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, query, enabled, preview, previewLimit]);

  // Refetch function (exposed to consumers)
  const refetch = useCallback(async () => {
    await executeQuery();
  }, [executeQuery]);

  // Execute query when dependencies change
  useEffect(() => {
    // Check if query has actually changed (deep comparison)
    if (queryEquals(query, previousQueryRef.current)) {
      return;
    }

    previousQueryRef.current = query;

    // Clear data when query is null
    if (query === null) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Don't execute if disabled
    if (!enabled) {
      return;
    }

    void executeQuery();
  }, [query, enabled, executeQuery]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
