/**
 * Chat message bubble component.
 *
 * Renders user and assistant messages with distinct styling.
 * Detects ```sql code blocks and adds an "Apply to Editor" button.
 */

import { useMemo } from 'react';
import { useTheme } from '../../theme';
import { Button } from '../ui/Button';
import type { ChatMessage } from '../../types';

export interface ChatBubbleProps {
  /** The chat message to render. */
  message: ChatMessage;
  /** Callback when user clicks "Apply to Editor" on a SQL block. */
  onApplySql?: (sql: string) => void;
}

/**
 * Parse message content and split into text and SQL blocks.
 */
function parseContent(content: string): Array<{ type: 'text' | 'sql'; value: string }> {
  const parts: Array<{ type: 'text' | 'sql'; value: string }> = [];
  const regex = /```sql\s*\n([\s\S]*?)\n\s*```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    // Text before the SQL block
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    // SQL block
    parts.push({ type: 'sql', value: (match[1] ?? '').trim() });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
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
            <div key={i}>
              <pre style={sqlBlockStyle}>
                <code>{part.value}</code>
              </pre>
              {onApplySql && (
                <div style={applyBtnContainerStyle}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onApplySql(part.value)}
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
