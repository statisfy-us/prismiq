/**
 * useSavedQueries hook.
 *
 * Fetches and manages saved queries from the Prismiq backend.
 */

import { useCallback, useEffect, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { SavedQuery, SavedQueryCreate, SavedQueryUpdate } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useSavedQueries hook.
 */
export interface UseSavedQueriesOptions {
  /**
   * Whether to automatically fetch saved queries on mount.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result of the useSavedQueries hook.
 */
export interface UseSavedQueriesResult {
  /** The list of saved queries, or null if not yet loaded. */
  data: SavedQuery[] | null;
  /** Whether the saved queries are currently loading. */
  isLoading: boolean;
  /** Error that occurred during fetch, if any. */
  error: Error | null;
  /** Function to manually refresh the saved query list. */
  refetch: () => Promise<void>;
  /** Function to create a new saved query. */
  createQuery: (data: SavedQueryCreate) => Promise<SavedQuery>;
  /** Function to update an existing saved query. */
  updateQuery: (id: string, data: SavedQueryUpdate) => Promise<SavedQuery>;
  /** Function to delete a saved query. */
  deleteQuery: (id: string) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for fetching and managing saved queries.
 *
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * function SavedQueryList() {
 *   const { data, isLoading, error, createQuery } = useSavedQueries();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return (
 *     <ul>
 *       {data?.map(query => (
 *         <li key={query.id}>{query.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useSavedQueries(
  options: UseSavedQueriesOptions = {}
): UseSavedQueriesResult {
  const { enabled = true } = options;

  const { client } = useAnalytics();

  const [data, setData] = useState<SavedQuery[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSavedQueries = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await client.listSavedQueries();
      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled]);

  const refetch = useCallback(async () => {
    await fetchSavedQueries();
  }, [fetchSavedQueries]);

  const createQuery = useCallback(
    async (createData: SavedQueryCreate): Promise<SavedQuery> => {
      const created = await client.createSavedQuery(createData);
      // Refresh the list after creating
      await fetchSavedQueries();
      return created;
    },
    [client, fetchSavedQueries]
  );

  const updateQuery = useCallback(
    async (id: string, updateData: SavedQueryUpdate): Promise<SavedQuery> => {
      const updated = await client.updateSavedQuery(id, updateData);
      // Update the local state
      setData((prev) =>
        prev ? prev.map((q) => (q.id === id ? updated : q)) : prev
      );
      return updated;
    },
    [client]
  );

  const deleteQuery = useCallback(
    async (id: string): Promise<void> => {
      await client.deleteSavedQuery(id);
      // Remove from local state
      setData((prev) => (prev ? prev.filter((q) => q.id !== id) : prev));
    },
    [client]
  );

  useEffect(() => {
    if (enabled) {
      void fetchSavedQueries();
    }
  }, [enabled, fetchSavedQueries]);

  return {
    data,
    isLoading,
    error,
    refetch,
    createQuery,
    updateQuery,
    deleteQuery,
  };
}
