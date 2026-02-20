/**
 * Hook for interacting with the LLM chat agent.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAnalytics } from '../context';
import type { ChatMessage, WidgetContext } from '../types';

export interface UseLLMChatResult {
  /** Full conversation history (user + assistant messages). */
  messages: ChatMessage[];
  /** Whether a response is currently streaming. */
  isStreaming: boolean;
  /** Content currently being streamed (partial assistant response). */
  streamingContent: string;
  /** Last SQL suggestion extracted from the response. */
  suggestedSql: string | null;
  /** Send a message to the agent. */
  sendMessage: (message: string, currentSql: string | null, widgetContext?: WidgetContext) => Promise<void>;
  /** Clear conversation history. */
  clearHistory: () => void;
  /** Error from the last request. */
  error: string | null;
  /** Current status message from the agent (e.g., "Inspecting schema..."). */
  statusMessage: string | null;
}

/**
 * Hook for streaming chat with the LLM agent.
 *
 * Manages conversation state, streaming, and SQL extraction.
 */
export function useLLMChat(): UseLLMChatResult {
  const { client } = useAnalytics();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [suggestedSql, setSuggestedSql] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (message: string, currentSql: string | null, widgetContext?: WidgetContext) => {
      if (!client || isStreamingRef.current) return;

      // Cancel any previous streaming request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Add user message to history
      const userMsg: ChatMessage = { role: 'user', content: message };
      setMessages((prev) => [...prev, userMsg]);
      isStreamingRef.current = true;
      setIsStreaming(true);
      setStreamingContent('');
      setSuggestedSql(null);
      setError(null);
      setStatusMessage(null);

      let accumulatedText = '';
      let lastSql: string | null = null;

      try {
        // History is prior conversation only — the current user message is sent
        // separately as the `message` param (backend appends it independently).
        const history = messagesRef.current.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        for await (const chunk of client.streamChat(
          message,
          history,
          currentSql,
          controller.signal,
          widgetContext
        )) {
          if (controller.signal.aborted) break;

          switch (chunk.type) {
            case 'text':
              accumulatedText += chunk.content ?? '';
              setStreamingContent(accumulatedText);
              setStatusMessage(null); // Clear status when text starts
              break;
            case 'sql':
              lastSql = chunk.content ?? null;
              setSuggestedSql(lastSql);
              break;
            case 'status':
              setStatusMessage(chunk.content ?? null);
              break;
            case 'error':
              setError(chunk.content ?? 'Unknown error');
              break;
            case 'done':
              setStatusMessage(null);
              break;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
        setStatusMessage(null);

        // Add assistant message to history
        if (accumulatedText) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: accumulatedText,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }

        setStreamingContent('');
      }
    },
    [client]
  );

  // Cancel any in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingContent('');
    setSuggestedSql(null);
    setError(null);
    setIsStreaming(false);
    setStatusMessage(null);
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    suggestedSql,
    sendMessage,
    clearHistory,
    error,
    statusMessage,
  };
}
