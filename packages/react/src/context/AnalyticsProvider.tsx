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
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { PrismiqClient, type ClientConfig, type ViewType } from '../api/client';
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
  /** Current view type for row-level security filtering. */
  viewType?: ViewType;
  /** Current account ID for account-specific filtering. */
  accountId?: string;
}

/**
 * Props for the AnalyticsProvider component.
 */
export interface AnalyticsProviderProps {
  /** Configuration for the Prismiq client. tenantId and userId are provided via separate props. */
  config: Omit<ClientConfig, 'tenantId' | 'userId' | 'schemaName' | 'viewType' | 'accountId'>;
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
  /**
   * View type for row-level security filtering.
   * - 'all': Show all data (admin view)
   * - 'my_book': Filter to user's assigned accounts
   * - 'account': Filter to a specific account (requires accountId)
   */
  viewType?: ViewType;
  /**
   * Account ID for account-specific filtering.
   * Used when viewType is 'account' to filter data to a single account.
   */
  accountId?: string;
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
// Debug: Track provider instances
let providerInstanceCount = 0;

export function AnalyticsProvider({
  config,
  tenantId,
  userId,
  schemaName,
  viewType,
  accountId,
  onQueryExecute,
  onQueryError,
  onSchemaLoad,
  onSchemaError,
  children,
}: AnalyticsProviderProps): JSX.Element {
  // Debug: Track this provider instance
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    providerInstanceCount++;
    instanceIdRef.current = `provider-${providerInstanceCount}`;
    console.log(`[AnalyticsProvider] Creating instance ${instanceIdRef.current}`);
  }

  // Create client instance ONCE on first render using ref
  // This prevents recreation when props change (which would cause cascading refetches)
  const clientRef = useRef<PrismiqClient | null>(null);
  if (!clientRef.current) {
    console.log(`[AnalyticsProvider ${instanceIdRef.current}] Creating PrismiqClient`);
    clientRef.current = new PrismiqClient({
      ...config,
      tenantId,
      userId,
      schemaName,
      viewType,
      accountId,
    });
  }
  const client = clientRef.current;

  // Schema state
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track if initial schema fetch has been done
  const hasFetchedSchemaRef = useRef(false);

  // Debug: Log mount/unmount
  useEffect(() => {
    console.log(`[AnalyticsProvider ${instanceIdRef.current}] MOUNTED`);
    return () => {
      console.log(`[AnalyticsProvider ${instanceIdRef.current}] UNMOUNTED`);
    };
  }, []);

  // Store callbacks in refs to avoid recreating fetchSchema
  const onSchemaLoadRef = useRef(onSchemaLoad);
  const onSchemaErrorRef = useRef(onSchemaError);
  onSchemaLoadRef.current = onSchemaLoad;
  onSchemaErrorRef.current = onSchemaError;

  // Fetch schema function - stable reference
  const fetchSchema = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedSchema = await client.getSchema();
      setSchema(fetchedSchema);
      onSchemaLoadRef.current?.(fetchedSchema);
    } catch (err) {
      const schemaError = err instanceof Error ? err : new Error(String(err));
      setError(schemaError);
      onSchemaErrorRef.current?.(schemaError);
    } finally {
      setIsLoading(false);
    }
  }, [client]); // Only depends on client, which is now stable

  // Refetch schema function (exposed to consumers)
  const refetchSchema = useCallback(async () => {
    await fetchSchema();
  }, [fetchSchema]);

  // Fetch schema on mount - only once
  useEffect(() => {
    if (hasFetchedSchemaRef.current) return;
    hasFetchedSchemaRef.current = true;
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
      viewType,
      accountId,
    }),
    [client, schema, isLoading, error, refetchSchema, tenantId, userId, schemaName, viewType, accountId]
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
