/**
 * @prismiq/react - React SDK for Prismiq embedded analytics
 *
 * @example
 * ```tsx
 * import { AnalyticsProvider, useQuery } from '@prismiq/react';
 *
 * function App() {
 *   return (
 *     <AnalyticsProvider config={{ endpoint: 'https://api.example.com' }}>
 *       <Dashboard />
 *     </AnalyticsProvider>
 *   );
 * }
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Schema types
  ColumnSchema,
  TableSchema,
  Relationship,
  DatabaseSchema,
  // Query types
  QueryTable,
  JoinType,
  JoinDefinition,
  AggregationType,
  ColumnSelection,
  FilterOperator,
  FilterDefinition,
  SortDirection,
  SortDefinition,
  GroupByDefinition,
  QueryDefinition,
  // Result types
  QueryResult,
  ValidationResult,
} from './types';

// ============================================================================
// API Client
// ============================================================================

export { PrismiqClient, PrismiqError } from './api';
export type { ClientConfig } from './api';

// ============================================================================
// Context
// ============================================================================

export { AnalyticsProvider, useAnalytics } from './context';
export type { AnalyticsContextValue, AnalyticsProviderProps } from './context';

// ============================================================================
// Hooks
// ============================================================================

export { useSchema, useQuery } from './hooks';
export type { UseSchemaResult, UseQueryResult, UseQueryOptions } from './hooks';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';
