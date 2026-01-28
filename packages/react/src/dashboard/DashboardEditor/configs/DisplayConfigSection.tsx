/**
 * DisplayConfigSection component for chart display options.
 *
 * Provides options for:
 * - Color palette
 * - Show legend
 * - Show data labels
 * - Stacked (for bar/area charts)
 * - Orientation (for bar charts)
 */

import type { ChangeEvent } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import { ColorPaletteSelector } from '../../../components/ui/ColorPaletteSelector';
import type { WidgetConfig, WidgetType } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface DisplayConfigSectionProps {
  /** Widget type for context-specific options. */
  widgetType: WidgetType;
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Display configuration section for charts.
 */
export function DisplayConfigSection({
  widgetType,
  config,
  onChange,
  defaultOpen = false,
}: DisplayConfigSectionProps): JSX.Element {
  const { theme } = useTheme();

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
    marginBottom: theme.spacing.md,
  };

  const showOrientation = widgetType === 'bar_chart';
  const showStacked = widgetType === 'bar_chart' || widgetType === 'area_chart';
  const showColorPalette = [
    'bar_chart',
    'line_chart',
    'area_chart',
    'pie_chart',
    'scatter_chart',
  ].includes(widgetType);

  return (
    <CollapsibleSection title="Display Options" defaultOpen={defaultOpen}>
      {/* Color Palette */}
      {showColorPalette && (
        <div style={fieldStyle}>
          <ColorPaletteSelector
            value={config.colors}
            onChange={(colors) => onChange('colors', colors)}
          />
        </div>
      )}

      {/* Orientation (bar charts only) */}
      {showOrientation && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Orientation</label>
          <Select
            value={config.orientation || 'vertical'}
            onChange={(value) => onChange('orientation', value as 'vertical' | 'horizontal')}
            options={[
              { value: 'vertical', label: 'Vertical' },
              { value: 'horizontal', label: 'Horizontal' },
            ]}
          />
        </div>
      )}

      {/* Checkboxes */}
      <div style={rowStyle}>
        <Checkbox
          label="Show Legend"
          checked={config.show_legend ?? true}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('show_legend', e.target.checked)
          }
        />
        <Checkbox
          label="Data Labels"
          checked={config.show_data_labels ?? false}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange('show_data_labels', e.target.checked)
          }
        />
        {showStacked && (
          <Checkbox
            label="Stacked"
            checked={config.stacked ?? false}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onChange('stacked', e.target.checked)
            }
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
