/**
 * FiscalYearSection component for configuring the fiscal year start month.
 * Used by date filter presets (fiscal quarters/years).
 */

import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface FiscalYearSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// ============================================================================
// Component
// ============================================================================

export function FiscalYearSection({
  config,
  onChange,
  defaultOpen = false,
}: FiscalYearSectionProps): JSX.Element {
  const { theme } = useTheme();

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  };

  return (
    <CollapsibleSection title="Fiscal Year" defaultOpen={defaultOpen}>
      <div>
        <label style={labelStyle}>Fiscal Year Start Month</label>
        <Select
          value={String(config.fiscalYearStartMonth || 1)}
          onChange={(value) => onChange('fiscalYearStartMonth', Number(value))}
          options={MONTH_OPTIONS}
        />
        <div style={helpTextStyle}>
          Sets the start month for fiscal quarter and year filter presets
        </div>
      </div>
    </CollapsibleSection>
  );
}
