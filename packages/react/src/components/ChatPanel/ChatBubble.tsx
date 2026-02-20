/**
 * Chat message bubble component.
 *
 * Renders user and assistant messages with distinct styling.
 * Detects ```sql code blocks and adds an "Apply to Editor" button.
 */

import { useMemo } from 'react';
import { useTheme } from '../../theme';
import { Button } from '../ui/Button';
import type { ChatBubbleProps } from './types';

export type { ChatBubbleProps } from './types';

/**
 * Parse message content and split into text and SQL blocks.
 */
function parseContent(content: string): Array<{ type: 'text' | 'sql'; value: string }> {
  const startToken = '```sql';
  const endToken = '```';
  const parts: Array<{ type: 'text' | 'sql'; value: string }> = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf(startToken, cursor);
    if (start === -1) break;

    // Push text before this SQL block
    if (start > cursor) {
      parts.push({ type: 'text', value: content.slice(cursor, start) });
    }

    // Find the newline after ```sql
    const sqlStart = content.indexOf('\n', start + startToken.length);
    if (sqlStart === -1) break;

    // Find closing ```
    const end = content.indexOf(endToken, sqlStart + 1);
    if (end === -1) break;

    const sql = content.slice(sqlStart + 1, end).trim();
    if (sql) {
      parts.push({ type: 'sql', value: sql });
    }

    cursor = end + endToken.length;
  }

  // Remaining text
  if (cursor < content.length) {
    parts.push({ type: 'text', value: content.slice(cursor) });
  }

  return parts;
}

export function ChatBubble({ message, onApplySql }: ChatBubbleProps): JSX.Element {
  const { theme } = useTheme();
  const isUser = message.role === 'user';
  const parts = useMemo(() => parseContent(message.content), [message.content]);

  const bubbleStyle: React.CSSProperties = {
    maxWidth: '85%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSizes.sm,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
    color: isUser ? '#fff' : theme.colors.text,
    border: isUser ? 'none' : `1px solid ${theme.colors.border}`,
  };

  const sqlBlockStyle: React.CSSProperties = {
    backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : theme.colors.background,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    margin: `${theme.spacing.xs} 0`,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSizes.xs,
    overflow: 'auto',
    position: 'relative',
  };

  const applyBtnContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.xs,
  };

  return (
    <div style={bubbleStyle}>
      {parts.map((part, i) => {
        if (part.type === 'sql') {
          return (
            <div key={i} data-testid={`chat-sql-${i}`}>
              <pre style={sqlBlockStyle}>
                <code>{part.value}</code>
              </pre>
              {onApplySql && (
                <div style={applyBtnContainerStyle}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onApplySql(part.value)}
                    data-testid={`apply-sql-btn-${i}`}
                  >
                    Apply to Editor
                  </Button>
                </div>
              )}
            </div>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </div>
  );
}
