/**
 * Skeleton loading placeholder components.
 *
 * These components provide visual feedback while content is loading,
 * using shimmer animations to indicate activity.
 *
 * @example
 * ```tsx
 * import { Skeleton, SkeletonText, SkeletonChart, SkeletonTable, SkeletonMetricCard } from '@prismiq/react';
 *
 * // Loading state for a chart
 * function ChartContainer({ isLoading, data }) {
 *   if (isLoading) {
 *     return <SkeletonChart type="bar" height={300} />;
 *   }
 *   return <BarChart data={data} />;
 * }
 * ```
 */

export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { SkeletonText } from './SkeletonText';
export type { SkeletonTextProps } from './SkeletonText';

export { SkeletonChart } from './SkeletonChart';
export type { SkeletonChartProps } from './SkeletonChart';

export { SkeletonTable } from './SkeletonTable';
export type { SkeletonTableProps } from './SkeletonTable';

export { SkeletonMetricCard } from './SkeletonMetricCard';
export type { SkeletonMetricCardProps } from './SkeletonMetricCard';
