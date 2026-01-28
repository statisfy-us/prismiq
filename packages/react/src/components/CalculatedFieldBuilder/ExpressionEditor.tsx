/**
 * ExpressionEditor component for editing calculated field expressions.
 *
 * Provides a text input with:
 * - Expression syntax help
 * - Available functions reference
 * - Field reference insertion
 */

import { useState, useCallback, useRef } from 'react';
import { useTheme } from '../../theme';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/Dropdown';
import { Icon } from '../ui/Icon';
import type { QueryTable, DatabaseSchema } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ExpressionEditorProps {
  /** Current expression value. */
  value: string;
  /** Callback when expression changes. */
  onChange: (value: string) => void;
  /** Tables in the query (for field references). */
  tables: QueryTable[];
  /** Database schema for field information. */
  schema: DatabaseSchema;
  /** Placeholder text. */
  placeholder?: string;
  /** Whether the input is disabled. */
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FUNCTIONS = [
  { name: 'if', signature: 'if(condition, true_val, false_val)', description: 'Conditional expression' },
  { name: 'sum', signature: 'sum(expr)', description: 'Sum of values' },
  { name: 'avg', signature: 'avg(expr)', description: 'Average of values' },
  { name: 'count', signature: 'count(expr)', description: 'Count of values' },
  { name: 'min', signature: 'min(expr)', description: 'Minimum value' },
  { name: 'max', signature: 'max(expr)', description: 'Maximum value' },
  { name: 'year', signature: 'year(date)', description: 'Extract year from date' },
  { name: 'month', signature: 'month(date)', description: 'Extract month from date' },
  { name: 'day', signature: 'day(date)', description: 'Extract day from date' },
  { name: 'datediff', signature: 'datediff(date1, date2)', description: 'Days between dates' },
  { name: 'today', signature: 'today()', description: 'Current date' },
  { name: 'concatenate', signature: 'concatenate(str1, str2, ...)', description: 'Join strings' },
];

const OPERATORS = [
  { symbol: '+', description: 'Addition' },
  { symbol: '-', description: 'Subtraction' },
  { symbol: '*', description: 'Multiplication' },
  { symbol: '/', description: 'Division' },
  { symbol: '==', description: 'Equals' },
  { symbol: '!=', description: 'Not equals' },
  { symbol: '>', description: 'Greater than' },
  { symbol: '<', description: 'Less than' },
  { symbol: '>=', description: 'Greater or equal' },
  { symbol: '<=', description: 'Less or equal' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Expression editor with syntax help and field insertion.
 */
export function ExpressionEditor({
  value,
  onChange,
  tables,
  schema,
  placeholder = 'Enter expression (e.g., [revenue] - [cost])',
  disabled = false,
}: ExpressionEditorProps): JSX.Element {
  const { theme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Insert text at cursor position
  const insertText = useCallback(
    (text: string) => {
      const input = inputRef.current;
      if (!input) {
        onChange(value + text);
        return;
      }

      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);

      // Move cursor after inserted text
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + text.length;
        input.focus();
      }, 0);
    },
    [value, onChange]
  );

  // Insert field reference
  const insertFieldRef = useCallback(
    (tableId: string, column: string) => {
      const table = tables.find((t) => t.id === tableId);
      if (tables.length > 1 && table) {
        insertText(`[${table.alias ?? table.name}.${column}]`);
      } else {
        insertText(`[${column}]`);
      }
    },
    [tables, insertText]
  );

  // Insert function
  const insertFunction = useCallback(
    (fn: (typeof FUNCTIONS)[0]) => {
      insertText(fn.signature);
    },
    [insertText]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  };

  const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.xs,
    alignItems: 'center',
  };

  const helpStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSizes.xs,
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 600,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
  };

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  };

  const itemStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    fontSize: theme.fontSizes.xs,
  };

  return (
    <div style={containerStyle}>
      <div style={inputRowStyle}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ flex: 1, fontFamily: 'monospace' }}
        />

        {/* Insert Field Dropdown */}
        <Dropdown
          trigger={
            <Button variant="secondary" size="sm" disabled={disabled || tables.length === 0}>
              <Icon name="table" size={14} />
            </Button>
          }
        >
          {tables.flatMap((table) => {
            const tableSchema = schema.tables.find((t) => t.name === table.name);
            if (!tableSchema) return [];

            return [
              <DropdownItem key={`header-${table.id}`} disabled>
                {table.alias ?? table.name}
              </DropdownItem>,
              ...tableSchema.columns.map((col) => (
                <DropdownItem
                  key={`${table.id}-${col.name}`}
                  onClick={() => insertFieldRef(table.id, col.name)}
                >
                  {col.name}
                  <span style={{ color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                    ({col.data_type})
                  </span>
                </DropdownItem>
              )),
              <DropdownSeparator key={`sep-${table.id}`} />,
            ];
          })}
        </Dropdown>

        {/* Insert Function Dropdown */}
        <Dropdown
          trigger={
            <Button variant="secondary" size="sm" disabled={disabled}>
              <Icon name="settings" size={14} />
            </Button>
          }
        >
          {FUNCTIONS.map((fn) => (
            <DropdownItem key={fn.name} onClick={() => insertFunction(fn)}>
              <span style={{ fontFamily: 'monospace' }}>{fn.name}()</span>
              <span style={{ color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                {fn.description}
              </span>
            </DropdownItem>
          ))}
        </Dropdown>

        {/* Help Toggle */}
        <Button variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)}>
          <Icon name="info" size={14} />
        </Button>
      </div>

      {/* Syntax Help */}
      {showHelp && (
        <div style={helpStyle}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Field References</div>
            <p style={{ margin: 0, color: theme.colors.textMuted }}>
              Use <code>[field_name]</code> to reference columns, or{' '}
              <code>[Table.field]</code> for multi-table queries.
            </p>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Operators</div>
            <ul style={listStyle}>
              {OPERATORS.map((op) => (
                <li
                  key={op.symbol}
                  style={itemStyle}
                  onClick={() => insertText(` ${op.symbol} `)}
                  title={op.description}
                >
                  {op.symbol}
                </li>
              ))}
            </ul>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Functions</div>
            <ul style={listStyle}>
              {FUNCTIONS.map((fn) => (
                <li
                  key={fn.name}
                  style={itemStyle}
                  onClick={() => insertFunction(fn)}
                  title={fn.description}
                >
                  {fn.name}()
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={sectionTitleStyle}>Examples</div>
            <ul style={{ margin: 0, paddingLeft: theme.spacing.md, color: theme.colors.textMuted }}>
              <li><code>[revenue] - [cost]</code> - Calculate profit</li>
              <li><code>if([status] == "active", 1, 0)</code> - Conditional value</li>
              <li><code>year([created_at])</code> - Extract year</li>
              <li><code>datediff(today(), [order_date])</code> - Days since order</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
