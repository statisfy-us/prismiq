/**
 * Hook for checking LLM agent availability.
 */

import { useState, useEffect } from 'react';
import { useAnalytics } from '../context';
import type { LLMStatus } from '../types';

export interface UseLLMStatusResult {
  /** Whether the LLM agent is enabled on the backend. */
  enabled: boolean;
  /** Provider name (e.g., 'gemini'). */
  provider: string | undefined;
  /** Model name (e.g., 'gemini-2.0-flash'). */
  model: string | undefined;
  /** Whether the status is still loading. */
  isLoading: boolean;
  /** Error from the status check, if any. */
  error: Error | null;
}

/**
 * Check if the LLM agent is available.
 *
 * Makes a single request to /llm/status on mount.
 * If the request fails (e.g., 404 because the backend doesn't support LLM),
 * returns enabled=false without throwing.
 */
export function useLLMStatus(): UseLLMStatusResult {
  const { client } = useAnalytics();
  const [status, setStatus] = useState<LLMStatus>({ enabled: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!client) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    client.getLLMStatus()
      .then((result) => {
        if (!cancelled) {
          setStatus(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        // Backend doesn't support LLM — that's fine
        if (!cancelled) {
          setStatus({ enabled: false });
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [client]);

  return {
    enabled: status.enabled,
    provider: status.provider,
    model: status.model,
    isLoading,
    error,
  };
}
