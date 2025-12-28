'use client';

/**
 * SSR (Server-Side Rendering) utilities for Next.js compatibility.
 *
 * These utilities help components work correctly with:
 * - Next.js App Router
 * - React Server Components
 * - Hydration
 *
 * @example
 * ```tsx
 * import { useIsClient, ClientOnly } from '@prismiq/react/ssr';
 *
 * function MyComponent() {
 *   const isClient = useIsClient();
 *
 *   if (!isClient) {
 *     return <Skeleton />;
 *   }
 *
 *   return <Chart data={data} />;
 * }
 *
 * // Or use ClientOnly wrapper
 * <ClientOnly fallback={<Skeleton />}>
 *   <Chart data={data} />
 * </ClientOnly>
 * ```
 */

import { useEffect, useState, type ReactNode } from 'react';

// ============================================================================
// useIsClient Hook
// ============================================================================

/**
 * Hook that returns true when running in the browser.
 *
 * Useful for:
 * - Conditionally rendering browser-only components
 * - Avoiding hydration mismatches
 * - Waiting for window/document access
 *
 * @returns true when running in browser, false during SSR
 *
 * @example
 * ```tsx
 * function WindowSize() {
 *   const isClient = useIsClient();
 *
 *   if (!isClient) {
 *     return <span>Loading...</span>;
 *   }
 *
 *   return <span>{window.innerWidth}px</span>;
 * }
 * ```
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

// ============================================================================
// ClientOnly Component
// ============================================================================

export interface ClientOnlyProps {
  /** Content to render on the client. */
  children: ReactNode;
  /** Fallback content to show during SSR. */
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client.
 *
 * Use this to wrap components that:
 * - Access window or document
 * - Use browser-only APIs
 * - Would cause hydration mismatches
 *
 * @example
 * ```tsx
 * <ClientOnly fallback={<SkeletonChart type="bar" />}>
 *   <BarChart data={data} />
 * </ClientOnly>
 * ```
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps): ReactNode {
  const isClient = useIsClient();

  if (!isClient) {
    return fallback;
  }

  return children;
}

// ============================================================================
// Safe Window/Document Access
// ============================================================================

/**
 * Safely get window width (returns default during SSR).
 *
 * @param defaultWidth - Default width to return during SSR
 * @returns Current window width or default
 */
export function getWindowWidth(defaultWidth = 1200): number {
  if (typeof window === 'undefined') {
    return defaultWidth;
  }
  return window.innerWidth;
}

/**
 * Safely get window height (returns default during SSR).
 *
 * @param defaultHeight - Default height to return during SSR
 * @returns Current window height or default
 */
export function getWindowHeight(defaultHeight = 800): number {
  if (typeof window === 'undefined') {
    return defaultHeight;
  }
  return window.innerHeight;
}

/**
 * Check if code is running in browser environment.
 *
 * @returns true if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if code is running in server environment.
 *
 * @returns true if running on server
 */
export function isServer(): boolean {
  return !isBrowser();
}

// ============================================================================
// Hydration-Safe Storage
// ============================================================================

/**
 * Safely get a value from localStorage.
 *
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist or during SSR
 * @returns Stored value or default
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely set a value in localStorage.
 *
 * @param key - Storage key
 * @param value - Value to store
 */
export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage might be full or disabled
  }
}

/**
 * Safely remove a value from localStorage.
 *
 * @param key - Storage key to remove
 */
export function removeLocalStorage(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Storage might be disabled
  }
}

// ============================================================================
// useWindowSize Hook
// ============================================================================

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * Hook to get and track window size with SSR support.
 *
 * @param defaultSize - Default size to use during SSR
 * @returns Current window size
 *
 * @example
 * ```tsx
 * function ResponsiveComponent() {
 *   const { width } = useWindowSize();
 *
 *   if (width < 768) {
 *     return <MobileView />;
 *   }
 *
 *   return <DesktopView />;
 * }
 * ```
 */
export function useWindowSize(
  defaultSize: WindowSize = { width: 1200, height: 800 }
): WindowSize {
  const [size, setSize] = useState<WindowSize>(defaultSize);

  useEffect(() => {
    // Update to actual window size on mount
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// ============================================================================
// useMediaQuery Hook
// ============================================================================

/**
 * Hook to check if a media query matches with SSR support.
 *
 * @param query - CSS media query string
 * @param defaultValue - Default value during SSR
 * @returns Whether the media query matches
 *
 * @example
 * ```tsx
 * function ResponsiveComponent() {
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 *
 *   return isMobile ? <MobileView /> : <DesktopView />;
 * }
 * ```
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [query]);

  return matches;
}

// ============================================================================
// Breakpoint Hooks
// ============================================================================

/**
 * Default breakpoints matching common design systems.
 */
export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Hook to get current breakpoint with SSR support.
 *
 * @param defaultBreakpoint - Default breakpoint during SSR
 * @returns Current breakpoint
 *
 * @example
 * ```tsx
 * function ResponsiveComponent() {
 *   const breakpoint = useBreakpoint();
 *
 *   const columns = {
 *     xs: 1,
 *     sm: 2,
 *     md: 3,
 *     lg: 4,
 *     xl: 6,
 *     '2xl': 6,
 *   }[breakpoint];
 *
 *   return <Grid columns={columns} />;
 * }
 * ```
 */
export function useBreakpoint(defaultBreakpoint: Breakpoint = 'lg'): Breakpoint {
  const { width } = useWindowSize({ width: BREAKPOINTS[defaultBreakpoint], height: 800 });

  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * Hook to check if current width is at or above a breakpoint.
 *
 * @param breakpoint - Breakpoint to check
 * @param defaultValue - Default value during SSR
 * @returns Whether width is at or above breakpoint
 */
export function useIsBreakpoint(breakpoint: Breakpoint, defaultValue = true): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`, defaultValue);
}
