'use client';
import Link from 'next/link';
import { Badge, RelativeTime, StatusBadge, StatusDot } from '@/components/ui';
import { agentDisplayName, isStale, type AgentWithProject } from '@/lib/types';

export function AgentsTable({ agents }: { agents: AgentWithProject[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wide text-fg-subtle">
            <th className="px-4 py-2.5 font-medium">Agent</th>
            <th className="px-4 py-2.5 font-medium">Project</th>
            <th className="px-4 py-2.5 font-medium">Teammate</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Last activity</th>
            <th className="px-4 py-2.5 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {agents.map((a) => {
            const stale = isStale(a);
            return (
              <tr key={a.id} className="group hover:bg-surface-2">
                <td className="px-4 py-2.5">
                  <Link href={`/agents/${a.id}`} className="flex items-center gap-2 font-medium text-fg">
                    <StatusDot status={a.status} stale={stale} />
                    <span className="truncate">{agentDisplayName(a)}</span>
                    {a.role && <Badge>{a.role}</Badge>}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg-muted">
                  {a.project ? (
                    <Link href={`/projects/${a.project.id}`} className="hover:text-accent">
                      {a.project.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{a.human ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.status} stale={stale} />
                    {a.open_request_count > 0 && <Badge tone="warning">{a.open_request_count} open</Badge>}
                  </div>
                </td>
                <td className="max-w-xs px-4 py-2.5">
                  {a.attention_message ? (
                    <span className="block truncate text-waiting">{a.attention_message}</span>
                  ) : (
                    <span className="block truncate font-mono text-xs text-fg-muted">{a.last_event_summary ?? '—'}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-fg-subtle">
                  <RelativeTime iso={a.last_event_at} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
