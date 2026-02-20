/**
 * Shared types for ChatPanel components.
 */

import type { ChatMessage, WidgetContext } from '../../types';

export interface ChatBubbleProps {
  /** The chat message to render. */
  message: ChatMessage;
  /** Callback when user clicks "Apply to Editor" on a SQL block. */
  onApplySql?: (sql: string) => void;
}

export interface ChatPanelProps {
  /** Current SQL in the editor (passed as context to the agent). */
  currentSql: string | null;
  /** Callback when the user wants to apply SQL to the editor. */
  onApplySql: (sql: string) => void;
  /** Optional widget context for targeted SQL generation. */
  widgetContext?: WidgetContext;
}
