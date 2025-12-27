/**
 * Theme module exports.
 */

export type {
  PrismiqTheme,
  ThemeMode,
  ThemeContextValue,
  DeepPartial,
} from './types';

export { lightTheme, darkTheme } from './defaults';
export { ThemeProvider } from './ThemeProvider';
export type { ThemeProviderProps } from './ThemeProvider';
export { useTheme } from './useTheme';
