/**
 * Main Dashboard component for embedding.
 */

import { useCallback } from 'react';
import { useTheme } from '../theme';
import { CrossFilterProvider, useCrossFilterOptional } from '../context';
import { Button } from '../components/ui/Button';
import { DashboardProvider } from './DashboardProvider';
import { useDashboard } from './useDashboard';
import { useDashboardFilters } from './useDashboardFilters';
import { DashboardLayout } from './DashboardLayout';
import { Widget } from './Widget';
import { FilterBar } from './filters';
import type { DashboardProps, Widget as WidgetType } from './types';

/**
 * Internal dashboard content component.
 */
function DashboardContent({
  showFilters = true,
  showTitle = true,
  className = '',
}: Omit<DashboardProps, 'id' | 'refreshInterval' | 'onWidgetClick'>): JSX.Element {
  const { theme } = useTheme();
  const {
    dashboard,
    isLoading,
    error,
    widgetResults,
    widgetErrors,
    widgetLoading,
    refreshWidget,
  } = useDashboard();

  const { filters, values, setValue, resetAll } = useDashboardFilters();

  // Get cross-filter context
  const crossFilterContext = useCrossFilterOptional();

  // Render widget function for DashboardLayout
  const renderWidget = useCallback(
    (widget: WidgetType) => (
      <Widget
        widget={widget}
        result={widgetResults[widget.id] ?? null}
        isLoading={widgetLoading[widget.id] ?? false}
        error={widgetErrors[widget.id]}
        editable={false}
        onRefresh={() => refreshWidget(widget.id)}
        onFullscreen={() => {
          // TODO: Implement fullscreen
        }}
      />
    ),
    [widgetResults, widgetLoading, widgetErrors, refreshWidget]
  );

  // Container styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    fontFamily: theme.fonts.sans,
  };

  const headerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: theme.fontSizes['2xl'],
    fontWeight: 600,
    color: theme.colors.text,
  };

  const descriptionStyle: React.CSSProperties = {
    marginTop: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  };

  // Cross-filter indicator styles
  const crossFilterBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: `${theme.colors.primary}15`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
  };

  const crossFilterLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontWeight: 500,
  };

  const crossFilterValueStyle: React.CSSProperties = {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.radius.sm,
    fontSize: theme.fontSizes.xs,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textMuted,
  };

  const errorStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: theme.spacing.xl,
    textAlign: 'center',
  };

  const spinnerStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    borderRadius: '50%',
    animation: 'prismiq-dashboard-spin 1s linear infinite',
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`prismiq-dashboard ${className}`} style={containerStyle}>
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
        </div>
        <style>{`
          @keyframes prismiq-dashboard-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`prismiq-dashboard ${className}`} style={containerStyle}>
        <div style={errorStyle}>
          <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>!</div>
          <div style={{ fontSize: theme.fontSizes.lg, color: theme.colors.error }}>
            Failed to load dashboard
          </div>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.textMuted }}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  // No dashboard loaded
  if (!dashboard) {
    return (
      <div className={`prismiq-dashboard ${className}`} style={containerStyle}>
        <div style={loadingStyle}>Dashboard not found</div>
      </div>
    );
  }

  return (
    <div className={`prismiq-dashboard ${className}`} style={containerStyle}>
      {showTitle && (
        <div style={headerStyle}>
          <h1 style={titleStyle}>{dashboard.name}</h1>
          {dashboard.description && (
            <p style={descriptionStyle}>{dashboard.description}</p>
          )}
        </div>
      )}

      {showFilters && filters.length > 0 && (
        <FilterBar
          filters={filters}
          values={values}
          onChange={setValue}
          onReset={resetAll}
        />
      )}

      {/* Cross-filter indicator bar */}
      {crossFilterContext?.hasActiveFilters && (
        <div style={crossFilterBarStyle}>
          <span style={crossFilterLabelStyle}>
            <span>🔗</span>
            <span>Cross-filter active:</span>
          </span>
          {crossFilterContext.filters.map((filter) => (
            <span key={filter.sourceWidgetId} style={crossFilterValueStyle}>
              {filter.column}: {String(filter.value)}
            </span>
          ))}
          <div style={{ flex: 1 }} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => crossFilterContext.clearFilters()}
          >
            Clear filters
          </Button>
        </div>
      )}

      <div style={contentStyle}>
        <DashboardLayout
          widgets={dashboard.widgets}
          layout={dashboard.layout}
          editable={false}
          renderWidget={renderWidget}
        />
      </div>
    </div>
  );
}

/**
 * Dashboard component for embedding.
 *
 * @example
 * ```tsx
 * <AnalyticsProvider endpoint="https://api.example.com">
 *   <Dashboard
 *     id="my-dashboard"
 *     showFilters={true}
 *     refreshInterval={60000}
 *   />
 * </AnalyticsProvider>
 * ```
 */
export function Dashboard({
  id,
  showFilters = true,
  showTitle = true,
  refreshInterval,
  className = '',
}: DashboardProps): JSX.Element {
  return (
    <CrossFilterProvider>
      <DashboardProvider dashboardId={id} refreshInterval={refreshInterval}>
        <DashboardContent
          showFilters={showFilters}
          showTitle={showTitle}
          className={className}
        />
      </DashboardProvider>
    </CrossFilterProvider>
  );
}
