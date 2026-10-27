'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Agent, AgentWithProject } from '@/lib/types';
import { useSupabase } from './useSupabase';
import { useProjects } from './useProjects';
import { subscribeTable } from './realtime';

export function useAgents(opts: { projectId?: string; sinceHours?: number } = {}): {
  agents: AgentWithProject[];
  loading: boolean;
  error: string | null;
} {
  const { projectId, sinceHours = 24 } = opts;
  const supabase = useSupabase();
  const { byId, loading: projectsLoading } = useProjects();
  const [raw, setRaw] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
    let q = supabase
      .from('agents')
      .select('*')
      .or(`ended_at.is.null,last_event_at.gt.${since}`)
      .order('last_event_at', { ascending: false })
      .limit(500);
    if (projectId) q = q.eq('project_id', projectId);
    q.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        // merge so realtime updates that raced the fetch are not lost
        setRaw((prev) => {
          const map = new Map<string, Agent>((data as Agent[]).map((a) => [a.id, a]));
          for (const p of prev) {
            const cur = map.get(p.id);
            if (!cur || new Date(p.last_event_at) > new Date(cur.last_event_at)) map.set(p.id, p);
          }
          return Array.from(map.values());
        });
      }
      setLoading(false);
    });
    const unsub = subscribeTable<Agent>(
      supabase,
      'agents',
      { filter: projectId ? `project_id=eq.${projectId}` : undefined, label: projectId ?? 'all' },
      (c) => {
        setRaw((prev) => {
          if (c.eventType === 'DELETE') return prev.filter((a) => a.id !== (c.old as Agent).id);
          const row = c.new;
          const i = prev.findIndex((a) => a.id === row.id);
          if (i === -1) return [row, ...prev];
          const next = prev.slice();
          next[i] = { ...prev[i], ...row };
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supabase, projectId, sinceHours]);

  const agents = useMemo<AgentWithProject[]>(
    () =>
      raw
        .map((a) => {
          const p = byId[a.project_id];
          return { ...a, project: p ? { id: p.id, name: p.name, team_id: p.team_id } : null };
        })
        .sort((a, b) => new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime()),
    [raw, byId],
  );

  return { agents, loading: loading || projectsLoading, error };
}
