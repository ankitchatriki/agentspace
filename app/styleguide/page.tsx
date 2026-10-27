'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, GitPullRequest, Inbox, Plus, Radio, Timer } from 'lucide-react';
import type {
  AgentEvent, AgentStatus, AgentWithProject, GithubEvent, Project, ProjectToken,
  RequestWithContext, TeamMemberWithProfile,
} from '@/lib/types';
import { AGENT_STATUSES } from '@/lib/types';
import {
  AgentCard, AgentGroup, AppShell, AttentionCard, Avatar, Badge, Button, Callout, CodeBlock, CopyField,
  EmptyState, EventTimeline, GithubEventItem, Input, LoginCard, MemberRow, PageHeader, ProjectCard,
  RelativeTime, RequestCard, SegmentedControl, Select, Spinner, StatTile, StatusBadge, StatusDot,
  Textarea, TokenRow, Card, StatCard, Skeleton, AgentCardSkeleton, RequestCardSkeleton, ErrorState,
  DataTable, AvatarStack, Tabs, Breadcrumbs, CommandPaletteTrigger,
} from '@/components/ui';
import type { NavItem } from '@/components/ui';

const iso = (now: number, agoSec: number) => new Date(now - agoSec * 1000).toISOString();

function buildMocks(now: number) {
  const proj = { id: 'p1', name: 'billing-api', team_id: 't1' };
  const base = {
    team_id: 't1', project_id: 'p1', transcript_path: null, host: 'ana-mbp', cwd: '/repo', event_count: 42,
    started_at: iso(now, 7200), ended_at: null, created_at: iso(now, 7200), project: proj,
  };
  const agents: AgentWithProject[] = [
    { ...base, id: 'a1', session_id: 'sess-aaaa1111', name: 'coder-a', role: 'coder', human: 'ana@acme.dev', git_branch: 'feat/ingest',
      status: 'waiting_on_human', attention_kind: 'permission', attention_message: 'Claude needs your permission to run: rm -rf node_modules',
      last_event_name: 'Notification', last_event_summary: 'Notification: permission requested', last_event_at: iso(now, 95), open_request_count: 0 },
    { ...base, id: 'a2', session_id: 'sess-bbbb2222', name: 'coder-b', role: 'coder', human: 'ben@acme.dev', git_branch: 'feat/dashboard',
      status: 'waiting_on_human', attention_kind: 'question', attention_message: null,
      last_event_name: 'PreToolUse', last_event_summary: 'Bash: cc-ask "Which Supabase region?"', last_event_at: iso(now, 40), open_request_count: 2 },
    { ...base, id: 'a3', session_id: 'sess-cccc3333', name: 'designer', role: 'designer', human: 'ana@acme.dev', git_branch: 'main',
      status: 'running', attention_kind: null, attention_message: null,
      last_event_name: 'PostToolUse', last_event_summary: 'Edit components/ui/RequestCard.tsx', last_event_at: iso(now, 8), open_request_count: 0 },
    { ...base, id: 'a4', session_id: 'sess-dddd4444', name: null, role: 'reviewer', human: 'cy@acme.dev', git_branch: 'main',
      status: 'running', attention_kind: null, attention_message: null,
      last_event_name: 'PostToolUse', last_event_summary: 'Read lib/server/status.ts', last_event_at: iso(now, 45 * 60), open_request_count: 0 },
    { ...base, id: 'a5', session_id: 'sess-eeee5555', name: 'docs-bot', role: 'writer', human: null, git_branch: null,
      status: 'idle', attention_kind: null, attention_message: null,
      last_event_name: 'Stop', last_event_summary: 'Stop: finished responding', last_event_at: iso(now, 600), open_request_count: 0 },
    { ...base, id: 'a6', session_id: 'adhoc:ben:host', name: null, role: null, human: 'ben@acme.dev', git_branch: null,
      status: 'ended', attention_kind: null, attention_message: null, ended_at: iso(now, 3000),
      last_event_name: 'SessionEnd', last_event_summary: 'Session ended (logout)', last_event_at: iso(now, 3000), open_request_count: 0 },
  ];
  const mkReq = (o: Partial<RequestWithContext>): RequestWithContext => ({
    id: 'r1', team_id: 't1', project_id: 'p1', agent_id: 'a2', session_id: 'sess-bbbb2222', asked_by: 'coder-b', kind: 'question',
    prompt: 'Which Supabase region should the production project use?', context: 'Needed for .env.example and the README deploy section. EU customers are 40% of signups.',
    options: ['us-east-1', 'eu-west-1'], status: 'open', answer: null, answered_by: null, answered_at: null,
    expires_at: iso(now, -86000), created_at: iso(now, 120),
    agent: { id: 'a2', session_id: 'sess-bbbb2222', name: 'coder-b', role: 'coder', human: 'ben@acme.dev', status: 'waiting_on_human' },
    project: proj, answerer: null, ...o,
  });
  const requests = {
    open: mkReq({}),
    approval: mkReq({ id: 'r2', kind: 'approval', prompt: 'Apply migration 0001_init.sql to the production database?', context: null, options: ['Approve', 'Reject'] }),
    freeText: mkReq({ id: 'r3', kind: 'action', prompt: 'Please create a GitHub OAuth app and paste the client id and secret.\nCallback: https://agentspace.app/auth/callback', options: [], context: null }),
    answered: mkReq({ id: 'r4', status: 'answered', answer: 'eu-west-1', answered_at: iso(now, 30),
      answerer: { id: 'u1', display_name: 'Ana', avatar_url: null } }),
    expired: mkReq({ id: 'r5', status: 'expired', prompt: 'Rename the table events to hook_events?', options: [], context: null }),
  };
  const ev = (id: number, name: string, tool: string | null, summary: string, ago: number): AgentEvent => ({
    id, team_id: 't1', project_id: 'p1', agent_id: 'a3', session_id: 'sess-cccc3333', hook_event_name: name, tool_name: tool,
    summary, payload: { hook_event_name: name, tool_name: tool, tool_input: { command: 'npm test' } }, human: 'ana@acme.dev', created_at: iso(now, ago),
  });
  const events: AgentEvent[] = [
    ev(8, 'Notification', null, 'Claude needs your permission to use Bash', 20),
    ev(7, 'PostToolUse', 'Bash', 'Bash: npm test (exit 0)', 45),
    ev(6, 'PreToolUse', 'Bash', 'Bash: npm test', 60),
    ev(5, 'UserPromptSubmit', null, 'Prompt: build the styleguide page', 200),
    ev(4, 'Stop', null, 'Finished responding', 400),
    ev(3, 'SubagentStop', null, 'Subagent finished', 500),
    ev(2, 'SessionStart', null, 'Session started (startup)', 900),
    ev(1, 'SessionEnd', null, 'Session ended', 1200),
  ];
  const gh = (id: number, type: string, title: string, ago: number, actor = 'anarch'): GithubEvent => ({
    id, team_id: 't1', project_id: 'p1', delivery_id: `d${id}`, event_type: type, action: null, repo_full_name: 'acme/billing-api',
    ref: 'refs/heads/main', actor_login: actor, title, url: 'https://github.com/acme/billing-api', payload: {}, created_at: iso(now, ago),
  });
  const githubEvents = [
    gh(1, 'push', 'anarch pushed 3 commits to main', 300),
    gh(2, 'pull_request', 'PR #12 merged: Add ingest route', 1800, 'benk'),
    gh(3, 'workflow_run', 'Workflow CI failure', 3600, 'github-actions'),
    gh(4, 'issue_comment', 'Comment on #9: Flaky test', 5000, 'cyw'),
  ];
  const project: Project = { id: 'p1', team_id: 't1', name: 'billing-api', description: 'Stripe billing service and invoice pipeline.', repo_full_name: 'acme/billing-api', github_webhook_configured: true, created_by: 'u1', created_at: iso(now, 86400) };
  const tokens: ProjectToken[] = [
    { id: 'k1', team_id: 't1', project_id: 'p1', label: 'ana laptop', token_prefix: 'ags_AbC123xy', created_by: 'u1', created_at: iso(now, 86400 * 3), last_used_at: iso(now, 60), revoked_at: null },
    { id: 'k2', team_id: 't1', project_id: 'p1', label: 'old CI', token_prefix: 'ags_Zq9Lm0pQ', created_by: 'u1', created_at: iso(now, 86400 * 30), last_used_at: null, revoked_at: iso(now, 86400) },
  ];
  const members: TeamMemberWithProfile[] = [
    { team_id: 't1', user_id: 'u1', role: 'owner', joined_at: iso(now, 86400 * 9), profile: { id: 'u1', email: 'ana@acme.dev', display_name: 'Ana Reyes', avatar_url: null, github_login: 'anarch', created_at: iso(now, 86400 * 9) } },
    { team_id: 't1', user_id: 'u2', role: 'member', joined_at: iso(now, 86400 * 2), profile: { id: 'u2', email: 'ben@acme.dev', display_name: 'Ben Kowalski', avatar_url: null, github_login: 'benk', created_at: iso(now, 86400 * 2) } },
  ];
  return { agents, requests, events, githubEvents, project, tokens, members };
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <div className="mb-4 border-b border-line pb-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {note && <p className="text-sm text-fg-muted">{note}</p>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div>
      {label && <p className="label-caps mb-2">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const SWATCHES = ['canvas', 'surface', 'surface-2', 'line', 'fg', 'fg-muted', 'fg-subtle', 'accent', 'running', 'waiting', 'idle', 'ended', 'danger', 'success', 'warning', 'info'];
const SW_CLASS: Record<string, string> = {
  canvas: 'bg-canvas', surface: 'bg-surface', 'surface-2': 'bg-surface-2', line: 'bg-line', fg: 'bg-fg', 'fg-muted': 'bg-fg-muted',
  'fg-subtle': 'bg-fg-subtle', accent: 'bg-accent', running: 'bg-running', waiting: 'bg-waiting', idle: 'bg-idle', ended: 'bg-ended',
  danger: 'bg-danger', success: 'bg-success', warning: 'bg-warning', info: 'bg-info',
};

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'overview' },
  { href: '/inbox', label: 'Inbox', icon: 'inbox', badge: 3 },
  { href: '/projects', label: 'Projects', icon: 'projects' },
  { href: '/team', label: 'Team', icon: 'team' },
];

