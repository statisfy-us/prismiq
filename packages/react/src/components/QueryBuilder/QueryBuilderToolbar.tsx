/**
 * QueryBuilderToolbar component for query actions.
 */

import { Button, Icon } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface QueryBuilderToolbarProps {
  /** Whether a query is currently executing. */
  isExecuting: boolean;
  /** Whether the query can be executed (has valid configuration). */
  canExecute: boolean;
  /** Callback when execute button is clicked. */
  onExecute: () => void;
  /** Callback when preview button is clicked. */
  onPreview: () => void;
  /** Callback when clear button is clicked. */
  onClear: () => void;
  /** Whether SQL preview is currently shown. */
  showingPreview?: boolean;
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const toolbarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  padding: 'var(--prismiq-spacing-sm) 0',
  borderTop: '1px solid var(--prismiq-color-border)',
  borderBottom: '1px solid var(--prismiq-color-border)',
};

const leftGroupStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
};

const spacerStyles: React.CSSProperties = {
  flex: 1,
};

const hintStyles: React.CSSProperties = {
  fontSize: 'var(--prismiq-font-size-xs)',
  color: 'var(--prismiq-color-text-muted)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Toolbar with execute, preview, and clear buttons.
 */
export function QueryBuilderToolbar({
  isExecuting,
  canExecute,
  onExecute,
  onPreview,
  onClear,
  className,
  style,
}: QueryBuilderToolbarProps): JSX.Element {
  return (
    <div className={className} style={{ ...toolbarStyles, ...style }}>
      <div style={leftGroupStyles}>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icon name="play" size={14} />}
          onClick={onExecute}
          disabled={!canExecute}
          loading={isExecuting}
        >
          Execute
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Icon name="search" size={14} />}
          onClick={onPreview}
          disabled={!canExecute || isExecuting}
        >
          Preview
        </Button>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Icon name="trash" size={14} />}
          onClick={onClear}
          disabled={isExecuting}
        >
          Clear
        </Button>
      </div>

      <div style={spacerStyles} />

      <span style={hintStyles}>Ctrl/Cmd + Enter to execute</span>
    </div>
  );
}
