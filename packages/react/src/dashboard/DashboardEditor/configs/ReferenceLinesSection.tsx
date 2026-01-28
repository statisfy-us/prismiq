/**
 * ReferenceLinesSection component for configuring chart reference lines.
 *
 * Allows users to add threshold/goal lines to bar, line, and area charts.
 */

import { useTheme } from '../../../theme';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { ReferenceLine } from '../../types';

export interface ReferenceLinesSectionProps {
  /** Current reference lines. */
  lines: ReferenceLine[];
  /** Callback when lines change. */
  onChange: (lines: ReferenceLine[]) => void;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const LINE_STYLE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const DEFAULT_COLORS = ['#ff4d4f', '#faad14', '#52c41a', '#1890ff'];

// ============================================================================
// Component
// ============================================================================

/**
 * Reference lines configuration section for charts.
 */
export function ReferenceLinesSection({
  lines,
  onChange,
  defaultOpen = false,
}: ReferenceLinesSectionProps): JSX.Element {
  const { theme } = useTheme();

  const lineRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
  };

  const addButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  };

  const colorInputStyle: React.CSSProperties = {
    width: '32px',
    height: '32px',
    padding: 0,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  };

  const addLine = () => {
    const newLine: ReferenceLine = {
      value: 0,
      label: '',
      color: DEFAULT_COLORS[lines.length % DEFAULT_COLORS.length],
      lineStyle: 'dashed',
    };
    onChange([...lines, newLine]);
  };

  const updateLine = (index: number, updates: Partial<ReferenceLine>) => {
    onChange(
      lines.map((line, i) => (i === index ? { ...line, ...updates } : line))
    );
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <CollapsibleSection
      title="Reference Lines"
      defaultOpen={defaultOpen || lines.length > 0}
    >
      {lines.map((line, index) => (
        // Using index as key is acceptable since lines are only added at end
        // and removed by index (no reordering occurs)
        <div key={index} style={lineRowStyle}>
          <Input
            type="number"
            value={String(line.value)}
            onChange={(e) =>
              updateLine(index, { value: parseFloat(e.target.value) || 0 })
            }
            placeholder="Value"
            style={{ width: '80px' }}
          />
          <Input
            value={line.label ?? ''}
            onChange={(e) =>
              updateLine(index, { label: e.target.value || undefined })
            }
            placeholder="Label"
            style={{ flex: 1 }}
          />
          <input
            type="color"
            value={line.color ?? DEFAULT_COLORS[0]}
            onChange={(e) => updateLine(index, { color: e.target.value })}
            title="Line color"
            style={colorInputStyle}
          />
          <Select
            value={line.lineStyle ?? 'dashed'}
            onChange={(value) =>
              updateLine(index, {
                lineStyle: value as ReferenceLine['lineStyle'],
              })
            }
            options={LINE_STYLE_OPTIONS}
            style={{ width: '90px' }}
          />
          <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>
            <Icon name="x" size={14} />
          </Button>
        </div>
      ))}

      <div style={addButtonStyle}>
        <Button variant="ghost" size="sm" onClick={addLine}>
          <Icon name="plus" size={14} />
          <span style={{ marginLeft: theme.spacing.xs }}>
            Add reference line
          </span>
        </Button>
      </div>
    </CollapsibleSection>
  );
}
