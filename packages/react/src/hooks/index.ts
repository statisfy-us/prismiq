/**
 * Hooks module exports.
 */

// Re-export useAnalytics from context for convenience
export { useAnalytics } from '../context/AnalyticsProvider';

export { useSchema } from './useSchema';
export type { UseSchemaResult } from './useSchema';

export { useQuery } from './useQuery';
export type { UseQueryOptions, UseQueryResult } from './useQuery';

export { useChartData } from './useChartData';

export { useDashboards } from './useDashboards';
export type { UseDashboardsOptions, UseDashboardsResult } from './useDashboards';

export { useDashboard } from './useDashboard';
export type { UseDashboardOptions, UseDashboardResult } from './useDashboard';

export { useDashboardMutations } from './useDashboardMutations';
export type {
  MutationState,
  UseDashboardMutationsResult,
} from './useDashboardMutations';
