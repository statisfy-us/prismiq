/**
 * Chat panel for LLM-assisted SQL generation.
 *
 * Side panel with message history, streaming indicator,
 * "Apply SQL" button, and input field.
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { useTheme } from '../../theme';
import { useLLMChat } from '../../hooks/useLLMChat';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ChatBubble } from './ChatBubble';

export interface ChatPanelProps {
  /** Current SQL in the editor (passed as context to the agent). */
  currentSql: string | null;
  /** Callback when the user wants to apply SQL to the editor. */
  onApplySql: (sql: string) => void;
}

export function ChatPanel({ currentSql, onApplySql }: ChatPanelProps): JSX.Element {
  const { theme } = useTheme();
  const {
    messages,
    isStreaming,
    streamingContent,
    suggestedSql,
    sendMessage,
    clearHistory,
    error,
  } = useLLMChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    void sendMessage(trimmed, currentSql);
  }, [input, currentSql, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderLeft: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  };

  const headerTitleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.fontSizes.sm,
    fontWeight: 600,
    color: theme.colors.text,
  };

  const messagesStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const streamingStyle: React.CSSProperties = {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.radius.md,
    fontSize: theme.fontSizes.sm,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  };

  const suggestedSqlStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const inputAreaStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  };

  const textareaStyle: React.CSSProperties = {
    flex: 1,
    resize: 'none',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.fontSizes.sm,
    fontFamily: theme.fonts.sans,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '36px',
    maxHeight: '120px',
  };

  const emptyStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing.lg,
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.sm,
  };

  const errorStyle: React.CSSProperties = {
    padding: theme.spacing.sm,
    margin: `0 ${theme.spacing.md}`,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    fontSize: theme.fontSizes.xs,
    flexShrink: 0,
  };

  return (
    <div style={containerStyle} className="prismiq-chat-panel">
      {/* Header */}
      <div style={headerStyle}>
        <div style={headerTitleStyle}>
          <Icon name="edit" size={16} />
          <span>SQL Assistant</span>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory}>
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      {messages.length === 0 && !isStreaming ? (
        <div style={emptyStyle}>
          Ask me to help write SQL queries.{'\n'}
          I can see your database schema and validate queries.
        </div>
      ) : (
        <div style={messagesStyle}>
          {messages.map((msg, i) => (
            <ChatBubble key={i} message={msg} onApplySql={onApplySql} />
          ))}
          {isStreaming && streamingContent && (
            <div style={streamingStyle}>{streamingContent}{'▍'}</div>
          )}
          {isStreaming && !streamingContent && (
            <div style={streamingStyle}>Thinking...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Error */}
      {error && <div style={errorStyle}>{error}</div>}

      {/* Suggested SQL quick-apply */}
      {suggestedSql && !isStreaming && (
        <div style={suggestedSqlStyle}>
          <Button variant="primary" size="sm" onClick={() => onApplySql(suggestedSql)}>
            Apply SQL to Editor
          </Button>
        </div>
      )}

      {/* Input */}
      <div style={inputAreaStyle}>
        <textarea
          style={textareaStyle}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your data..."
          rows={1}
          disabled={isStreaming}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
        >
          <Icon name="play" size={16} />
        </Button>
      </div>
    </div>
  );
}
