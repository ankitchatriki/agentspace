import type { AgentStatus } from '@/lib/types';
import { AGENT_STATUS_LABEL } from '@/lib/types';
import { cn } from './cn';
import { StatusGlyph } from './StatusDot';

const styles: Record<AgentStatus, string> = {
  running: 'border-running/40 bg-running/10 text-running',
  waiting_on_human: 'border-waiting bg-waiting text-canvas',
  idle: 'border-idle/40 bg-idle/10 text-idle',
  ended: 'border-ended/40 bg-ended/10 text-ended',
};

export function StatusBadge({ status, stale = false }: { status: AgentStatus; stale?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-wider',
        styles[status],
        stale && 'opacity-70',
      )}
    >
      <StatusGlyph status={status} size={9} />
      {AGENT_STATUS_LABEL[status]}
      {stale && <span className="font-normal normal-case tracking-normal opacity-80">· quiet</span>}
    </span>
  );
}
