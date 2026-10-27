'use client';
import { useEffect, useState } from 'react';
import { useSupabase } from '@/lib/hooks/useSupabase';
import { subscribeTable } from '@/lib/hooks/realtime';

/** Events in the last hour + open PR count (derived from pull_request github_events, last 30 days). */
export function useKpis(): { eventsLastHour: number | null; openPrs: number | null } {
  const supabase = useSupabase();
  const [eventsLastHour, setEvents] = useState<number | null>(null);
  const [openPrs, setPrs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const hourAgo = new Date(Date.now() - 3600_000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
      const [ev, gh] = await Promise.all([
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('created_at', hourAgo),
        supabase
          .from('github_events')
          .select('id,title,project_id')
          .eq('event_type', 'pull_request')
          .gte('created_at', monthAgo)
          .order('id', { ascending: true })
          .limit(1000),
      ]);
      if (cancelled) return;
      if (!ev.error) setEvents(ev.count ?? 0);
      if (!gh.error) {
        const latest = new Map<string, string>();
        for (const r of (gh.data ?? []) as { title: string; project_id: string }[]) {
          const m = /^PR #(\d+) (\w+):/.exec(r.title);
          if (m) latest.set(`${r.project_id}#${m[1]}`, m[2]);
        }
        setPrs(Array.from(latest.values()).filter((a) => a !== 'closed' && a !== 'merged').length);
      }
    }
    void load();
    const t = setInterval(load, 30_000);
    const unsub = subscribeTable(supabase, 'github_events', { event: 'INSERT' }, () => void load());
    return () => {
      cancelled = true;
      clearInterval(t);
      unsub();
    };
  }, [supabase]);

  return { eventsLastHour, openPrs };
}
