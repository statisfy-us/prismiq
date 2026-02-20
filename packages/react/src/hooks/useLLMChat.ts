/**
 * Hook for interacting with the LLM chat agent.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAnalytics } from '../context';
import type { ChatMessage } from '../types';

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
  sendMessage: (message: string, currentSql: string | null) => Promise<void>;
  /** Clear conversation history. */
  clearHistory: () => void;
  /** Error from the last request. */
  error: string | null;
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
  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (message: string, currentSql: string | null) => {
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
          controller.signal
        )) {
          if (controller.signal.aborted) break;

          switch (chunk.type) {
            case 'text':
              accumulatedText += chunk.content ?? '';
              setStreamingContent(accumulatedText);
              break;
            case 'sql':
              lastSql = chunk.content ?? null;
              setSuggestedSql(lastSql);
              break;
            case 'error':
              setError(chunk.content ?? 'Unknown error');
              break;
            case 'done':
              // Final chunk — nothing else to do
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
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    suggestedSql,
    sendMessage,
    clearHistory,
    error,
  };
}
