'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentEvent } from '@/lib/types';
import { useSupabase } from './useSupabase';
import { subscribeTable } from './realtime';

const PAGE = 200;

export function useAgentEvents(agentId: string): {
  events: AgentEvent[];
  loading: boolean;
  error: string | null;
  loadOlder: () => Promise<void>;
  hasMore: boolean;
  loadingOlder: boolean;
} {
  const supabase = useSupabase();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const minId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEvents([]);
    minId.current = null;
    supabase
      .from('events')
      .select('*')
      .eq('agent_id', agentId)
      .order('id', { ascending: false })
      .limit(PAGE)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else {
          const rows = (data ?? []) as AgentEvent[];
          setError(null);
          setHasMore(rows.length === PAGE);
          minId.current = rows.length ? rows[rows.length - 1].id : null;
          setEvents((prev) => {
            const ids = new Set(rows.map((r) => r.id));
            return [...prev.filter((p) => !ids.has(p.id)), ...rows].sort((a, b) => b.id - a.id);
          });
        }
        setLoading(false);
      });
    const unsub = subscribeTable<AgentEvent>(
      supabase,
      'events',
      { event: 'INSERT', filter: `agent_id=eq.${agentId}`, label: agentId },
      (c) => {
        setEvents((prev) => (prev.some((e) => e.id === c.new.id) ? prev : [c.new, ...prev]));
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supabase, agentId]);

  const loadOlder = useCallback(async () => {
    if (minId.current == null) return;
    setLoadingOlder(true);
    const { data, error: err } = await supabase
      .from('events')
      .select('*')
      .eq('agent_id', agentId)
      .lt('id', minId.current)
      .order('id', { ascending: false })
      .limit(PAGE);
    if (err) setError(err.message);
    else {
      const rows = (data ?? []) as AgentEvent[];
      setHasMore(rows.length === PAGE);
      if (rows.length) minId.current = rows[rows.length - 1].id;
      setEvents((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...rows.filter((r) => !ids.has(r.id))];
      });
    }
    setLoadingOlder(false);
  }, [supabase, agentId]);

  return { events, loading, error, loadOlder, hasMore, loadingOlder };
}