export default function StyleguidePage() {
  const [now, setNow] = useState<number | null>(null);
  const [seg, setSeg] = useState('active');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  useEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
  }, [theme]);

  if (now === null) return <div className="min-h-screen bg-canvas" />;
  const m = buildMocks(now);
  const counts = (c: Partial<Record<AgentStatus, number>>) => ({ running: 0, waiting_on_human: 0, idle: 0, ended: 0, ...c });
  const noop = () => undefined;

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 text-fg md:px-10">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Agentspace styleguide"
          description="Every component, every state. Bone-and-ink surfaces with a single amber signal reserved for “a human is needed”."
          actions={
            <SegmentedControl
              size="sm"
              value={theme}
              onChange={(v) => setTheme(v as typeof theme)}
              options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            />
          }
        />

        <Section title="Tokens" note="Status is encoded by color and shape: circle running, triangle needs you, ring idle, square ended.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {SWATCHES.map((s) => (
              <div key={s} className="overflow-hidden rounded border border-line">
                <div className={`h-10 ${SW_CLASS[s]}`} />
                <p className="bg-surface px-2 py-1 font-mono text-[11px] text-fg-muted">{s}</p>
              </div>
            ))}
          </div>
          <Row label="Status dots (pulse / stale / no pulse)">
            {AGENT_STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 text-sm">
                <StatusDot status={s} /> <StatusDot status={s} stale /> <StatusDot status={s} pulse={false} />
              </span>
            ))}
          </Row>
          <Row label="Status badges">
            {AGENT_STATUSES.map((s) => <StatusBadge key={s} status={s} />)}
            <StatusBadge status="running" stale />
          </Row>
        </Section>

        <Section title="Primitives">
          <Row label="Button variants / sizes / states">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" size="sm"><Plus className="h-3.5 w-3.5" />Small</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </Row>
          <Row label="Badges">
            {(['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const).map((t) => <Badge key={t} tone={t}>{t}</Badge>)}
          </Row>
          <Row label="Spinner / Avatar / RelativeTime">
            <Spinner size="sm" /><Spinner />
            <Avatar name="Ana Reyes" size="xs" /><Avatar name="Ben Kowalski" /><Avatar name="cy@acme.dev" size="md" />
            <RelativeTime iso={iso(now, 340)} prefix="updated" className="font-mono text-xs text-fg-muted" />
          </Row>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Project name" placeholder="billing-api" hint="Shown across the dashboard." />
            <Input label="Repository" defaultValue="not a repo" error="Use the owner/repo format." />
            <Select label="Team" options={[{ value: 'a', label: "Ana's team" }, { value: 'b', label: 'Acme' }]} />
            <Textarea label="Notes" placeholder="Anything the team should know" />
          </div>
          <Row label="SegmentedControl">
            <SegmentedControl value={seg} onChange={setSeg} options={[{ value: 'active', label: 'Active', count: 4 }, { value: 'needs', label: 'Needs you', count: 2 }, { value: 'all', label: 'All' }]} />
          </Row>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Running" value={4} tone="running" hint="across 3 projects" />
            <StatTile label="Needs you" value={2} tone="waiting" hint="oldest 4m ago" />
            <StatTile label="Idle" value={1} tone="idle" />
            <StatTile label="Open requests" value={0} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Callout tone="info" title="Heads up">Informational message with detail.</Callout>
            <Callout tone="success" title="Connected">First event received from coder-a.</Callout>
            <Callout tone="warning" title="Shown once" action={<Button size="sm">Copy</Button>}>Copy this token now. You will not see it again.</Callout>
            <Callout tone="danger" title="Webhook failed">Signature did not match.</Callout>
          </div>
          <Card title="Card" description="With header actions" actions={<Button size="sm" variant="secondary">Action</Button>}>Body content.</Card>
          <EmptyState icon={<Inbox />} title="Nothing waiting on you" description="When an agent asks for help it lands here." action={<Button variant="primary">Connect a project</Button>} />
          <div className="grid gap-4 md:grid-cols-2">
            <CopyField label="Session id" value="sess-cccc3333-aaaa-bbbb" />
            <CopyField label="Token" value="ags_AbC123xyzSecretValue" secret />
          </div>
          <CodeBlock title="install" language="bash" code={'curl -fsSL https://agentspace.app/api/connector/hook.mjs -o .claude/agentspace/hook.mjs\nnode .claude/agentspace/hook.mjs --check'} />
        </Section>

        <Section title="Requests" note="The inbox is the product. Open requests carry an amber edge and glow.">
          <div className="grid gap-4 lg:grid-cols-2">
            <RequestCard request={m.requests.open} onAnswer={noop} onDismiss={noop} agentHref="/agents/a2" />
            <RequestCard request={m.requests.approval} onAnswer={noop} onDismiss={noop} />
            <RequestCard request={m.requests.freeText} onAnswer={noop} busy />
            <RequestCard request={m.requests.freeText} onAnswer={noop} error="Request already answered by someone else." />
            <RequestCard request={m.requests.answered} />
            <RequestCard request={m.requests.expired} />
          </div>
          <Row label="Compact (overview rail)">
            <div className="w-full max-w-sm"><RequestCard request={m.requests.open} compact /></div>
          </Row>
        </Section>

        <Section title="Agents">
          <AgentGroup title="billing-api" subtitle="acme/billing-api" count={m.agents.length} href="/projects/p1">
            {m.agents.map((a) => <AgentCard key={a.id} agent={a} href={`/agents/${a.id}`} showProject />)}
          </AgentGroup>
          <Row label="AttentionCard (needs a human in the terminal)">
            <div className="grid w-full gap-3 md:grid-cols-2">
              <AttentionCard agent={m.agents[0]} href="/agents/a1" />
              <AttentionCard agent={{ ...m.agents[1], attention_kind: 'input', attention_message: 'Claude is waiting for your input' }} href="/agents/a2" />
            </div>
          </Row>
        </Section>

        <Section title="Timeline & GitHub">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <EventTimeline events={m.events} hasMore onLoadOlder={noop} />
            <Card title="GitHub activity" padded={false}>
              <div className="divide-y divide-line px-4">
                {m.githubEvents.map((e) => <GithubEventItem key={e.id} event={e} />)}
              </div>
            </Card>
          </div>
          <EventTimeline events={[]} emptyLabel="No events match this filter." />
        </Section>

        <Section title="Projects, tokens, members">
          <div className="grid gap-4 md:grid-cols-3">
            <ProjectCard project={m.project} counts={counts({ running: 3, waiting_on_human: 1, idle: 1 })} openRequests={2} href="/projects/p1" />
            <ProjectCard project={{ ...m.project, id: 'p2', name: 'marketing-site', repo_full_name: null, description: null }} counts={counts({ idle: 2, ended: 5 })} href="/projects/p2" />
          </div>
          <Card padded={false}>
            <div className="divide-y divide-line px-4">
              {m.tokens.map((t) => <TokenRow key={t.id} token={t} onRevoke={noop} />)}
              <TokenRow token={m.tokens[0]} onRevoke={noop} busy />
            </div>
          </Card>
          <Card padded={false}>
            <div className="divide-y divide-line px-4">
              <MemberRow member={m.members[0]} isYou />
              <MemberRow member={m.members[1]} onRemove={noop} />
            </div>
          </Card>
        </Section>

        <Section title="Login">
          <div className="flex flex-wrap gap-6">
            <LoginCard onGithubLogin={noop} />
            <LoginCard onGithubLogin={noop} loading error="Authentication failed. Try again." />
          </div>
        </Section>

        <Section title="Enterprise additions" note="KPI cards, tabs, tables, skeletons, error states, breadcrumbs, avatar stacks.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active agents" value={12} tone="running" icon={<Activity />} delta={3} deltaLabel="vs last hour" spark={[3, 5, 4, 7, 6, 9, 12]} />
            <StatCard label="Waiting on human" value={2} tone="waiting" icon={<Radio />} hint="oldest 4m" />
            <StatCard label="Events / hour" value="1,284" tone="idle" icon={<Timer />} delta={-8} deltaLabel="vs yesterday" spark={[9, 8, 9, 6, 7, 5, 6]} />
            <StatCard label="Open PRs" value={5} icon={<GitPullRequest />} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Loading" value={0} loading /></div>
          <Tabs value={seg} onChange={setSeg} tabs={[{ value: 'active', label: 'Agents', count: 6 }, { value: 'needs', label: 'Requests', count: 2, attention: true }, { value: 'all', label: 'Activity' }]} />
          <Breadcrumbs items={[{ href: '/projects', label: 'Projects' }, { href: '/projects/p1', label: 'billing-api' }, { label: 'coder-a' }]} />
          <Row label="CommandPaletteTrigger / AvatarStack">
            <CommandPaletteTrigger />
            <AvatarStack people={[{ name: 'Ana Reyes' }, { name: 'Ben Kowalski' }, { name: 'Cy Wu' }, { name: 'Di Park' }, { name: 'Ed Moss' }, { name: 'Fay Lin' }]} max={4} />
          </Row>
          <DataTable
            caption="Agents"
            rows={m.agents}
            rowKey={(a) => a.id}
            rowHref={(a) => `/agents/${a.id}`}
            columns={[
              { key: 'name', header: 'Agent', cell: (a) => <span className="font-medium">{a.name ?? a.session_id.slice(0, 8)}</span> },
              { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} /> },
              { key: 'human', header: 'Human', hideOnMobile: true, cell: (a) => a.human ?? '-' },
              { key: 'events', header: 'Events', align: 'right', mono: true, cell: (a) => a.event_count },
              { key: 'last', header: 'Last seen', align: 'right', mono: true, cell: (a) => <RelativeTime iso={a.last_event_at} /> },
            ]}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DataTable rows={[] as typeof m.agents} rowKey={(a) => a.id} columns={[]} emptyTitle="No agents yet" emptyDescription="Connect a project to see agents." />
            <DataTable rows={[] as typeof m.agents} rowKey={(a) => a.id} columns={[]} loading />
            <DataTable rows={[] as typeof m.agents} rowKey={(a) => a.id} columns={[]} error="Could not load agents." onRetry={noop} />
            <ErrorState title="Realtime disconnected" description="Reconnecting automatically." onRetry={noop} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <AgentCardSkeleton /><AgentCardSkeleton /><RequestCardSkeleton />
          </div>
          <Skeleton className="h-4 w-48" />
        </Section>

        <Section title="App shell" note="Collapsible sidebar with workspace switcher, projects, Inbox badge; top bar with breadcrumbs, command palette trigger, user menu. Drawer on phones.">
          <div className="h-[34rem] overflow-hidden rounded-md border border-line">
            <AppShell
              contained={false}
              nav={NAV}
              activeHref="/inbox"
              user={{ name: 'Ana Reyes', email: 'ana@acme.dev' }}
              workspace={{ id: 'w1', name: "Ana's team" }}
              workspaces={[{ id: 'w1', name: "Ana's team" }, { id: 'w2', name: 'Acme' }]}
              projects={[{ href: '/projects/p1', label: 'billing-api', attention: 2 }, { href: '/projects/p2', label: 'marketing-site', running: 3 }, { href: '/projects/p3', label: 'infra' }]}
              breadcrumb={[{ href: '/', label: 'Overview' }, { label: 'Inbox' }]}
              onOpenPalette={noop}
              userMenu={<Button size="sm" variant="secondary" className="w-full">Sign out</Button>}
            >
              <PageHeader title="Inbox" description="Agents waiting on you." />
              <RequestCard request={m.requests.open} onAnswer={noop} />
            </AppShell>
          </div>
        </Section>
      </div>
    </div>
  );
}
