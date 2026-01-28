/**
 * TextFormattingSection component for configuring text widget content and styling.
 *
 * Provides:
 * - Textarea for content with optional markdown preview
 * - Markdown toggle
 * - Text alignment selector
 * - Font size selector
 */

import { useState } from 'react';
import { useTheme } from '../../../theme';
import { Select } from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';
import { parseMarkdownSafe } from '../../../utils';
import type { WidgetConfig } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface TextFormattingSectionProps {
  /** Current config. */
  config: WidgetConfig;
  /** Callback when config changes. */
  onChange: <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => void;
}

// ============================================================================
// Constants
// ============================================================================

const ALIGNMENT_OPTIONS = [
  { value: 'Left', label: 'Left' },
  { value: 'Center', label: 'Center' },
  { value: 'Right', label: 'Right' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'Small', label: 'Small' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Large', label: 'Large' },
  { value: 'XLarge', label: 'Extra Large' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Text formatting configuration for text widgets.
 */
export function TextFormattingSection({
  config,
  onChange,
}: TextFormattingSectionProps): JSX.Element {
  const { theme } = useTheme();
  const [showPreview, setShowPreview] = useState(false);

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
  };

  const halfFieldStyle: React.CSSProperties = {
    flex: 1,
    marginBottom: theme.spacing.md,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: config.markdown ? theme.fonts.mono : theme.fonts.sans,
    resize: 'vertical',
    minHeight: '120px',
  };

  const previewStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '120px',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.fontSizes.sm,
    lineHeight: 1.6,
    overflow: 'auto',
  };

  const previewLabelStyle: React.CSSProperties = {
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  };

  return (
    <>
      {/* Content */}
      <div style={fieldStyle}>
        <div style={headerStyle}>
          <label style={labelStyle}>Content</label>
          {config.markdown && (
            <Checkbox
              label="Preview"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
          )}
        </div>

        {showPreview && config.markdown ? (
          <div style={previewStyle}>
            <div style={previewLabelStyle}>
              <span>Markdown Preview</span>
            </div>
            <div
              dangerouslySetInnerHTML={{
                __html: parseMarkdownSafe(config.content ?? ''),
              }}
            />
          </div>
        ) : (
          <textarea
            value={config.content ?? ''}
            onChange={(e) => onChange('content', e.target.value)}
            rows={8}
            style={textareaStyle}
            placeholder="Enter text content..."
          />
        )}
      </div>

      {/* Markdown toggle */}
      <div style={fieldStyle}>
        <Checkbox
          label="Enable Markdown"
          checked={config.markdown ?? false}
          onChange={(e) => onChange('markdown', e.target.checked)}
        />
      </div>

      {/* Alignment and Font Size */}
      <div style={rowStyle}>
        <div style={halfFieldStyle}>
          <label style={labelStyle}>Alignment</label>
          <Select
            value={config.alignment ?? 'Left'}
            onChange={(value) =>
              onChange('alignment', value as WidgetConfig['alignment'])
            }
            options={ALIGNMENT_OPTIONS}
          />
        </div>
        <div style={halfFieldStyle}>
          <label style={labelStyle}>Font Size</label>
          <Select
            value={config.fontSize ?? 'Normal'}
            onChange={(value) =>
              onChange('fontSize', value as WidgetConfig['fontSize'])
            }
            options={FONT_SIZE_OPTIONS}
          />
        </div>
      </div>
    </>
  );
}
