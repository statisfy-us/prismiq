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

const kbdStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  padding: '2px 5px',
  fontSize: '10px',
  fontFamily: 'var(--prismiq-font-mono)',
  backgroundColor: 'var(--prismiq-color-surface)',
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: '3px',
  marginLeft: '4px',
};

// Detect if Mac
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

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
          title={`Execute query (${modKey}+Enter)`}
        >
          Execute
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Icon name="search" size={14} />}
          onClick={onPreview}
          disabled={!canExecute || isExecuting}
          title="Preview first 100 rows"
        >
          Preview
        </Button>

        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Icon name="trash" size={14} />}
          onClick={onClear}
          disabled={isExecuting}
          title="Clear query"
        >
          Clear
        </Button>
      </div>

      <div style={spacerStyles} />

      <span style={hintStyles}>
        <kbd style={kbdStyles}>{modKey}</kbd>
        <kbd style={kbdStyles}>↵</kbd>
        <span style={{ marginLeft: '4px' }}>to execute</span>
      </span>
    </div>
  );
}
