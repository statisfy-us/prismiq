/**
 * HyperlinkSection component for configuring widget hyperlinks.
 *
 * Allows users to add a link that appears as an icon in the widget header.
 */

import { useTheme } from '../../../theme';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetHyperlink } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface HyperlinkSectionProps {
  /** Current hyperlink configuration. */
  hyperlink: WidgetHyperlink | undefined;
  /** Callback when hyperlink changes. */
  onChange: (hyperlink: WidgetHyperlink | undefined) => void;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const TARGET_OPTIONS = [
  { value: '_blank', label: 'New Tab' },
  { value: '_self', label: 'Same Tab' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Hyperlink configuration section for widgets.
 */
export function HyperlinkSection({
  hyperlink,
  onChange,
  defaultOpen = false,
}: HyperlinkSectionProps): JSX.Element {
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

  const helpTextStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  };

  const handleUrlChange = (url: string) => {
    if (!url.trim()) {
      onChange(undefined);
    } else {
      onChange({
        url,
        title: hyperlink?.title,
        target: hyperlink?.target ?? '_blank',
      });
    }
  };

  const handleTitleChange = (title: string) => {
    if (!hyperlink?.url) return;
    onChange({
      ...hyperlink,
      title: title || undefined,
    });
  };

  const handleTargetChange = (target: string) => {
    if (!hyperlink?.url) return;
    onChange({
      ...hyperlink,
      target: target as '_blank' | '_self',
    });
  };

  return (
    <CollapsibleSection title="Hyperlink" defaultOpen={defaultOpen}>
      <div style={fieldStyle}>
        <label style={labelStyle}>URL</label>
        <Input
          value={hyperlink?.url || ''}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://example.com/dashboard"
        />
        <div style={helpTextStyle}>
          A link icon will appear in the widget header
        </div>
      </div>

      {hyperlink?.url && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Tooltip Text</label>
            <Input
              value={hyperlink?.title || ''}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Click to view details..."
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Open In</label>
            <Select
              value={hyperlink?.target || '_blank'}
              onChange={handleTargetChange}
              options={TARGET_OPTIONS}
            />
          </div>
        </>
      )}
    </CollapsibleSection>
  );
}
