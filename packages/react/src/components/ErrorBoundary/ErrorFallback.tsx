'use client';

import React, { useState } from 'react';
import { useTheme } from '../../theme';

/**
 * Props for the ErrorFallback component.
 */
export interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error;
  /** Function to reset the error state */
  resetError: () => void;
  /** Custom title for the error display */
  title?: string;
  /** Whether to show error details */
  showDetails?: boolean;
}

/**
 * Default error fallback UI component.
 *
 * @example
 * ```tsx
 * <ErrorFallback
 *   error={error}
 *   resetError={reset}
 *   title="Chart Error"
 *   showDetails={true}
 * />
 * ```
 */
export function ErrorFallback({
  error,
  resetError,
  title = 'Something went wrong',
  showDetails = false,
}: ErrorFallbackProps): React.ReactElement {
  const { theme } = useTheme();
  const [detailsVisible, setDetailsVisible] = useState(showDetails);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    minHeight: '200px',
    backgroundColor: theme.colors.surface,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    marginBottom: '16px',
    color: theme.colors.error,
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
  };

  const messageStyle: React.CSSProperties = {
    margin: '0 0 16px 0',
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

  const detailsButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    marginLeft: '8px',
  };

  const detailsStyle: React.CSSProperties = {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: theme.colors.background,
    borderRadius: '6px',
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'left',
    maxWidth: '100%',
    overflow: 'auto',
  };

  const codeStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes.xs,
    fontFamily: theme.fonts.mono,
    color: theme.colors.error,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div style={containerStyle} role="alert">
      {/* Error icon */}
      <svg
        style={iconStyle}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <h3 style={titleStyle}>{title}</h3>
      <p style={messageStyle}>{error.message || 'An unexpected error occurred.'}</p>

      <div>
        <button
          style={buttonStyle}
          onClick={resetError}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primaryHover;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primary;
          }}
        >
          Try Again
        </button>
        <button
          style={detailsButtonStyle}
          onClick={() => setDetailsVisible(!detailsVisible)}
        >
          {detailsVisible ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {detailsVisible && (
        <div style={detailsStyle}>
          <pre style={codeStyle}>
            {error.stack || `${error.name}: ${error.message}`}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ErrorFallback;
