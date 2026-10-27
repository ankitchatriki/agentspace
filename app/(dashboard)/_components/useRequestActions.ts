'use client';
import { useCallback, useState } from 'react';
import * as api from '@/lib/client/api';

/** Per-request busy/error state for answer + dismiss. Realtime updates the lists afterwards. */
export function useRequestActions() {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const run = useCallback(async (id: string, fn: () => Promise<unknown>) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setErrors((e) => ({ ...e, [id]: null }));
    try {
      await fn();
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : 'Failed' }));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }, []);

  const answer = useCallback((id: string, text: string) => run(id, () => api.answerRequest(id, text)), [run]);
  const dismiss = useCallback((id: string) => run(id, () => api.dismissRequest(id)), [run]);
  return { busy, errors, answer, dismiss };
}
