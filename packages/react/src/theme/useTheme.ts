/**
 * useTheme hook.
 *
 * Provides access to the current theme and mode.
 */

import { useContext } from 'react';

import { ThemeContext } from './ThemeProvider';
import type { ThemeContextValue } from './types';

/**
 * Hook to access the theme context.
 *
 * Must be used within a ThemeProvider.
 *
 * @throws Error if used outside of ThemeProvider.
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { mode, setMode, resolvedMode } = useTheme();
 *
 *   return (
 *     <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
 *       Current: {resolvedMode}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === null) {
    throw new Error(
      'useTheme must be used within a ThemeProvider. ' +
        'Wrap your component tree with <ThemeProvider>.'
    );
  }

  return context;
}
