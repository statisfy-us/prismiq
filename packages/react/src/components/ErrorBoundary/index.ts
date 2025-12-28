/**
 * Error boundary components for catching and handling errors gracefully.
 *
 * @example
 * ```tsx
 * import { ErrorBoundary, WidgetErrorBoundary } from '@prismiq/react';
 *
 * // Wrap entire app or sections
 * <ErrorBoundary onError={logError}>
 *   <App />
 * </ErrorBoundary>
 *
 * // Wrap individual widgets
 * <WidgetErrorBoundary widgetTitle="Revenue Chart">
 *   <BarChart data={data} />
 * </WidgetErrorBoundary>
 * ```
 */

export { ErrorBoundary } from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';

export { ErrorFallback } from './ErrorFallback';
export type { ErrorFallbackProps } from './ErrorFallback';

export { WidgetErrorBoundary } from './WidgetErrorBoundary';
export type { WidgetErrorBoundaryProps } from './WidgetErrorBoundary';
