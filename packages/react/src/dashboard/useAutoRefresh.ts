/**
 * Hook for auto-refreshing dashboard data.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Options for useAutoRefresh hook.
 */
export interface UseAutoRefreshOptions {
  /** Refresh callback to execute. */
  onRefresh: () => Promise<void>;
  /** Interval in milliseconds. Set to 0 to disable. */
  intervalMs: number;
  /** Whether to start paused. */
  startPaused?: boolean;
}

/**
 * Result of useAutoRefresh hook.
 */
export interface UseAutoRefreshResult {
  /** Whether auto-refresh is currently active. */
  isActive: boolean;
  /** Time until next refresh in milliseconds. */
  timeUntilRefresh: number;
  /** Pause auto-refresh. */
  pause: () => void;
  /** Resume auto-refresh. */
  resume: () => void;
  /** Toggle auto-refresh. */
  toggle: () => void;
  /** Trigger an immediate refresh. */
  refreshNow: () => Promise<void>;
}

/**
 * Hook for auto-refreshing data at a specified interval.
 *
 * @example
 * ```tsx
 * const { isActive, timeUntilRefresh, pause, resume, refreshNow } = useAutoRefresh({
 *   onRefresh: async () => {
 *     await fetchData();
 *   },
 *   intervalMs: 30000, // 30 seconds
 * });
 *
 * return (
 *   <div>
 *     <button onClick={refreshNow}>Refresh Now</button>
 *     <button onClick={isActive ? pause : resume}>
 *       {isActive ? 'Pause' : 'Resume'}
 *     </button>
 *     <span>Next refresh in: {Math.round(timeUntilRefresh / 1000)}s</span>
 *   </div>
 * );
 * ```
 */
export function useAutoRefresh({
  onRefresh,
  intervalMs,
  startPaused = false,
}: UseAutoRefreshOptions): UseAutoRefreshResult {
  const [isActive, setIsActive] = useState(!startPaused && intervalMs > 0);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(intervalMs);

  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const lastRefreshRef = useRef<number>(Date.now());

  // Clear intervals on cleanup
  const clearIntervals = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = undefined;
    }
  }, []);

  // Execute refresh
  const refreshNow = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    setTimeUntilRefresh(intervalMs);
    await onRefresh();
  }, [onRefresh, intervalMs]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(() => {
    if (intervalMs <= 0) return;

    clearIntervals();

    // Set up main refresh interval
    intervalRef.current = setInterval(() => {
      refreshNow();
    }, intervalMs);

    // Set up countdown timer (updates every second)
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - lastRefreshRef.current;
      const remaining = Math.max(0, intervalMs - elapsed);
      setTimeUntilRefresh(remaining);
    }, 1000);

    setIsActive(true);
  }, [intervalMs, refreshNow, clearIntervals]);

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    clearIntervals();
    setIsActive(false);
  }, [clearIntervals]);

  // Pause
  const pause = useCallback(() => {
    stopAutoRefresh();
  }, [stopAutoRefresh]);

  // Resume
  const resume = useCallback(() => {
    lastRefreshRef.current = Date.now();
    setTimeUntilRefresh(intervalMs);
    startAutoRefresh();
  }, [startAutoRefresh, intervalMs]);

  // Toggle
  const toggle = useCallback(() => {
    if (isActive) {
      pause();
    } else {
      resume();
    }
  }, [isActive, pause, resume]);

  // Initialize on mount
  useEffect(() => {
    if (!startPaused && intervalMs > 0) {
      startAutoRefresh();
    }

    return () => {
      clearIntervals();
    };
  }, [intervalMs, startPaused, startAutoRefresh, clearIntervals]);

  return {
    isActive,
    timeUntilRefresh,
    pause,
    resume,
    toggle,
    refreshNow,
  };
}
