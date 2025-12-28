/**
 * Widget palette for adding new widgets to the dashboard.
 */

import { useTheme } from '../../theme';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/Icon';
import type { WidgetType, WidgetPaletteProps } from '../types';

/**
 * Widget type configuration.
 */
interface WidgetTypeInfo {
  type: WidgetType;
  label: string;
  description: string;
  icon: IconName;
}

/**
 * Available widget types.
 */
const WIDGET_TYPES: WidgetTypeInfo[] = [
  {
    type: 'metric',
    label: 'Metric Card',
    description: 'Display a single value with optional trend',
    icon: 'info',
  },
  {
    type: 'bar_chart',
    label: 'Bar Chart',
    description: 'Compare values across categories',
    icon: 'chart-bar',
  },
  {
    type: 'line_chart',
    label: 'Line Chart',
    description: 'Show trends over time',
    icon: 'chart-line',
  },
  {
    type: 'area_chart',
    label: 'Area Chart',
    description: 'Show cumulative trends',
    icon: 'chart-line',
  },
  {
    type: 'pie_chart',
    label: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: 'chart-pie',
  },
  {
    type: 'scatter_chart',
    label: 'Scatter Chart',
    description: 'Show correlation between two values',
    icon: 'grid',
  },
  {
    type: 'table',
    label: 'Data Table',
    description: 'Display tabular data',
    icon: 'table',
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Add text or markdown content',
    icon: 'edit',
  },
];

/**
 * Widget palette for selecting widget types to add.
 */
export function WidgetPalette({
  onAddWidget,
}: WidgetPaletteProps): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadows.lg,
    maxWidth: '400px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const itemHoverStyle: React.CSSProperties = {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  };

  const iconContainerStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.primary,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    textAlign: 'center',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  };

  return (
    <div style={containerStyle} className="prismiq-widget-palette">
      <h3 style={titleStyle}>Add Widget</h3>

      <div style={gridStyle}>
        {WIDGET_TYPES.map((widgetType) => (
          <button
            key={widgetType.type}
            type="button"
            style={itemStyle}
            onClick={() => onAddWidget(widgetType.type)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, itemHoverStyle);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, itemStyle);
            }}
          >
            <div style={iconContainerStyle}>
              <Icon name={widgetType.icon} size={24} />
            </div>
            <span style={labelStyle}>{widgetType.label}</span>
            <span style={descriptionStyle}>{widgetType.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
