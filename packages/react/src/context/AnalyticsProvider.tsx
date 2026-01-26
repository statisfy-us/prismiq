/**
 * Analytics Provider and Context.
 *
 * Provides the Prismiq client and schema to React components.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { PrismiqClient, type ClientConfig } from '../api/client';
import type { DatabaseSchema, QueryDefinition, QueryResult } from '../types';

// ============================================================================
// Context Types
// ============================================================================

/**
 * Value provided by the AnalyticsContext.
 */
export interface AnalyticsContextValue {
  /** The Prismiq API client instance. */
  client: PrismiqClient;
  /** The database schema, or null if not yet loaded. */
  schema: DatabaseSchema | null;
  /** Whether the schema is currently loading. */
  isLoading: boolean;
  /** Error that occurred during schema loading, if any. */
  error: Error | null;
  /** Function to manually refresh the schema. */
  refetchSchema: () => Promise<void>;
  /** Current tenant ID for multi-tenant isolation. */
  tenantId: string;
  /** Current user ID for ownership and permissions. */
  userId?: string;
  /** PostgreSQL schema name for per-tenant schema isolation. */
  schemaName?: string;
}

/**
 * Props for the AnalyticsProvider component.
 */
export interface AnalyticsProviderProps {
  /** Configuration for the Prismiq client. */
  config: ClientConfig;
  /**
   * Tenant ID for multi-tenant isolation.
   * All API calls will include this in the X-Tenant-ID header.
   * Required for production use.
   */
  tenantId: string;
  /**
   * User ID for ownership and permissions.
   * Included in X-User-ID header when provided.
   * Used for dashboard ownership and access control.
   */
  userId?: string;
  /**
   * PostgreSQL schema name for per-tenant schema isolation.
   * Included in X-Schema-Name header when provided.
   * Used when each tenant has their own PostgreSQL schema (e.g., "org_123").
   */
  schemaName?: string;
  /** Callback when a query is executed successfully. */
  onQueryExecute?: (query: QueryDefinition, result: QueryResult) => void;
  /** Callback when a query execution fails. */
  onQueryError?: (query: QueryDefinition, error: Error) => void;
  /** Callback when schema is loaded successfully. */
  onSchemaLoad?: (schema: DatabaseSchema) => void;
  /** Callback when schema loading fails. */
  onSchemaError?: (error: Error) => void;
  /** Child components that will have access to the analytics context. */
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

// ============================================================================
// Callbacks Context
// ============================================================================

export interface AnalyticsCallbacks {
  onQueryExecute?: (query: QueryDefinition, result: QueryResult) => void;
  onQueryError?: (query: QueryDefinition, error: Error) => void;
}

const CallbacksContext = createContext<AnalyticsCallbacks>({});

/**
 * Hook to access analytics callbacks.
 * For internal use by components that need to fire callbacks.
 */
export function useAnalyticsCallbacks(): AnalyticsCallbacks {
  return useContext(CallbacksContext);
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Provider component that supplies the Prismiq client and schema to child components.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AnalyticsProvider
 *       config={{ endpoint: 'https://api.example.com' }}
 *       tenantId="my-org-123"
 *       userId="user-456"
 *       onQueryExecute={(query, result) => console.log('Query executed', result)}
 *       onSchemaLoad={(schema) => console.log('Schema loaded', schema.tables.length)}
 *     >
 *       <Dashboard />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */
export function AnalyticsProvider({
  config,
  tenantId,
  userId,
  schemaName,
  onQueryExecute,
  onQueryError,
  onSchemaLoad,
  onSchemaError,
  children,
}: AnalyticsProviderProps): JSX.Element {
  // Create client instance - memoize to prevent recreation on re-renders
  // Include tenantId, userId, and schemaName in the client config
  const client = useMemo(
    () =>
      new PrismiqClient({
        ...config,
        tenantId,
        userId,
        schemaName,
      }),
    [config, tenantId, userId, schemaName]
  );

  // Schema state
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch schema function
  const fetchSchema = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedSchema = await client.getSchema();
      setSchema(fetchedSchema);
      onSchemaLoad?.(fetchedSchema);
    } catch (err) {
      const schemaError = err instanceof Error ? err : new Error(String(err));
      setError(schemaError);
      onSchemaError?.(schemaError);
    } finally {
      setIsLoading(false);
    }
  }, [client, onSchemaLoad, onSchemaError]);

  // Refetch schema function (exposed to consumers)
  const refetchSchema = useCallback(async () => {
    await fetchSchema();
  }, [fetchSchema]);

  // Fetch schema on mount
  useEffect(() => {
    void fetchSchema();
  }, [fetchSchema]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AnalyticsContextValue>(
    () => ({
      client,
      schema,
      isLoading,
      error,
      refetchSchema,
      tenantId,
      userId,
      schemaName,
    }),
    [client, schema, isLoading, error, refetchSchema, tenantId, userId, schemaName]
  );

  // Memoize callbacks
  const callbacks = useMemo<AnalyticsCallbacks>(
    () => ({
      onQueryExecute,
      onQueryError,
    }),
    [onQueryExecute, onQueryError]
  );

  return (
    <AnalyticsContext.Provider value={contextValue}>
      <CallbacksContext.Provider value={callbacks}>
        {children}
      </CallbacksContext.Provider>
    </AnalyticsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the analytics context.
 *
 * Must be used within an AnalyticsProvider.
 *
 * @throws Error if used outside of AnalyticsProvider.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { client, schema, isLoading, error } = useAnalytics();
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error.message} />;
 *
 *   return <TableList tables={schema?.tables ?? []} />;
 * }
 * ```
 */
export function useAnalytics(): AnalyticsContextValue {
  const context = useContext(AnalyticsContext);

  if (context === null) {
    throw new Error(
      'useAnalytics must be used within an AnalyticsProvider. ' +
        'Wrap your component tree with <AnalyticsProvider config={...}>.'
    );
  }

  return context;
}

/**
 * Hook to access tenant and user information.
 *
 * Convenience hook for components that only need tenant/user context.
 *
 * @example
 * ```tsx
 * function UserInfo() {
 *   const { tenantId, userId, schemaName } = useTenant();
 *   return <span>Tenant: {tenantId}, User: {userId ?? 'anonymous'}</span>;
 * }
 * ```
 */
export function useTenant(): { tenantId: string; userId?: string; schemaName?: string } {
  const { tenantId, userId, schemaName } = useAnalytics();
  return { tenantId, userId, schemaName };
}
