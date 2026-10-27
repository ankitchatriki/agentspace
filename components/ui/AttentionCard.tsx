import Link from 'next/link';
import { FileLock2, MessageSquareMore, ShieldQuestion, TerminalSquare } from 'lucide-react';
import type { AgentWithProject, AttentionKind } from '@/lib/types';
import { agentDisplayName } from '@/lib/types';
import { RelativeTime } from './RelativeTime';

const KIND: Record<AttentionKind, { Icon: typeof FileLock2; label: string }> = {
  permission: { Icon: FileLock2, label: 'Permission needed' },
  input: { Icon: MessageSquareMore, label: 'Input needed' },
  question: { Icon: ShieldQuestion, label: 'Question' },
};

export function AttentionCard({ agent, href }: { agent: AgentWithProject; href: string }) {
  const k = agent.attention_kind ? KIND[agent.attention_kind] : { Icon: MessageSquareMore, label: 'Needs you' };
  return (
    <Link
      href={href}
      className="relative flex gap-3 overflow-hidden rounded-md border border-waiting/70 bg-waiting/5 p-3.5 pl-4 shadow-signal transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-waiting hover:bg-waiting/10"
    >
      <k.Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-waiting" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-sm font-semibold text-fg">
            {agentDisplayName(agent)} <span className="font-normal text-fg-muted">· {k.label}</span>
          </p>
          <RelativeTime iso={agent.last_event_at} className="font-mono text-[11px] text-fg-subtle" />
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          {[agent.project?.name, agent.human].filter(Boolean).join(' · ')}
        </p>
        {agent.attention_message && <p className="mt-2 text-sm text-fg">{agent.attention_message}</p>}
        <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-waiting">
          <TerminalSquare aria-hidden className="h-3.5 w-3.5" />
          Respond in the terminal
        </p>
      </div>
    </Link>
  );
}
