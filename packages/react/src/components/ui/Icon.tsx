/**
 * Icon component.
 *
 * Provides a set of commonly used icons as SVG components.
 */

import { forwardRef, type SVGAttributes } from 'react';

// ============================================================================
// Types
// ============================================================================

export type IconName =
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'x'
  | 'plus'
  | 'minus'
  | 'check'
  | 'search'
  | 'filter'
  | 'sort-asc'
  | 'sort-desc'
  | 'drag'
  | 'table'
  | 'column'
  | 'key'
  | 'link'
  | 'play'
  | 'refresh'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'download'
  | 'settings'
  | 'sun'
  | 'moon'
  | 'info'
  | 'warning'
  | 'error';

export interface IconProps extends SVGAttributes<SVGSVGElement> {
  /** Icon name. */
  name: IconName;
  /** Icon size in pixels. */
  size?: number;
}

// ============================================================================
// Icon Paths
// ============================================================================

const iconPaths: Record<IconName, string> = {
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'x': 'M18 6L6 18M6 6l12 12',
  'plus': 'M12 5v14M5 12h14',
  'minus': 'M5 12h14',
  'check': 'M5 12l5 5L20 7',
  'search': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  'filter': 'M3 4h18l-7 8.5V18l-4 2v-7.5L3 4z',
  'sort-asc': 'M3 4h13M3 8h9M3 12h5m4 0l4-4m0 0l4 4m-4-4v12',
  'sort-desc': 'M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4',
  'drag': 'M4 8h16M4 16h16',
  'table': 'M3 10h18M3 14h18M3 6h18v12H3V6zm5 0v12m5-12v12',
  'column': 'M10 3v18M3 3h18v18H3V3z',
  'key': 'M15 7a2 2 0 11-4 0 2 2 0 014 0zm-2 2v2m0 0l-4 4m4-4l4 4',
  'link': 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  'play': 'M5 3l14 9-14 9V3z',
  'refresh': 'M4 4v5h5M20 20v-5h-5M20.5 9A8.5 8.5 0 003.5 15M3.5 15A8.5 8.5 0 0020.5 9',
  'trash': 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  'edit': 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z',
  'copy': 'M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2v-2M8 4h12v12H8V4z',
  'download': 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3',
  'settings': 'M12 15a3 3 0 100-6 3 3 0 000 6zm9.4-.5l-1.6-1a7.01 7.01 0 000-3l1.6-1a1 1 0 00.2-1.3l-2-3.5a1 1 0 00-1.2-.4l-1.8.7a6.97 6.97 0 00-2.6-1.5l-.3-2A1 1 0 0012.7 2h-4a1 1 0 00-1 .9l-.3 2a6.97 6.97 0 00-2.6 1.5l-1.8-.7a1 1 0 00-1.2.4l-2 3.5a1 1 0 00.2 1.3l1.6 1a7.01 7.01 0 000 3l-1.6 1a1 1 0 00-.2 1.3l2 3.5a1 1 0 001.2.4l1.8-.7a6.97 6.97 0 002.6 1.5l.3 2a1 1 0 001 .9h4a1 1 0 001-.9l.3-2a6.97 6.97 0 002.6-1.5l1.8.7a1 1 0 001.2-.4l2-3.5a1 1 0 00-.2-1.3z',
  'sun': 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.36-6.36l-.7.7m-10.6 10.6l-.7.7m12.7.1l-.7-.7m-10.6-10.6l-.7-.7M17 12a5 5 0 11-10 0 5 5 0 0110 0z',
  'moon': 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
  'info': 'M12 8v.01M12 12v4m0 4a8 8 0 100-16 8 8 0 000 16z',
  'warning': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  'error': 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Icon component rendering SVG icons.
 *
 * @example
 * ```tsx
 * <Icon name="search" size={20} />
 * <Icon name="plus" style={{ color: 'var(--prismiq-color-primary)' }} />
 * ```
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 16, style, className, ...props },
  ref
) {
  const path = iconPaths[name];

  if (!path) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      <path d={path} />
    </svg>
  );
});
