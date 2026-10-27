'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Project } from '@/lib/types';
import { useSupabase } from './useSupabase';
import { subscribeTable } from './realtime';

export function useProjects(): {
  projects: Project[];
  byId: Record<string, Project>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
} {
  const supabase = useSupabase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data, error: err } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else {
      setProjects((data ?? []) as Project[]);
      setError(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void reload();
    return subscribeTable<Project>(supabase, 'projects', {}, (c) => {
      setProjects((prev) => {
        if (c.eventType === 'DELETE') return prev.filter((p) => p.id !== (c.old as Project).id);
        const row = c.new;
        const i = prev.findIndex((p) => p.id === row.id);
        if (i === -1) return [row, ...prev];
        const next = prev.slice();
        next[i] = { ...prev[i], ...row };
        return next;
      });
    });
  }, [supabase, reload]);

  const byId = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  return { projects, byId, loading, error, reload };
}
