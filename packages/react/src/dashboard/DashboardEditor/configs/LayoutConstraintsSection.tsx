/**
 * LayoutConstraintsSection component for configuring widget size constraints.
 *
 * Allows users to set:
 * - Minimum width (in grid units)
 * - Maximum width (in grid units)
 * - Minimum height (in grid units)
 * - Maximum height (in grid units)
 */

import { useTheme } from '../../../theme';
import { Input } from '../../../components/ui/Input';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetPosition } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface LayoutConstraintsSectionProps {
  /** Current widget position. */
  position: WidgetPosition;
  /** Callback when position changes. */
  onChange: (position: WidgetPosition) => void;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Widget size constraints configuration.
 */
export function LayoutConstraintsSection({
  position,
  onChange,
  defaultOpen = false,
}: LayoutConstraintsSectionProps): JSX.Element {
  const { theme } = useTheme();

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.sm,
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: theme.spacing.sm,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    gridColumn: '1 / -1',
  };

  const handleChange = (
    field: 'minW' | 'maxW' | 'minH' | 'maxH',
    value: string
  ) => {
    const numValue = value ? parseInt(value, 10) : undefined;
    onChange({
      ...position,
      [field]: numValue,
    });
  };

  // Check if any constraints are set
  const hasConstraints =
    position.minW !== undefined ||
    position.maxW !== undefined ||
    position.minH !== undefined ||
    position.maxH !== undefined;

  return (
    <CollapsibleSection
      title="Size Constraints"
      defaultOpen={defaultOpen || hasConstraints}
    >
      <div style={gridStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Min Width</label>
          <Input
            type="number"
            value={position.minW !== undefined ? String(position.minW) : ''}
            onChange={(e) => handleChange('minW', e.target.value)}
            placeholder="Auto"
            min={1}
            max={12}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Max Width</label>
          <Input
            type="number"
            value={position.maxW !== undefined ? String(position.maxW) : ''}
            onChange={(e) => handleChange('maxW', e.target.value)}
            placeholder="Auto"
            min={1}
            max={12}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Min Height</label>
          <Input
            type="number"
            value={position.minH !== undefined ? String(position.minH) : ''}
            onChange={(e) => handleChange('minH', e.target.value)}
            placeholder="Auto"
            min={1}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Max Height</label>
          <Input
            type="number"
            value={position.maxH !== undefined ? String(position.maxH) : ''}
            onChange={(e) => handleChange('maxH', e.target.value)}
            placeholder="Auto"
            min={1}
          />
        </div>
        <span style={helpTextStyle}>
          Values are in grid units (1-12 for width). Leave empty for automatic
          sizing.
        </span>
      </div>
    </CollapsibleSection>
  );
}
