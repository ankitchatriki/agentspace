import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import type { AgentStatus, Project } from '@/lib/types';
import { AGENT_STATUSES, AGENT_STATUS_LABEL } from '@/lib/types';
import { cn } from './cn';
import { StatusGlyph, STATUS_TEXT } from './StatusDot';

export function ProjectCard({
  project,
  counts,
  href,
  openRequests = 0,
}: {
  project: Project;
  counts: Record<AgentStatus, number>;
  href: string;
  openRequests?: number;
}) {
  const hot = openRequests > 0 || counts.waiting_on_human > 0;
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-surface p-4 transition-colors',
        hot ? 'border-waiting/70 shadow-signal' : 'border-line hover:border-fg-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-base font-semibold tracking-tight text-fg">{project.name}</h3>
        {openRequests > 0 && (
          <span className="shrink-0 rounded-sm bg-waiting px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none text-canvas">
            {openRequests} OPEN
          </span>
        )}
      </div>
      {project.repo_full_name && (
        <p className="inline-flex items-center gap-1 truncate font-mono text-xs text-fg-muted">
          <GitBranch aria-hidden className="h-3 w-3 shrink-0" />
          {project.repo_full_name}
        </p>
      )}
      {project.description && <p className="line-clamp-2 text-sm text-fg-muted">{project.description}</p>}
      <ul className="mt-auto grid grid-cols-4 gap-1 border-t border-line pt-3">
        {AGENT_STATUSES.map((s) => (
          <li key={s} className={cn('flex flex-col', counts[s] === 0 && 'opacity-40')} aria-label={`${counts[s]} ${AGENT_STATUS_LABEL[s]}`}>
            <span className={cn('flex items-center gap-1 font-mono text-lg font-semibold tabular-nums', STATUS_TEXT[s])}>
              <StatusGlyph status={s} size={9} />
              {counts[s]}
            </span>
            <span className="label-caps text-[10px]">{AGENT_STATUS_LABEL[s]}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
