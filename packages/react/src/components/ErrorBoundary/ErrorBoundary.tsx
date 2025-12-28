'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Content to render */
  children: ReactNode;
  /** Custom fallback UI or render function */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Reset the error boundary when these values change */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<div>Something went wrong</div>}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With error handler
 * <ErrorBoundary onError={(error) => logError(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With reset keys (resets when values change)
 * <ErrorBoundary resetKeys={[userId]}>
 *   <MyComponent userId={userId} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError } = this.props;
    if (onError) {
      onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state when resetKeys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError && error) {
      // Custom render function fallback
      if (typeof fallback === 'function') {
        return fallback(error, this.resetError);
      }

      // Custom ReactNode fallback
      if (fallback) {
        return fallback;
      }

      // Default fallback
      return <ErrorFallback error={error} resetError={this.resetError} />;
    }

    return children;
  }
}

export default ErrorBoundary;
