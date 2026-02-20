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

export { useDebouncedLayoutSave } from './useDebouncedLayoutSave';
export type {
  SaveStatus,
  UseDebouncedLayoutSaveOptions,
  UseDebouncedLayoutSaveResult,
} from './useDebouncedLayoutSave';

export { useSavedQueries } from './useSavedQueries';
export type {
  UseSavedQueriesOptions,
  UseSavedQueriesResult,
} from './useSavedQueries';

export { useCustomSQL } from './useCustomSQL';
export type {
  UseCustomSQLOptions,
  UseCustomSQLResult,
} from './useCustomSQL';

export { usePinnedDashboards } from './usePinnedDashboards';
export type {
  UsePinnedDashboardsOptions,
  UsePinnedDashboardsResult,
} from './usePinnedDashboards';

export { usePinMutations } from './usePinMutations';
export type {
  PinMutationState,
  UsePinMutationsResult,
} from './usePinMutations';

export { useDashboardPinStatus } from './useDashboardPinStatus';
export type {
  UseDashboardPinStatusOptions,
  UseDashboardPinStatusResult,
} from './useDashboardPinStatus';

export { useLLMStatus } from './useLLMStatus';
export type { UseLLMStatusResult } from './useLLMStatus';

export { useLLMChat } from './useLLMChat';
export type { UseLLMChatResult } from './useLLMChat';
