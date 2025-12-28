'use client';

import React from 'react';
import { useTheme } from '../../theme';
import { EmptyState } from './EmptyState';

/**
 * Props for the NoResults component.
 */
export interface NoResultsProps {
  /** The search query that returned no results */
  searchQuery?: string;
  /** Callback when clear filters button is clicked */
  onClearFilters?: () => void;
  /** Additional CSS class name */
  className?: string;
}

/**
 * Empty state for when a search or filter returns no results.
 *
 * @example
 * ```tsx
 * <NoResults searchQuery="xyz123" onClearFilters={clearFilters} />
 * ```
 */
export function NoResults({
  searchQuery,
  onClearFilters,
  className,
}: NoResultsProps): React.ReactElement {
  const { theme } = useTheme();

  const icon = (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke={theme.colors.textMuted}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Search with X */}
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      {/* X mark inside */}
      <path d="M8 8l6 6" opacity="0.5" />
      <path d="M14 8l-6 6" opacity="0.5" />
    </svg>
  );

  const title = searchQuery
    ? `No results for "${searchQuery}"`
    : 'No matching results';

  const description = searchQuery
    ? 'Try using different keywords or adjusting your filters.'
    : 'Try adjusting your filters to see more results.';

  return (
    <EmptyState
      className={className}
      icon={icon}
      title={title}
      description={description}
      action={onClearFilters ? { label: 'Clear Filters', onClick: onClearFilters } : undefined}
    />
  );
}

export default NoResults;
