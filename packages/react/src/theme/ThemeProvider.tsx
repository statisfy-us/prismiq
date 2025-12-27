/**
 * Theme Provider for Prismiq.
 *
 * Provides theme context and injects CSS variables into the document.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { darkTheme, lightTheme } from './defaults';
import type { DeepPartial, PrismiqTheme, ThemeContextValue, ThemeMode } from './types';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'prismiq-theme-mode';
const CSS_VAR_PREFIX = '--prismiq';

// ============================================================================
// Context
// ============================================================================

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// Utilities
// ============================================================================

/**
 * Deep merge two objects.
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as object,
        sourceValue as DeepPartial<object>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Convert a theme object to CSS variable declarations.
 */
function themeToCSSVariables(theme: PrismiqTheme): string {
  const vars: string[] = [];

  // Colors
  for (const [key, value] of Object.entries(theme.colors)) {
    vars.push(`${CSS_VAR_PREFIX}-color-${kebabCase(key)}: ${value}`);
  }

  // Fonts
  vars.push(`${CSS_VAR_PREFIX}-font-sans: ${theme.fonts.sans}`);
  vars.push(`${CSS_VAR_PREFIX}-font-mono: ${theme.fonts.mono}`);

  // Font sizes
  for (const [key, value] of Object.entries(theme.fontSizes)) {
    vars.push(`${CSS_VAR_PREFIX}-font-size-${key}: ${value}`);
  }

  // Spacing
  for (const [key, value] of Object.entries(theme.spacing)) {
    vars.push(`${CSS_VAR_PREFIX}-spacing-${key}: ${value}`);
  }

  // Radius
  for (const [key, value] of Object.entries(theme.radius)) {
    vars.push(`${CSS_VAR_PREFIX}-radius-${key}: ${value}`);
  }

  // Shadows
  for (const [key, value] of Object.entries(theme.shadows)) {
    vars.push(`${CSS_VAR_PREFIX}-shadow-${key}: ${value}`);
  }

  // Chart colors
  theme.chart.colors.forEach((color, index) => {
    vars.push(`${CSS_VAR_PREFIX}-chart-color-${index + 1}: ${color}`);
  });
  vars.push(`${CSS_VAR_PREFIX}-chart-grid: ${theme.chart.gridColor}`);
  vars.push(`${CSS_VAR_PREFIX}-chart-axis: ${theme.chart.axisColor}`);
  vars.push(`${CSS_VAR_PREFIX}-chart-tooltip-bg: ${theme.chart.tooltipBackground}`);

  return vars.join(';\n') + ';';
}

/**
 * Convert camelCase to kebab-case.
 */
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Detect system color scheme preference.
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get stored theme mode from localStorage.
 */
function getStoredMode(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

/**
 * Store theme mode to localStorage.
 */
function storeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// Provider Props
// ============================================================================

export interface ThemeProviderProps {
  /** Child components. */
  children: ReactNode;
  /** Initial theme mode. If not set, uses stored mode or system preference. */
  defaultMode?: ThemeMode;
  /** Custom theme overrides for light mode. */
  lightTheme?: DeepPartial<PrismiqTheme>;
  /** Custom theme overrides for dark mode. */
  darkTheme?: DeepPartial<PrismiqTheme>;
  /** Custom class name for the wrapper element. */
  className?: string;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Theme provider that manages theme mode and injects CSS variables.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ThemeProvider defaultMode="system">
 *       <Dashboard />
 *     </ThemeProvider>
 *   );
 * }
 * ```
 */
export function ThemeProvider({
  children,
  defaultMode,
  lightTheme: customLightTheme,
  darkTheme: customDarkTheme,
  className,
}: ThemeProviderProps): JSX.Element {
  // Initialize mode from stored value, prop, or default to system
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getStoredMode();
    return stored ?? defaultMode ?? 'system';
  });

  // Track system theme preference
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Compute resolved mode
  const resolvedMode = mode === 'system' ? systemTheme : mode;

  // Build merged themes
  const mergedLightTheme = useMemo(
    () => (customLightTheme ? deepMerge(lightTheme, customLightTheme) : lightTheme),
    [customLightTheme]
  );

  const mergedDarkTheme = useMemo(
    () => (customDarkTheme ? deepMerge(darkTheme, customDarkTheme) : darkTheme),
    [customDarkTheme]
  );

  // Get current theme based on resolved mode
  const theme = resolvedMode === 'dark' ? mergedDarkTheme : mergedLightTheme;

  // Set mode and persist to localStorage
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    storeMode(newMode);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    // Legacy browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  // Inject CSS variables
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'prismiq-theme-vars';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    const cssVars = themeToCSSVariables(theme);
    styleElement.textContent = `:root {\n${cssVars}\n}`;

    return () => {
      // Don't remove on cleanup - another instance may need it
    };
  }, [theme]);

  // Memoize context value
  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      setMode,
      resolvedMode,
    }),
    [theme, mode, setMode, resolvedMode]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <div
        className={className}
        data-prismiq-theme={resolvedMode}
        style={{
          fontFamily: 'var(--prismiq-font-sans)',
          fontSize: 'var(--prismiq-font-size-base)',
          color: 'var(--prismiq-color-text)',
          backgroundColor: 'var(--prismiq-color-background)',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
