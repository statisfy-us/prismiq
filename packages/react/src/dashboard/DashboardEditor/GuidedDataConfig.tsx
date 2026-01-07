/**
 * Guided data configuration wrapper.
 *
 * Renders the appropriate guided config component based on widget type.
 */

import { useTheme } from '../../theme';
import { MetricConfig, ChartConfig, PieConfig, TableConfig } from './configs';
import type { WidgetType } from '../types';
import type { DatabaseSchema, QueryDefinition } from '../../types';

export interface GuidedDataConfigProps {
  /** Widget type to configure. */
  widgetType: WidgetType;
  /** Database schema for table/column selection. */
  schema: DatabaseSchema;
  /** Current query (for restoring state). */
  query: QueryDefinition | null;
  /** Callback when query changes. */
  onChange: (query: QueryDefinition) => void;
}

/**
 * Renders widget-specific guided data configuration.
 */
export function GuidedDataConfig({
  widgetType,
  schema,
  query,
  onChange,
}: GuidedDataConfigProps): JSX.Element {
  const { theme } = useTheme();

  // Render the appropriate config based on widget type
  switch (widgetType) {
    case 'metric':
      return <MetricConfig schema={schema} query={query} onChange={onChange} />;

    case 'bar_chart':
    case 'line_chart':
    case 'area_chart':
    case 'scatter_chart':
      return <ChartConfig schema={schema} query={query} onChange={onChange} />;

    case 'pie_chart':
      return <PieConfig schema={schema} query={query} onChange={onChange} />;

    case 'table':
      return <TableConfig schema={schema} query={query} onChange={onChange} />;

    case 'text':
      // Text widgets don't need data configuration
      return (
        <div
          style={{
            padding: theme.spacing.md,
            color: theme.colors.textMuted,
            textAlign: 'center',
          }}
        >
          Text widgets don't require a data source.
        </div>
      );

    default:
      return (
        <div
          style={{
            padding: theme.spacing.md,
            color: theme.colors.textMuted,
            textAlign: 'center',
          }}
        >
          No guided configuration available for this widget type.
        </div>
      );
  }
}
