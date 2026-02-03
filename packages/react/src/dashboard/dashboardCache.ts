/**
 * Shared dashboard cache for Dashboard and DashboardEditor components.
 *
 * This module-level cache survives component remounts (including React StrictMode)
 * and allows data sharing between view mode (Dashboard) and edit mode (DashboardEditor).
 */

import type { Dashboard } from './types';

interface CacheEntry {
  data: Dashboard;
  timestamp: number;
}

/** Module-level cache shared across Dashboard and DashboardEditor */
export const dashboardCache = new Map<string, CacheEntry>();

/** Cache TTL in milliseconds (5 seconds) */
export const CACHE_TTL_MS = 5000;

/** Track in-flight fetches to prevent duplicate network requests */
export const inflightFetches = new Map<string, Promise<Dashboard>>();
