/**
 * Hook for tracking widget visibility using Intersection Observer.
 *
 * Used for scroll-based lazy loading of dashboard widgets.
 */

import { useRef, useState, useEffect } from 'react';

/**
 * Options for the useWidgetVisibility hook.
 */
export interface UseWidgetVisibilityOptions {
  /** Root margin for prefetching (default: "200px"). */
  rootMargin?: string;
  /** Intersection threshold (default: 0.1 - 10% visible triggers). */
  threshold?: number;
  /** Callback when visibility changes. */
  onVisibilityChange?: (isVisible: boolean) => void;
}

/**
 * Result of the useWidgetVisibility hook.
 */
export interface UseWidgetVisibilityResult {
  /** Ref to attach to the widget container element. */
  ref: React.RefObject<HTMLDivElement>;
  /** Whether the widget is currently visible or approaching viewport. */
  isVisible: boolean;
  /** Whether the widget has ever been visible (stays true once set). */
  hasBeenVisible: boolean;
}

/**
 * Hook that uses Intersection Observer to track element visibility.
 *
 * Features:
 * - Detects when element enters/exits viewport with configurable margin
 * - Tracks "hasBeenVisible" state that stays true once element is seen
 * - Supports prefetching via rootMargin (loads before element is visible)
 *
 * @example
 * ```tsx
 * function LazyWidget({ widget }) {
 *   const { ref, isVisible, hasBeenVisible } = useWidgetVisibility({
 *     rootMargin: '200px',  // Start loading 200px before visible
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {hasBeenVisible ? <ActualContent /> : <Placeholder />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWidgetVisibility(
  options: UseWidgetVisibilityOptions = {}
): UseWidgetVisibilityResult {
  const { rootMargin = '200px', threshold = 0.1, onVisibilityChange } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  // Store callback in ref to avoid recreation of observer
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  onVisibilityChangeRef.current = onVisibilityChange;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: treat as always visible if no IntersectionObserver
      setIsVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        const visible = entry.isIntersecting;
        setIsVisible(visible);

        if (visible) {
          setHasBeenVisible(true);
        }

        onVisibilityChangeRef.current?.(visible);
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return { ref, isVisible, hasBeenVisible };
}
