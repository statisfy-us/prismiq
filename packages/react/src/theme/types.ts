/**
 * Theme type definitions for Prismiq.
 */

/**
 * Complete theme configuration for Prismiq components.
 */
export interface PrismiqTheme {
  /** Theme identifier name. */
  name: string;
  /** Color palette. */
  colors: {
    /** Primary brand color. */
    primary: string;
    /** Primary color on hover. */
    primaryHover: string;
    /** Page background color. */
    background: string;
    /** Surface/card background color. */
    surface: string;
    /** Surface color on hover. */
    surfaceHover: string;
    /** Primary text color. */
    text: string;
    /** Secondary/muted text color. */
    textMuted: string;
    /** Text color for use on primary backgrounds. */
    textInverse: string;
    /** Border color. */
    border: string;
    /** Border color when focused. */
    borderFocus: string;
    /** Success state color. */
    success: string;
    /** Warning state color. */
    warning: string;
    /** Error state color. */
    error: string;
    /** Info state color. */
    info: string;
  };
  /** Font families. */
  fonts: {
    /** Sans-serif font stack. */
    sans: string;
    /** Monospace font stack for code. */
    mono: string;
  };
  /** Font sizes. */
  fontSizes: {
    /** Extra small (10px). */
    xs: string;
    /** Small (12px). */
    sm: string;
    /** Base (14px). */
    base: string;
    /** Large (16px). */
    lg: string;
    /** Extra large (18px). */
    xl: string;
    /** 2x extra large (20px). */
    '2xl': string;
  };
  /** Spacing values. */
  spacing: {
    /** Extra small (4px). */
    xs: string;
    /** Small (8px). */
    sm: string;
    /** Medium (12px). */
    md: string;
    /** Large (16px). */
    lg: string;
    /** Extra large (24px). */
    xl: string;
  };
  /** Border radius values. */
  radius: {
    /** No radius (0). */
    none: string;
    /** Small radius (2px). */
    sm: string;
    /** Medium radius (4px). */
    md: string;
    /** Large radius (8px). */
    lg: string;
    /** Full/pill radius (9999px). */
    full: string;
  };
  /** Box shadow values. */
  shadows: {
    /** Small shadow. */
    sm: string;
    /** Medium shadow. */
    md: string;
    /** Large shadow. */
    lg: string;
  };
  /** Chart-specific theme values. */
  chart: {
    /** Color palette for chart series. */
    colors: string[];
    /** Grid line color. */
    gridColor: string;
    /** Axis line and label color. */
    axisColor: string;
    /** Tooltip background color. */
    tooltipBackground: string;
  };
}

/**
 * Theme mode options.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Value provided by the ThemeContext.
 */
export interface ThemeContextValue {
  /** The currently active theme. */
  theme: PrismiqTheme;
  /** The current theme mode setting. */
  mode: ThemeMode;
  /** Function to change the theme mode. */
  setMode: (mode: ThemeMode) => void;
  /** The resolved mode (light or dark) after system detection. */
  resolvedMode: 'light' | 'dark';
}

/**
 * Deep partial type for theme customization.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
