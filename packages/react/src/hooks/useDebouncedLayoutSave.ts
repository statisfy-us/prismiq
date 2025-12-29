/**
 * useDebouncedLayoutSave hook.
 *
 * Debounces layout position updates to reduce API calls during drag/resize.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import { useDashboardMutations } from './useDashboardMutations';
import type { WidgetPositionUpdate } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Save status states.
 */
export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Options for useDebouncedLayoutSave.
 */
export interface UseDebouncedLayoutSaveOptions {
  /** Dashboard ID. */
  dashboardId: string;
  /** Debounce delay in milliseconds. */
  debounceMs?: number;
  /** How long to show "Saved" status. */
  savedDurationMs?: number;
  /** Callback on save success. */
  onSave?: () => void;
  /** Callback on save error. */
  onError?: (error: Error) => void;
}

/**
 * Result of useDebouncedLayoutSave.
 */
export interface UseDebouncedLayoutSaveResult {
  /** Queue a layout update (will be debounced). */
  queueUpdate: (positions: WidgetPositionUpdate[]) => void;
  /** Current save status. */
  status: SaveStatus;
  /** Last error if any. */
  error: Error | null;
  /** Force save immediately (flush pending). */
  flush: () => Promise<void>;
  /** Cancel pending save. */
  cancel: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for debounced layout updates.
 *
 * Queues layout changes and saves them after a debounce period.
 * Shows visual feedback for pending/saving/saved/error states.
 *
 * @example
 * ```tsx
 * function EditableDashboard({ id }: { id: string }) {
 *   const { queueUpdate, status, error } = useDebouncedLayoutSave({
 *     dashboardId: id,
 *     debounceMs: 500,
 *     savedDurationMs: 2000,
 *   });
 *
 *   const handleLayoutChange = (positions: Record<string, WidgetPosition>) => {
 *     const updates = Object.entries(positions).map(([id, pos]) => ({
 *       widget_id: id,
 *       position: pos,
 *     }));
 *     queueUpdate(updates);
 *   };
 *
 *   return (
 *     <>
 *       <AutoSaveIndicator status={status} error={error} />
 *       <DashboardLayout onLayoutChange={handleLayoutChange} />
 *     </>
 *   );
 * }
 * ```
 */
export function useDebouncedLayoutSave({
  dashboardId,
  debounceMs = 500,
  savedDurationMs = 2000,
  onSave,
  onError,
}: UseDebouncedLayoutSaveOptions): UseDebouncedLayoutSaveResult {
  const { updateLayout } = useDashboardMutations();

  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // Track pending positions
  const pendingRef = useRef<WidgetPositionUpdate[] | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  // Save function
  const save = useCallback(
    async (positions: WidgetPositionUpdate[]) => {
      setStatus('saving');
      setError(null);

      try {
        await updateLayout(dashboardId, positions);

        setStatus('saved');
        onSave?.();

        // Reset to idle after showing "Saved"
        savedTimeoutRef.current = setTimeout(() => {
          setStatus('idle');
        }, savedDurationMs);
      } catch (e) {
        const err = e instanceof Error ? e : new Error('Failed to save layout');
        setStatus('error');
        setError(err);
        onError?.(err);
      }
    },
    [dashboardId, updateLayout, savedDurationMs, onSave, onError]
  );

  // Queue update with debounce
  const queueUpdate = useCallback(
    (positions: WidgetPositionUpdate[]) => {
      pendingRef.current = positions;
      setStatus('pending');

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Clear saved timeout if showing saved
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }

      // Schedule save
      timeoutRef.current = setTimeout(() => {
        if (pendingRef.current) {
          save(pendingRef.current);
          pendingRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, save]
  );

  // Flush pending save immediately
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingRef.current) {
      const positions = pendingRef.current;
      pendingRef.current = null;
      await save(positions);
    }
  }, [save]);

  // Cancel pending save
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingRef.current = null;
    setStatus('idle');
  }, []);

  return {
    queueUpdate,
    status,
    error,
    flush,
    cancel,
  };
}
