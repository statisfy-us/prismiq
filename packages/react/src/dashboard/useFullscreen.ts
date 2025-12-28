/**
 * Hook for managing fullscreen mode.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Result of useFullscreen hook.
 */
export interface UseFullscreenResult {
  /** Whether fullscreen mode is currently active. */
  isFullscreen: boolean;
  /** Enter fullscreen mode. */
  enterFullscreen: () => Promise<void>;
  /** Exit fullscreen mode. */
  exitFullscreen: () => Promise<void>;
  /** Toggle fullscreen mode. */
  toggleFullscreen: () => Promise<void>;
  /** Ref to attach to the element that should become fullscreen. */
  ref: React.RefObject<HTMLDivElement>;
}

// Extended element interface for webkit fullscreen
interface FullscreenElement extends Element {
  webkitRequestFullscreen?: () => Promise<void>;
}

// Extended document interface for webkit fullscreen
interface FullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void>;
}

/**
 * Hook for managing fullscreen mode on an element.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { isFullscreen, toggleFullscreen, ref } = useFullscreen();
 *
 *   return (
 *     <div ref={ref}>
 *       <button onClick={toggleFullscreen}>
 *         {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
 *       </button>
 *       <DashboardContent />
 *     </div>
 *   );
 * }
 * ```
 */
export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Track fullscreen changes from browser events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === ref.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    if (!ref.current) return;

    try {
      const element = ref.current as FullscreenElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (error) {
      console.warn('Failed to enter fullscreen:', error);
    }
  }, []);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as FullscreenDocument;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      setIsFullscreen(false);
    } catch (error) {
      console.warn('Failed to exit fullscreen:', error);
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    ref,
  };
}
