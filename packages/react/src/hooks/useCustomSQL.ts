/**
 * useCustomSQL hook.
 *
 * Executes raw SQL queries against the Prismiq backend with validation.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAnalytics } from '../context/AnalyticsProvider';
import type { QueryResult, SQLValidationResult } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for the useCustomSQL hook.
 */
export interface UseCustomSQLOptions {
  /**
   * Whether the query should be executed.
   * Set to false to disable automatic execution.
   * @default true
   */
  enabled?: boolean;
  /**
   * Named parameters for the query.
   */
  params?: Record<string, unknown>;
  /**
   * Whether to validate before executing.
   * When true, validates first and only executes if valid.
   * @default true
   */
  validateFirst?: boolean;
}

/**
 * Result of the useCustomSQL hook.
 */
export interface UseCustomSQLResult {
  /** The query result data, or null if not yet loaded. */
  data: QueryResult | null;
  /** Whether the query is currently loading. */
  isLoading: boolean;
  /** Error that occurred during query execution, if any. */
  error: Error | null;
  /** Validation result from the last validation check. */
  validation: SQLValidationResult | null;
  /** Whether the SQL is currently being validated. */
  isValidating: boolean;
  /** Function to manually re-execute the query. */
  refetch: () => Promise<void>;
  /** Function to manually validate the SQL without executing. */
  validate: () => Promise<SQLValidationResult>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for executing raw SQL queries against the Prismiq backend.
 *
 * Only SELECT statements are allowed. Queries are restricted
 * to tables visible in the schema.
 *
 * @param sql - The SQL query to execute, or null to skip.
 * @param options - Configuration options.
 *
 * @example
 * ```tsx
 * function SQLResults() {
 *   const sql = "SELECT name, email FROM users WHERE status = 'active'";
 *   const { data, isLoading, error, validation } = useCustomSQL(sql);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *   if (validation && !validation.valid) {
 *     return <ValidationErrors errors={validation.errors} />;
 *   }
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
export function useCustomSQL(
  sql: string | null,
  options: UseCustomSQLOptions = {}
): UseCustomSQLResult {
  const { enabled = true, params, validateFirst = true } = options;

  const { client } = useAnalytics();

  // State
  const [data, setData] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [validation, setValidation] = useState<SQLValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Track the current SQL for memoization
  const previousSqlRef = useRef<string | null>(null);
  const previousParamsRef = useRef<Record<string, unknown> | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Validate SQL function
  const validateSQL = useCallback(async (): Promise<SQLValidationResult> => {
    if (!sql) {
      const result: SQLValidationResult = {
        valid: false,
        errors: ['No SQL provided'],
        tables: [],
      };
      setValidation(result);
      return result;
    }

    setIsValidating(true);

    try {
      const result = await client.validateSQL(sql);
      setValidation(result);
      return result;
    } catch (err) {
      const errorResult: SQLValidationResult = {
        valid: false,
        errors: [err instanceof Error ? err.message : String(err)],
        tables: [],
      };
      setValidation(errorResult);
      return errorResult;
    } finally {
      setIsValidating(false);
    }
  }, [client, sql]);

  // Execute query function
  const executeQuery = useCallback(async () => {
    // Don't execute if SQL is null or disabled
    if (sql === null || !enabled) {
      return;
    }

    // Validate first if requested
    if (validateFirst) {
      const validationResult = await validateSQL();
      if (!validationResult.valid) {
        setError(new Error(validationResult.errors.join('; ')));
        setData(null);
        return;
      }
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
      const result = await client.executeSQL(sql, params);

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
  }, [client, sql, params, enabled, validateFirst, validateSQL]);

  // Refetch function (exposed to consumers)
  const refetch = useCallback(async () => {
    await executeQuery();
  }, [executeQuery]);

  // Check if params changed
  const paramsChanged = useCallback(() => {
    if (params === previousParamsRef.current) return false;
    if (params === undefined || previousParamsRef.current === undefined) {
      return params !== previousParamsRef.current;
    }
    return JSON.stringify(params) !== JSON.stringify(previousParamsRef.current);
  }, [params]);

  // Execute query when dependencies change
  useEffect(() => {
    // Check if SQL or params have actually changed
    const sqlChanged = sql !== previousSqlRef.current;
    const paramsHaveChanged = paramsChanged();

    if (!sqlChanged && !paramsHaveChanged) {
      return;
    }

    previousSqlRef.current = sql;
    previousParamsRef.current = params;

    // Clear data when SQL is null
    if (sql === null) {
      setData(null);
      setError(null);
      setValidation(null);
      setIsLoading(false);
      return;
    }

    // Don't execute if disabled
    if (!enabled) {
      return;
    }

    void executeQuery();
  }, [sql, params, enabled, executeQuery, paramsChanged]);

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
    validation,
    isValidating,
    refetch,
    validate: validateSQL,
  };
}
