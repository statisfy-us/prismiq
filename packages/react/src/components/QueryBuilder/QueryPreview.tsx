/**
 * QueryPreview component for displaying SQL preview.
 */

import { useState } from 'react';

import { Button, Icon } from '../ui';

// ============================================================================
// Types
// ============================================================================

export interface QueryPreviewProps {
  /** The SQL query string. */
  sql: string | null;
  /** Whether the preview is loading. */
  loading?: boolean;
  /** Error message if SQL generation failed. */
  error?: string | null;
  /** Whether the preview is collapsible. */
  collapsible?: boolean;
  /** Initial collapsed state. */
  defaultCollapsed?: boolean;
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  border: '1px solid var(--prismiq-color-border)',
  borderRadius: 'var(--prismiq-radius-md)',
  overflow: 'hidden',
};

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--prismiq-spacing-sm) var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-surface)',
  borderBottom: '1px solid var(--prismiq-color-border)',
  cursor: 'pointer',
};

const titleStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
  fontSize: 'var(--prismiq-font-size-sm)',
  fontWeight: 600,
  color: 'var(--prismiq-color-text)',
};

const actionsStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-sm)',
};

const contentStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md)',
  backgroundColor: 'var(--prismiq-color-background)',
  overflow: 'auto',
  maxHeight: '200px',
};

const codeStyles: React.CSSProperties = {
  fontFamily: 'var(--prismiq-font-mono)',
  fontSize: 'var(--prismiq-font-size-sm)',
  color: 'var(--prismiq-color-text)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  margin: 0,
};

const emptyStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-text-muted)',
  fontStyle: 'italic',
};

const errorStyles: React.CSSProperties = {
  color: 'var(--prismiq-color-error)',
};

// ============================================================================
// Component
// ============================================================================

/**
 * SQL preview panel with syntax highlighting (basic).
 */
export function QueryPreview({
  sql,
  loading = false,
  error = null,
  collapsible = true,
  defaultCollapsed = false,
  className,
  style,
}: QueryPreviewProps): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleCopy = async () => {
    if (sql) {
      try {
        await navigator.clipboard.writeText(sql);
      } catch {
        // Fallback for older browsers
        console.warn('Failed to copy to clipboard');
      }
    }
  };

  const handleToggle = () => {
    if (collapsible) {
      setIsCollapsed((prev) => !prev);
    }
  };

  return (
    <div className={className} style={{ ...containerStyles, ...style }}>
      <div
        style={headerStyles}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <span style={titleStyles}>
          {collapsible && (
            <Icon
              name="chevron-right"
              size={14}
              style={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                transition: 'transform 0.15s',
              }}
            />
          )}
          <Icon name="column" size={14} />
          SQL Preview
        </span>

        <div style={actionsStyles} onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="copy" size={14} />}
            onClick={handleCopy}
            disabled={!sql || loading}
          >
            Copy
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={contentStyles}>
          {loading ? (
            <span style={emptyStyles}>Generating SQL...</span>
          ) : error ? (
            <span style={errorStyles}>{error}</span>
          ) : sql ? (
            <pre style={codeStyles}>{sql}</pre>
          ) : (
            <span style={emptyStyles}>
              Build a query to see the SQL preview
            </span>
          )}
        </div>
      )}
    </div>
  );
}
