/**
 * Widget type selector for the full-page widget editor.
 *
 * Displays available widget types as visual cards that can be selected.
 */

import { useTheme } from '../../theme';
import { Icon } from '../../components/ui/Icon';
import type { IconName } from '../../components/ui/Icon';
import type { WidgetType } from '../types';

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
    label: 'Metric',
    description: 'Single value with trend',
    icon: 'info',
  },
  {
    type: 'bar_chart',
    label: 'Bar Chart',
    description: 'Compare categories',
    icon: 'chart-bar',
  },
  {
    type: 'line_chart',
    label: 'Line Chart',
    description: 'Trends over time',
    icon: 'chart-line',
  },
  {
    type: 'area_chart',
    label: 'Area Chart',
    description: 'Cumulative trends',
    icon: 'chart-line',
  },
  {
    type: 'pie_chart',
    label: 'Pie Chart',
    description: 'Proportions',
    icon: 'chart-pie',
  },
  {
    type: 'scatter_chart',
    label: 'Scatter',
    description: 'Correlations',
    icon: 'grid',
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Tabular data',
    icon: 'table',
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Markdown content',
    icon: 'edit',
  },
];

export interface WidgetTypeSelectorProps {
  /** Currently selected widget type. */
  value: WidgetType;
  /** Callback when widget type changes. */
  onChange: (type: WidgetType) => void;
  /** Additional CSS class. */
  className?: string;
}

/**
 * Widget type selector displaying available types as cards.
 */
export function WidgetTypeSelector({
  value,
  onChange,
  className = '',
}: WidgetTypeSelectorProps): JSX.Element {
  const { theme } = useTheme();

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    fontWeight: 600,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.xs,
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.xs,
  };

  const getItemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: isSelected ? `${theme.colors.primary}10` : theme.colors.background,
    borderRadius: theme.radius.sm,
    border: `2px solid ${isSelected ? theme.colors.primary : theme.colors.border}`,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 0, // Allow grid item to shrink below content width
  });

  const iconStyle = (isSelected: boolean): React.CSSProperties => ({
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isSelected ? theme.colors.primary : `${theme.colors.primary}15`,
    borderRadius: theme.radius.sm,
    color: isSelected ? '#fff' : theme.colors.primary,
    flexShrink: 0,
  });

  const textContainerStyle: React.CSSProperties = {
    minWidth: 0,
  };

  const nameLabelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: 500,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const descStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <div className={`prismiq-widget-type-selector ${className}`} style={containerStyle}>
      <label style={labelStyle}>Widget Type</label>

      <div style={gridStyle}>
        {WIDGET_TYPES.map((widgetType) => {
          const isSelected = value === widgetType.type;

          return (
            <button
              key={widgetType.type}
              type="button"
              style={getItemStyle(isSelected)}
              onClick={() => onChange(widgetType.type)}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.colors.borderFocus;
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.colors.border;
                }
              }}
            >
              <div style={iconStyle(isSelected)}>
                <Icon name={widgetType.icon} size={16} />
              </div>
              <div style={textContainerStyle}>
                <div style={nameLabelStyle}>{widgetType.label}</div>
                <div style={descStyle}>{widgetType.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
