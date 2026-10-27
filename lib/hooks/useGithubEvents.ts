'use client';
import { useEffect, useState } from 'react';
import type { GithubEvent } from '@/lib/types';
import { useSupabase } from './useSupabase';
import { subscribeTable } from './realtime';

export function useGithubEvents(opts: { projectId?: string; limit: number }): {
  events: GithubEvent[];
  loading: boolean;
  error: string | null;
} {
  const { projectId, limit } = opts;
  const supabase = useSupabase();
  const [events, setEvents] = useState<GithubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let q = supabase.from('github_events').select('*').order('id', { ascending: false }).limit(limit);
    if (projectId) q = q.eq('project_id', projectId);
    q.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setEvents((prev) => {
          const rows = (data ?? []) as GithubEvent[];
          const ids = new Set(rows.map((r) => r.id));
          return [...prev.filter((p) => !ids.has(p.id)), ...rows].sort((a, b) => b.id - a.id).slice(0, limit);
        });
      }
      setLoading(false);
    });
    const unsub = subscribeTable<GithubEvent>(
      supabase,
      'github_events',
      { event: 'INSERT', filter: projectId ? `project_id=eq.${projectId}` : undefined, label: projectId ?? 'all' },
      (c) => setEvents((prev) => (prev.some((e) => e.id === c.new.id) ? prev : [c.new, ...prev].slice(0, limit))),
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supabase, projectId, limit]);

  return { events, loading, error };
}
