'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isRequestLive, type AgentRequest, type RequestStatus, type RequestWithContext } from '@/lib/types';
import { useSupabase } from './useSupabase';
import { useNow } from './useNow';
import { subscribeTable } from './realtime';

const SELECT =
  '*, agent:agents(id,session_id,name,role,human,status), project:projects(id,name,team_id), answerer:profiles(id,display_name,avatar_url)';

export interface UseRequestsOpts {
  agentId?: string;
  projectId?: string;
  status?: RequestStatus | RequestStatus[];
  limit?: number;
  /** only requests that are not open (for "recently resolved") */
  resolvedOnly?: boolean;
}

export function useRequests(opts: UseRequestsOpts = {}): {
  requests: RequestWithContext[];
  loading: boolean;
  error: string | null;
} {
  const { agentId, projectId, status, limit = 50, resolvedOnly } = opts;
  const statusKey = Array.isArray(status) ? status.join(',') : status ?? '';
  const supabase = useSupabase();
  const [requests, setRequests] = useState<RequestWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const matches = useCallback(
    (r: AgentRequest) => {
      if (agentId && r.agent_id !== agentId) return false;
      if (projectId && r.project_id !== projectId) return false;
      if (statusKey && !statusKey.split(',').includes(r.status)) return false;
      if (resolvedOnly && r.status === 'open') return false;
      return true;
    },
    [agentId, projectId, statusKey, resolvedOnly],
  );

  useEffect(() => {
    let cancelled = false;
    let q = supabase.from('requests').select(SELECT).order('created_at', { ascending: false }).limit(limit);
    if (agentId) q = q.eq('agent_id', agentId);
    if (projectId) q = q.eq('project_id', projectId);
    if (statusKey) q = q.in('status', statusKey.split(','));
    if (resolvedOnly) q = q.neq('status', 'open');
    q.then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setRequests((prev) => {
          const map = new Map<string, RequestWithContext>((data as unknown as RequestWithContext[]).map((r) => [r.id, r]));
          for (const p of prev) if (!map.has(p.id) && matches(p)) map.set(p.id, p);
          return Array.from(map.values());
        });
      }
      setLoading(false);
    });

    const unsub = subscribeTable<AgentRequest>(
      supabase,
      'requests',
      { label: `${agentId ?? projectId ?? 'all'}` },
      async (c) => {
        if (c.eventType === 'DELETE') {
          setRequests((prev) => prev.filter((r) => r.id !== (c.old as AgentRequest).id));
          return;
        }
        const id = c.new.id;
        const { data } = await supabase.from('requests').select(SELECT).eq('id', id).maybeSingle();
        if (cancelled) return;
        const row = (data as unknown as RequestWithContext | null) ?? null;
        setRequests((prev) => {
          const rest = prev.filter((r) => r.id !== id);
          if (!row || !matches(row)) return rest;
          return [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, Math.max(limit, 1) + 50);
        });
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supabase, agentId, projectId, statusKey, limit, resolvedOnly, matches]);

  return { requests, loading, error };
}

/** Live open requests (client-filtered by expiry), oldest first. */
export function useOpenRequests(opts: { agentId?: string; projectId?: string } = {}): {
  requests: RequestWithContext[];
  count: number;
  loading: boolean;
  error: string | null;
} {
  const { requests, loading, error } = useRequests({ ...opts, status: 'open', limit: 200 });
  const now = useNow(15000);
  const live = useMemo(
    () => requests.filter((r) => isRequestLive(r, now)).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [requests, now],
  );
  return { requests: live, count: live.length, loading, error };
}
