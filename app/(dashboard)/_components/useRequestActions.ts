'use client';
import { useCallback, useState } from 'react';
import * as api from '@/lib/client/api';

/**
 * Per-request busy/error state for answer + dismiss.
 * Optimistic: the request id is added to `hidden` immediately and restored if the call fails.
 * Realtime updates the lists afterwards.
 */
export function useRequestActions() {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const run = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: null }));
    setHidden((h) => new Set(h).add(id));
    try {
      await fn();
    } catch (err) {
      setHidden((h) => {
        const n = new Set(h);
        n.delete(id);
        return n;
      });
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, []);

  const answer = useCallback((id: string, text: string) => run(id, () => api.answerRequest(id, text)), [run]);
  const dismiss = useCallback((id: string) => run(id, () => api.dismissRequest(id)), [run]);
  return { busy, errors, hidden, answer, dismiss };
}
