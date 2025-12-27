/**
 * Default theme definitions for Prismiq.
 */

import type { PrismiqTheme } from './types';

/**
 * Light theme - the default Prismiq theme.
 */
export const lightTheme: PrismiqTheme = {
  name: 'light',
  colors: {
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    background: '#ffffff',
    surface: '#f9fafb',
    surfaceHover: '#f3f4f6',
    text: '#111827',
    textMuted: '#6b7280',
    textInverse: '#ffffff',
    border: '#e5e7eb',
    borderFocus: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
  },
  fontSizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '8px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  chart: {
    colors: [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#06b6d4', // cyan
      '#f97316', // orange
      '#84cc16', // lime
      '#ec4899', // pink
      '#6366f1', // indigo
    ],
    gridColor: '#e5e7eb',
    axisColor: '#6b7280',
    tooltipBackground: '#111827',
  },
};

/**
 * Dark theme for Prismiq.
 */
export const darkTheme: PrismiqTheme = {
  name: 'dark',
  colors: {
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    background: '#111827',
    surface: '#1f2937',
    surfaceHover: '#374151',
    text: '#f9fafb',
    textMuted: '#9ca3af',
    textInverse: '#111827',
    border: '#374151',
    borderFocus: '#60a5fa',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
  },
  fontSizes: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  radius: {
    none: '0',
    sm: '2px',
    md: '4px',
    lg: '8px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
  },
  chart: {
    colors: [
      '#60a5fa', // blue
      '#34d399', // emerald
      '#fbbf24', // amber
      '#f87171', // red
      '#a78bfa', // violet
      '#22d3ee', // cyan
      '#fb923c', // orange
      '#a3e635', // lime
      '#f472b6', // pink
      '#818cf8', // indigo
    ],
    gridColor: '#374151',
    axisColor: '#9ca3af',
    tooltipBackground: '#1f2937',
  },
};
