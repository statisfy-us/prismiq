/**
 * CustomSQLEditor component.
 *
 * A simple SQL editor with textarea input, validation, and execution.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCustomSQL } from '../../hooks/useCustomSQL';
import { ResultsTable } from '../ResultsTable';

// ============================================================================
// Types
// ============================================================================

export interface CustomSQLEditorProps {
  /** Initial SQL query. */
  initialSql?: string;
  /** Callback when SQL changes. */
  onSqlChange?: (sql: string) => void;
  /** Callback when query executes successfully. */
  onExecute?: (sql: string) => void;
  /** Placeholder text for the textarea. */
  placeholder?: string;
  /** Whether to show the results table. */
  showResults?: boolean;
  /** Height of the textarea in pixels. */
  height?: number;
  /** Additional class name. */
  className?: string;
  /** Additional styles. */
  style?: React.CSSProperties;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-md, 16px)',
  fontFamily: 'var(--prismiq-font-sans, system-ui, sans-serif)',
};

const editorWrapperStyles: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--prismiq-spacing-sm, 8px)',
};

const textareaStyles: React.CSSProperties = {
  width: '100%',
  padding: 'var(--prismiq-spacing-md, 16px)',
  fontFamily: 'var(--prismiq-font-mono, "SF Mono", "Monaco", "Menlo", monospace)',
  fontSize: '14px',
  lineHeight: '1.5',
  backgroundColor: 'var(--prismiq-color-surface, #1e1e1e)',
  color: 'var(--prismiq-color-text, #d4d4d4)',
  border: '1px solid var(--prismiq-color-border, #3c3c3c)',
  borderRadius: 'var(--prismiq-radius-md, 8px)',
  resize: 'vertical',
  outline: 'none',
};

const textareaFocusStyles: React.CSSProperties = {
  borderColor: 'var(--prismiq-color-primary, #0ea5e9)',
  boxShadow: '0 0 0 2px var(--prismiq-color-primary-alpha, rgba(14, 165, 233, 0.2))',
};

const toolbarStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--prismiq-spacing-md, 16px)',
};

const buttonStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs, 4px)',
  padding: 'var(--prismiq-spacing-sm, 8px) var(--prismiq-spacing-md, 16px)',
  fontFamily: 'inherit',
  fontSize: '14px',
  fontWeight: 500,
  color: 'white',
  backgroundColor: 'var(--prismiq-color-primary, #0ea5e9)',
  border: 'none',
  borderRadius: 'var(--prismiq-radius-md, 8px)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

const buttonDisabledStyles: React.CSSProperties = {
  backgroundColor: 'var(--prismiq-color-muted, #6b7280)',
  cursor: 'not-allowed',
};

const errorStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-md, 16px)',
  backgroundColor: 'var(--prismiq-color-error-bg, #fef2f2)',
  color: 'var(--prismiq-color-error, #dc2626)',
  borderRadius: 'var(--prismiq-radius-md, 8px)',
  fontSize: '14px',
};

const validationErrorStyles: React.CSSProperties = {
  padding: 'var(--prismiq-spacing-sm, 8px) var(--prismiq-spacing-md, 16px)',
  backgroundColor: 'var(--prismiq-color-warning-bg, #fffbeb)',
  color: 'var(--prismiq-color-warning, #d97706)',
  borderRadius: 'var(--prismiq-radius-md, 8px)',
  fontSize: '13px',
};

const statusStyles: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--prismiq-color-text-muted, #6b7280)',
};

const tablesListStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--prismiq-spacing-xs, 4px)',
  fontSize: '12px',
  color: 'var(--prismiq-color-text-muted, #6b7280)',
};

const tableTagStyles: React.CSSProperties = {
  padding: '2px 6px',
  backgroundColor: 'var(--prismiq-color-surface, #f3f4f6)',
  borderRadius: 'var(--prismiq-radius-sm, 4px)',
  fontFamily: 'var(--prismiq-font-mono, monospace)',
};

const resultsContainerStyles: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

// ============================================================================
// Component
// ============================================================================

/**
 * SQL editor with textarea input and query execution.
 *
 * @example
 * ```tsx
 * <CustomSQLEditor
 *   initialSql="SELECT * FROM users LIMIT 10"
 *   onExecute={(sql) => console.log('Executed:', sql)}
 *   showResults
 * />
 * ```
 */
export function CustomSQLEditor({
  initialSql = '',
  onSqlChange,
  onExecute,
  placeholder = 'SELECT * FROM table_name LIMIT 100',
  showResults = true,
  height = 200,
  className,
  style,
}: CustomSQLEditorProps): JSX.Element {
  // Local state
  const [sql, setSql] = useState(initialSql);
  const prevInitialSqlRef = useRef(initialSql);
  const [isFocused, setIsFocused] = useState(false);

  // Sync local state when initialSql changes from outside (e.g., "Apply to Editor")
  useEffect(() => {
    if (initialSql !== prevInitialSqlRef.current) {
      prevInitialSqlRef.current = initialSql;
      setSql(initialSql);
    }
  }, [initialSql]);
  const [executeEnabled, setExecuteEnabled] = useState(false);
  const [lastExecutedSql, setLastExecutedSql] = useState<string | null>(null);

  // Use custom SQL hook
  const {
    data,
    isLoading,
    error,
    validation,
    isValidating,
  } = useCustomSQL(lastExecutedSql, {
    enabled: executeEnabled,
    validateFirst: true,
  });

  // Handle SQL change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newSql = e.target.value;
      setSql(newSql);
      onSqlChange?.(newSql);
    },
    [onSqlChange]
  );

  // Handle execute
  const handleExecute = useCallback(() => {
    if (!sql.trim()) return;
    setLastExecutedSql(sql);
    setExecuteEnabled(true);
    onExecute?.(sql);
  }, [sql, onExecute]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl + Enter to execute
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute]
  );

  // Determine if we can execute
  const canExecute = sql.trim().length > 0 && !isLoading && !isValidating;

  // Merge styles
  const mergedTextareaStyles: React.CSSProperties = {
    ...textareaStyles,
    height,
    ...(isFocused ? textareaFocusStyles : {}),
  };

  const mergedButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    ...(canExecute ? {} : buttonDisabledStyles),
  };

  return (
    <div className={className} style={{ ...containerStyles, ...style }} data-testid="custom-sql-editor">
      <div style={editorWrapperStyles}>
        <textarea
          value={sql}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          style={mergedTextareaStyles}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          data-testid="custom-sql-textarea"
        />

        {validation && !validation.valid && (
          <div style={validationErrorStyles}>
            <strong>Validation errors:</strong>
            <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
              {validation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={toolbarStyles}>
          <div style={statusStyles}>
            {isValidating && 'Validating...'}
            {isLoading && 'Executing...'}
            {!isValidating && !isLoading && validation?.valid && (
              <div style={tablesListStyles}>
                Tables:{' '}
                {validation.tables.map((table) => (
                  <span key={table} style={tableTagStyles}>
                    {table}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExecute}
            disabled={!canExecute}
            style={mergedButtonStyles}
            type="button"
            data-testid="custom-sql-run-button"
          >
            {isLoading ? 'Executing...' : 'Run Query'}
            <span style={{ fontSize: '11px', opacity: 0.7 }}>(Cmd+Enter)</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={errorStyles}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {showResults && data && (
        <div style={resultsContainerStyles}>
          <ResultsTable
            result={data}
            loading={isLoading}
            sortable
            style={{ height: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
