'use client';

import React from 'react';
import { useTheme } from '../../theme';

/**
 * Props for the EmptyState component.
 */
export interface EmptyStateProps {
  /** Custom icon to display */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS class name */
  className?: string;
}

/**
 * Generic empty state component with customizable content.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   title="No data available"
 *   description="Try adjusting your filters"
 *   action={{ label: "Clear Filters", onClick: clearFilters }}
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    minHeight: '200px',
  };

  const iconContainerStyle: React.CSSProperties = {
    marginBottom: '16px',
    color: theme.colors.textMuted,
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
  };

  const descriptionStyle: React.CSSProperties = {
    margin: '0 0 24px 0',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    maxWidth: '400px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.textInverse,
    backgroundColor: theme.colors.primary,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  };

  // Default icon if none provided
  const defaultIcon = (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 15h8" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );

  return (
    <div className={className} style={containerStyle}>
      <div style={iconContainerStyle}>
        {icon || defaultIcon}
      </div>

      <h3 style={titleStyle}>{title}</h3>

      {description && (
        <p style={descriptionStyle}>{description}</p>
      )}

      {action && (
        <button
          style={buttonStyle}
          onClick={action.onClick}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primaryHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primary;
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
