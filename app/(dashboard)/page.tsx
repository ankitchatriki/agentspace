'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AgentCard,
  AgentGroup,
  Callout,
  Card,
  EmptyState,
  GithubEventItem,
  PageHeader,
  RequestCard,
  SegmentedControl,
  StatTile,
  Button,
} from '@/components/ui';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOpenRequests } from '@/lib/hooks/useRequests';
import { useGithubEvents } from '@/lib/hooks/useGithubEvents';
import { useNow } from '@/lib/hooks/useNow';
import { countByStatus, groupAgents } from '@/lib/client/format';
import { Loading } from './_components/Loading';
import { useRequestActions } from './_components/useRequestActions';

type Filter = 'active' | 'needs' | 'all';
type GroupBy = 'project' | 'human';

export default function OverviewPage() {
  const { agents, loading, error } = useAgents();
  const { requests, count: openCount } = useOpenRequests();
  const { events: gh, loading: ghLoading } = useGithubEvents({ limit: 10 });
  const now = useNow(60000);
  const [filter, setFilter] = useState<Filter>('active');
  const [groupBy, setGroupBy] = useState<GroupBy>('project');
  const actions = useRequestActions();

  const counts = useMemo(() => countByStatus(agents.filter((a) => a.status !== 'ended')), [agents]);

  const filtered = useMemo(() => {
    return agents.filter((a) => {
      if (filter === 'needs') return a.status === 'waiting_on_human';
      if (filter === 'active')
        return a.status !== 'ended' || (a.ended_at && now - new Date(a.ended_at).getTime() < 3600_000) || false;
      return true;
    });
  }, [agents, filter, now]);

  const groups = useMemo(() => groupAgents(filtered, groupBy), [filtered, groupBy]);
  const needsCount = agents.filter((a) => a.status === 'waiting_on_human').length;

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Every agent across all projects and teammates, live." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Running" value={counts.running} tone="running" />
        <StatTile label="Needs you" value={counts.waiting_on_human} tone="waiting" />
        <StatTile label="Idle" value={counts.idle} tone="idle" />
        <StatTile label="Open requests" value={openCount} tone={openCount > 0 ? 'waiting' : 'neutral'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              size="sm"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'needs', label: 'Needs you', count: needsCount },
                { value: 'all', label: 'All (24h)' },
              ]}
            />
            <SegmentedControl
              size="sm"
              value={groupBy}
              onChange={(v) => setGroupBy(v as GroupBy)}
              options={[
                { value: 'project', label: 'Project' },
                { value: 'human', label: 'Person' },
              ]}
            />
          </div>

          {error ? (
            <Callout tone="danger" title="Could not load agents">{error}</Callout>
          ) : loading ? (
            <Loading label="Loading agents…" />
          ) : groups.length === 0 ? (
            <EmptyState
              title={agents.length === 0 ? 'No agents yet' : 'No agents match this filter'}
              description={
                agents.length === 0
                  ? 'Connect a project and start Claude Code. Agents show up here as soon as they send their first event.'
                  : 'Try a different filter.'
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
            groups.map((g) => (
              <AgentGroup
                key={g.key}
                title={g.title}
                count={g.agents.length}
                href={g.projectId ? `/projects/${g.projectId}` : undefined}
              >
                {g.agents.map((a) => (
                  <AgentCard key={a.id} agent={a} href={`/agents/${a.id}`} showProject={groupBy === 'human'} />
                ))}
              </AgentGroup>
            ))
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
            {requests.length === 0 ? (
              <p className="text-sm text-fg-muted">Nothing waiting on you.</p>
            ) : (
              <div className="space-y-3">
                {requests.slice(0, 5).map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    compact
                    agentHref={r.agent ? `/agents/${r.agent.id}` : undefined}
                    busy={actions.busy[r.id]}
                  />
                ))}
              </div>
            )}
          </Card>
          <Card title="GitHub activity">
            {ghLoading ? (
              <Loading />
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
