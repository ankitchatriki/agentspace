'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Callout,
  Card,
  EmptyState,
  GithubEventItem,
  PageHeader,
  RequestCard,
  SegmentedControl,
  Select,
  StatTile,
} from '@/components/ui';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOpenRequests } from '@/lib/hooks/useRequests';
import { useGithubEvents } from '@/lib/hooks/useGithubEvents';
import { useNow } from '@/lib/hooks/useNow';
import { agentDisplayName } from '@/lib/types';
import { sortAgents } from '@/lib/client/format';
import { Loading } from './_components/Loading';
import { Skeleton } from './_components/Skeleton';
import { AgentsTable } from './_components/AgentsTable';
import { useKpis } from './_components/useKpis';
import { useRequestActions } from './_components/useRequestActions';

type Filter = 'active' | 'needs' | 'all';

export default function OverviewPage() {
  const { agents, loading, error } = useAgents();
  const { requests, count: openCount } = useOpenRequests();
  const { events: gh, loading: ghLoading } = useGithubEvents({ limit: 10 });
  const { eventsLastHour, openPrs } = useKpis();
  const now = useNow(60000);
  const actions = useRequestActions();

  const [filter, setFilter] = useState<Filter>('active');
  const [project, setProject] = useState('');
  const [human, setHuman] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const activeAgents = agents.filter((a) => a.status === 'running' || a.status === 'idle' || a.status === 'waiting_on_human').length;
  const waiting = agents.filter((a) => a.status === 'waiting_on_human').length;

  const projectOptions = useMemo(
    () => [{ value: '', label: 'All projects' }, ...Array.from(new Map(agents.filter((a) => a.project).map((a) => [a.project!.id, a.project!.name])).entries()).map(([value, label]) => ({ value, label }))],
    [agents],
  );
  const humanOptions = useMemo(
    () => [{ value: '', label: 'All teammates' }, ...Array.from(new Set(agents.map((a) => a.human).filter((h): h is string => !!h))).sort().map((h) => ({ value: h, label: h }))],
    [agents],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return sortAgents(
      agents.filter((a) => {
        if (filter === 'needs' && a.status !== 'waiting_on_human') return false;
        if (filter === 'active' && a.status === 'ended' && !(a.ended_at && now - new Date(a.ended_at).getTime() < 3600_000)) return false;
        if (project && a.project_id !== project) return false;
        if (human && a.human !== human) return false;
        if (status && a.status !== status) return false;
        if (s && !`${agentDisplayName(a)} ${a.human ?? ''} ${a.project?.name ?? ''} ${a.last_event_summary ?? ''} ${a.git_branch ?? ''}`.toLowerCase().includes(s)) return false;
        return true;
      }),
    );
  }, [agents, filter, project, human, status, search, now]);

  const kpi = (v: number | null) => (v === null ? '…' : v);
  const visibleRequests = requests.filter((r) => !actions.hidden.has(r.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Every agent across all projects and teammates, live." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatTile label="Active agents" value={activeAgents} tone="running" />
            <StatTile label="Waiting on human" value={waiting + 0} tone="waiting" hint={`${openCount} open request${openCount === 1 ? '' : 's'}`} />
            <StatTile label="Events, last hour" value={kpi(eventsLastHour)} tone="idle" />
            <StatTile label="Open PRs" value={kpi(openPrs)} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'needs', label: 'Needs you', count: waiting },
                { value: 'all', label: 'All (24h)' },
              ]}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              aria-label="Search agents"
              className="h-8 min-w-[160px] flex-1 rounded-md border border-line bg-surface-2 px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} options={projectOptions} />
            <Select aria-label="Teammate" value={human} onChange={(e) => setHuman(e.target.value)} options={humanOptions} />
            <Select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'running', label: 'Running' },
                { value: 'waiting_on_human', label: 'Needs you' },
                { value: 'idle', label: 'Idle' },
                { value: 'ended', label: 'Ended' },
              ]}
            />
          </div>

          {error ? (
            <Callout tone="danger" title="Could not load agents">{error}</Callout>
          ) : loading ? (
            <Loading rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={agents.length === 0 ? 'No agents yet' : 'No agents match these filters'}
              description={
                agents.length === 0
                  ? 'Connect a project and start Claude Code. Agents show up here as soon as they send their first event.'
                  : 'Try clearing a filter or search.'
              }
              action={
                agents.length === 0 ? (
                  <Link href="/projects">
                    <Button>Go to projects</Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <AgentsTable agents={filtered} />
          )}
        </div>

        <aside className="space-y-6">
          <Card
            title="Needs you"
            actions={
              <Link href="/inbox" className="text-xs text-accent hover:underline">
                Open inbox
              </Link>
            }
          >
            {visibleRequests.length === 0 ? (
              <p className="text-sm text-fg-muted">Nothing waiting on you.</p>
            ) : (
              <div className="space-y-3">
                {visibleRequests.slice(0, 5).map((r) => (
                  <RequestCard key={r.id} request={r} compact agentHref={r.agent ? `/agents/${r.agent.id}` : undefined} />
                ))}
              </div>
            )}
          </Card>
          <Card title="GitHub activity">
            {ghLoading ? (
              <Loading rows={3} />
            ) : gh.length === 0 ? (
              <p className="text-sm text-fg-muted">No GitHub events yet. Add a webhook from a project page.</p>
            ) : (
              <div className="space-y-2">
                {gh.map((e) => (
                  <GithubEventItem key={e.id} event={e} />
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
