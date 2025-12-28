/**
 * Hook to access dashboard context.
 */

import { useContext } from 'react';
import { DashboardContext } from './DashboardProvider';
import type { DashboardContextValue } from './types';

/**
 * Hook to access the full dashboard context.
 *
 * Must be used within a DashboardProvider.
 *
 * @returns Dashboard context value
 * @throws Error if used outside DashboardProvider
 *
 * @example
 * ```tsx
 * function DashboardHeader() {
 *   const { dashboard, isLoading, refreshDashboard } = useDashboard();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <header>
 *       <h1>{dashboard?.name}</h1>
 *       <button onClick={refreshDashboard}>Refresh</button>
 *     </header>
 *   );
 * }
 * ```
 */
export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }

  return context;
}
