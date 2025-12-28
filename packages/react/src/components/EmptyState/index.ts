/**
 * Empty state components for various scenarios.
 *
 * @example
 * ```tsx
 * import { EmptyState, NoData, NoResults, EmptyDashboard } from '@prismiq/react';
 *
 * // Generic empty state
 * <EmptyState
 *   title="No items"
 *   description="Add some items to get started"
 *   action={{ label: "Add Item", onClick: addItem }}
 * />
 *
 * // Query with no data
 * <NoData onRefresh={refetch} />
 *
 * // Search with no results
 * <NoResults searchQuery="xyz" onClearFilters={clearFilters} />
 *
 * // Empty dashboard
 * <EmptyDashboard onAddWidget={openWidgetPalette} />
 * ```
 */

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { NoData } from './NoData';
export type { NoDataProps } from './NoData';

export { NoResults } from './NoResults';
export type { NoResultsProps } from './NoResults';

export { EmptyDashboard } from './EmptyDashboard';
export type { EmptyDashboardProps } from './EmptyDashboard';
