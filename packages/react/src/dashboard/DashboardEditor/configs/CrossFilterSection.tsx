/**
 * CrossFilterSection component for configuring widget cross-filtering.
 *
 * Allows users to:
 * - Enable/disable the widget as a cross-filter source
 * - Select which column to use for filtering
 */

import type { ChangeEvent, CSSProperties } from 'react';
import { useMemo } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig, WidgetCrossFilterConfig } from '../../types';
import type { QueryDefinition } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export interface CrossFilterSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(
    key: K,
    value: WidgetConfig[K]
  ) => void;
  /** Current query to get column options. */
  query: QueryDefinition | null;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Cross-filter configuration section.
 */
export function CrossFilterSection({
  config,
  onChange,
  query,
  defaultOpen = false,
}: CrossFilterSectionProps): JSX.Element {
  const { theme } = useTheme();

  const fieldStyle: CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const helpTextStyle: CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  };

  // Get column options from query
  const columnOptions = useMemo(() => {
    if (!query?.columns) return [];
    return query.columns.map((col) => ({
      value: col.column,
      label: col.column,
    }));
  }, [query]);

  const crossFilterEnabled = config.cross_filter?.enabled ?? false;

  const handleEnableChange = (enabled: boolean) => {
    if (!enabled) {
      onChange('cross_filter', undefined);
    } else {
      const newConfig: WidgetCrossFilterConfig = {
        enabled: true,
        column: config.x_axis, // Default to x_axis
      };
      onChange('cross_filter', newConfig);
    }
  };

  const handleColumnChange = (column: string) => {
    onChange('cross_filter', {
      ...config.cross_filter,
      enabled: true,
      column: column || undefined,
    });
  };

  return (
    <CollapsibleSection
      title="Cross-Filtering"
      defaultOpen={defaultOpen || crossFilterEnabled}
    >
      <div style={fieldStyle}>
        <Checkbox
          label="Enable as filter source"
          checked={crossFilterEnabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleEnableChange(e.target.checked)
          }
        />
        <div style={helpTextStyle}>
          When enabled, clicking data points will filter other widgets
        </div>
      </div>

      {crossFilterEnabled && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Filter Column</label>
          <Select
            value={config.cross_filter?.column ?? config.x_axis ?? ''}
            onChange={handleColumnChange}
            options={[
              { value: '', label: 'Use X-Axis column' },
              ...columnOptions,
            ]}
          />
          <div style={helpTextStyle}>
            The column used to filter other widgets when a data point is clicked
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
