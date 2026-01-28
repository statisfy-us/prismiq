/**
 * ValueFormattingSection component for configuring number formatting.
 *
 * Provides options for:
 * - Value format (number, currency, percent, compact)
 * - Currency symbol
 * - Compact notation (K, M, B, T)
 * - Decimal digits
 */

import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetConfig } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ValueFormattingSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
  /** Whether to show currency options. */
  showCurrency?: boolean;
  /** Whether to show compact notation options. */
  showCompact?: boolean;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FORMAT_OPTIONS = [
  { value: 'number', label: 'Number (1,234.56)' },
  { value: 'currency', label: 'Currency ($1,234.56)' },
  { value: 'percent', label: 'Percentage (12.34%)' },
  { value: 'compact', label: 'Compact (1.2K)' },
];

const COMPACT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'K', label: 'K (Thousands)' },
  { value: 'M', label: 'M (Millions)' },
  { value: 'B', label: 'B (Billions)' },
  { value: 'T', label: 'T (Trillions)' },
];

const DECIMAL_OPTIONS = [
  { value: '0', label: '0 decimals' },
  { value: '1', label: '1 decimal' },
  { value: '2', label: '2 decimals' },
  { value: '3', label: '3 decimals' },
  { value: '4', label: '4 decimals' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Value formatting configuration section.
 */
export function ValueFormattingSection({
  config,
  onChange,
  showCurrency = true,
  showCompact = true,
  defaultOpen = false,
}: ValueFormattingSectionProps): JSX.Element {
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

  const isCurrency = config.valueFormat === 'currency' || config.format === 'currency';

  return (
    <CollapsibleSection title="Value Formatting" defaultOpen={defaultOpen}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Format</label>
        <Select
          value={config.valueFormat || config.format || 'number'}
          onChange={(value) => {
            const formatValue = value as WidgetConfig['valueFormat'];
            // Set both valueFormat and format to keep them in sync
            // (MetricCard reads from config.format, other components may use valueFormat)
            onChange('valueFormat', formatValue);
            onChange('format', formatValue);
          }}
          options={FORMAT_OPTIONS}
        />
      </div>

      {isCurrency && showCurrency && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Currency Symbol</label>
          <Input
            value={config.currencySymbol ?? '$'}
            onChange={(e) => onChange('currencySymbol', e.target.value)}
            placeholder="$"
            style={{ width: '80px' }}
          />
        </div>
      )}

      {showCompact && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Compact Notation</label>
          <Select
            value={config.compactNotation || ''}
            onChange={(value) =>
              onChange('compactNotation', value ? (value as WidgetConfig['compactNotation']) : null)
            }
            options={COMPACT_OPTIONS}
          />
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Decimal Places</label>
        <Select
          value={String(config.decimalDigits ?? 2)}
          onChange={(value) => onChange('decimalDigits', parseInt(value, 10))}
          options={DECIMAL_OPTIONS}
        />
      </div>
    </CollapsibleSection>
  );
}
