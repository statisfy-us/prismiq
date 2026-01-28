/**
 * HyperlinkSection component for configuring widget hyperlinks.
 *
 * Allows users to add a link that appears as an icon in the widget header.
 */

import { useState } from 'react';
import { useTheme } from '../../../theme';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { CollapsibleSection } from '../../../components/ui/CollapsibleSection';
import type { WidgetHyperlink } from '../../types';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Validate that a URL uses a safe protocol (http or https).
 * Returns an error message if invalid, or null if valid.
 */
function validateUrl(url: string): string | null {
  if (!url.trim()) return null;

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'Only http:// and https:// URLs are allowed';
    }
    return null;
  } catch {
    // Not a valid URL format yet - allow partial input while typing
    if (url.includes('://') && !url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Only http:// and https:// URLs are allowed';
    }
    return null;
  }
}

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
  const [urlError, setUrlError] = useState<string | null>(null);

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

  const errorStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  };

  const handleUrlChange = (url: string) => {
    const error = validateUrl(url);
    setUrlError(error);

    if (!url.trim()) {
      onChange(undefined);
    } else if (!error) {
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
        {urlError ? (
          <div style={errorStyle}>{urlError}</div>
        ) : (
          <div style={helpTextStyle}>
            A link icon will appear in the widget header
          </div>
        )}
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
