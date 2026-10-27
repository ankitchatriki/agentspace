import Link from 'next/link';
import { FolderGit2, User } from 'lucide-react';
import type { AgentWithProject } from '@/lib/types';
import { agentDisplayName, isStale } from '@/lib/types';
import { cn } from './cn';
import { Badge } from './Badge';
import { RelativeTime } from './RelativeTime';
import { StatusDot } from './StatusDot';

const rail = {
  running: 'before:bg-running',
  waiting_on_human: 'before:bg-waiting',
  idle: 'before:bg-idle',
  ended: 'before:bg-ended',
} as const;

export function AgentCard({
  agent,
  href,
  showProject = false,
}: {
  agent: AgentWithProject;
  href: string;
  showProject?: boolean;
}) {
  const stale = isStale(agent);
  const waiting = agent.status === 'waiting_on_human';
  const quietMin = Math.max(1, Math.round((Date.now() - new Date(agent.last_event_at).getTime()) / 60000));
  return (
    <Link
      href={href}
      className={cn(
        'relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-md border bg-surface p-3.5 pl-4 transition-colors',
        'before:absolute before:inset-y-0 before:left-0 before:w-1',
        rail[agent.status],
        waiting ? 'border-waiting/70 bg-waiting/5 shadow-signal' : 'border-line hover:border-fg-subtle',
        agent.status === 'ended' && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot status={agent.status} stale={stale} />
          <h3 className="truncate text-sm font-semibold text-fg">{agentDisplayName(agent)}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {agent.open_request_count > 0 && (
            <span
              aria-label={`${agent.open_request_count} open requests`}
              className="rounded-sm bg-waiting px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-canvas"
            >
              {agent.open_request_count} ASK
            </span>
          )}
          {agent.role && <Badge>{agent.role}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
        {agent.human && (
          <span className="inline-flex items-center gap-1">
            <User aria-hidden className="h-3 w-3" />
            {agent.human}
          </span>
        )}
        {showProject && agent.project && (
          <span className="inline-flex items-center gap-1">
            <FolderGit2 aria-hidden className="h-3 w-3" />
            {agent.project.name}
          </span>
        )}
        {agent.git_branch && <span className="font-mono text-fg-subtle">{agent.git_branch}</span>}
      </div>

      {agent.attention_message && (
        <p className="line-clamp-2 rounded-sm border border-waiting/40 bg-waiting/10 px-2 py-1.5 text-xs font-medium text-waiting">
          {agent.attention_message}
        </p>
      )}

      <p className="truncate font-mono text-xs text-fg-subtle" title={agent.last_event_summary ?? undefined}>
        {agent.last_event_summary ?? 'No activity yet'}
      </p>

      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-fg-subtle">
        <RelativeTime iso={agent.last_event_at} />
        {stale && <span className="rounded-sm bg-surface-2 px-1.5 py-0.5">quiet {quietMin}m</span>}
      </div>
    </Link>
  );
}
