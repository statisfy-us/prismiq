'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { useTheme } from '../../theme';

/**
 * Props for the WidgetErrorBoundary component.
 */
export interface WidgetErrorBoundaryProps {
  /** Content to render */
  children: ReactNode;
  /** Title of the widget (for display in error state) */
  widgetTitle?: string;
  /** Callback when an error is caught */
  onError?: (error: Error) => void;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Internal fallback component for widget errors.
 */
function WidgetErrorFallback({
  widgetTitle,
  error,
  onRetry,
}: {
  widgetTitle?: string;
  error: Error;
  onRetry: () => void;
}): React.ReactElement {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '120px',
    padding: '16px',
    backgroundColor: theme.colors.surface,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    marginBottom: '8px',
    color: theme.colors.error,
  };

  const titleStyle: React.CSSProperties = {
    margin: '0 0 4px 0',
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
  };

  const messageStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    maxWidth: '200px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: theme.fontSizes.xs,
    fontWeight: 500,
    color: theme.colors.textInverse,
    backgroundColor: theme.colors.primary,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
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
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <h4 style={titleStyle}>
        {widgetTitle ? `${widgetTitle} failed to load` : 'Widget failed to load'}
      </h4>
      <p style={messageStyle}>{error.message || 'An error occurred'}</p>

      <button
        style={buttonStyle}
        onClick={onRetry}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primaryHover;
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.backgroundColor = theme.colors.primary;
        }}
      >
        Retry
      </button>
    </div>
  );
}

/**
 * Error boundary specifically designed for dashboard widgets.
 *
 * Provides a compact error display that fits within widget containers.
 *
 * @example
 * ```tsx
 * <WidgetErrorBoundary widgetTitle="Sales Chart" onError={logError}>
 *   <BarChart data={data} />
 * </WidgetErrorBoundary>
 * ```
 */
export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;
    if (onError) {
      onError(error);
    }
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('WidgetErrorBoundary caught an error:', error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, widgetTitle } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      return (
        <WidgetErrorFallback
          widgetTitle={widgetTitle}
          error={error}
          onRetry={this.resetError}
        />
      );
    }

    return children;
  }
}

export default WidgetErrorBoundary;
