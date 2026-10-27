'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Callout,
  Card,
  CopyField,
  EmptyState,
  EventTimeline,
  PageHeader,
  RelativeTime,
  RequestCard,
  SegmentedControl,
  StatusBadge,
} from '@/components/ui';
import { agentDisplayName, isStale, type Agent, type AgentWithProject } from '@/lib/types';
import { useSupabase } from '@/lib/hooks/useSupabase';
import { useProjects } from '@/lib/hooks/useProjects';
import { useAgentEvents } from '@/lib/hooks/useAgentEvents';
import { useOpenRequests } from '@/lib/hooks/useRequests';
import { subscribeTable } from '@/lib/hooks/realtime';
import { Loading } from '../../_components/Loading';
import { useRequestActions } from '../../_components/useRequestActions';

type Filter = 'all' | 'prompts' | 'tools' | 'attention';

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useSupabase();
  const { byId } = useProjects();
  const [raw, setRaw] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const { events, loading: evLoading, error: evError, loadOlder, hasMore, loadingOlder } = useAgentEvents(id);
  const { requests } = useOpenRequests({ agentId: id });
  const actions = useRequestActions();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRaw((prev) => (prev && data && new Date(prev.last_event_at) > new Date((data as Agent).last_event_at) ? prev : (data as Agent | null)));
        setLoading(false);
      });
    const unsub = subscribeTable<Agent>(supabase, 'agents', { filter: `id=eq.${id}`, label: id }, (c) => {
      if (c.eventType !== 'DELETE') setRaw((prev) => ({ ...(prev ?? ({} as Agent)), ...c.new }));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [supabase, id]);

  const agent: AgentWithProject | null = useMemo(() => {
    if (!raw) return null;
    const p = byId[raw.project_id];
    return { ...raw, project: p ? { id: p.id, name: p.name, team_id: p.team_id } : null };
  }, [raw, byId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => {
      const n = e.hook_event_name;
      if (filter === 'prompts') return n === 'UserPromptSubmit';
      if (filter === 'tools') return n === 'PreToolUse' || n === 'PostToolUse';
      return n === 'Notification' || n === 'Stop' || n.startsWith('Session');
    });
  }, [events, filter]);

  if (loading) return <Loading />;
  if (error) return <Callout tone="danger" title="Could not load agent">{error}</Callout>;
  if (!agent)
    return (
      <EmptyState
        title="Agent not found"
        description="It may have been removed, or you do not have access."
        action={<Link href="/" className="text-accent hover:underline">Back to overview</Link>}
      />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ href: '/', label: 'Overview' }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {agentDisplayName(agent)}
            <StatusBadge status={agent.status} stale={isStale(agent)} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {agent.role && <Badge>{agent.role}</Badge>}
            {agent.human && <span>{agent.human}</span>}
            {agent.project && (
              <Link href={`/projects/${agent.project.id}`} className="text-accent hover:underline">
                {agent.project.name}
              </Link>
            )}
            {agent.git_branch && <span className="font-mono">{agent.git_branch}</span>}
            {agent.cwd && <span className="font-mono text-fg-subtle">{agent.cwd}</span>}
            <span>
              started <RelativeTime iso={agent.started_at} />
            </span>
            {agent.ended_at && (
              <span>
                ended <RelativeTime iso={agent.ended_at} />
              </span>
            )}
          </span>
        }
      />

      {agent.attention_message && (
        <Callout tone="warning" title={`Needs attention (${agent.attention_kind ?? 'input'})`}>
          {agent.attention_message}. Respond in the terminal.
        </Callout>
      )}

      <div className="max-w-md">
        <CopyField label="Session id" value={agent.session_id} mono />
      </div>

      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Open requests</h2>
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              busy={actions.busy[r.id]}
              error={actions.errors[r.id]}
              onAnswer={(t) => actions.answer(r.id, t)}
              onDismiss={() => actions.dismiss(r.id)}
            />
          ))}
        </section>
      )}

      <Card
        title="Timeline"
        actions={
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'prompts', label: 'Prompts' },
              { value: 'tools', label: 'Tools' },
              { value: 'attention', label: 'Attention' },
            ]}
          />
        }
      >
        {evError ? (
          <Callout tone="danger">{evError}</Callout>
        ) : evLoading ? (
          <Loading />
        ) : (
          <EventTimeline
            events={filtered}
            onLoadOlder={loadOlder}
            loadingOlder={loadingOlder}
            hasMore={hasMore}
            emptyLabel="No events match this filter."
          />
        )}
      </Card>
    </div>
  );
}
