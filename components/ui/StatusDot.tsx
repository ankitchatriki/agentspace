import type { AgentStatus } from '@/lib/types';
import { AGENT_STATUS_LABEL } from '@/lib/types';
import { cn } from './cn';

export const STATUS_TEXT: Record<AgentStatus, string> = {
  running: 'text-running',
  waiting_on_human: 'text-waiting',
  idle: 'text-idle',
  ended: 'text-ended',
};

/** Shape-coded glyph: circle = running, triangle = needs you, ring = idle, square = ended. */
export function StatusGlyph({
  status,
  size = 12,
  className,
}: {
  status: AgentStatus;
  size?: number;
  className?: string;
}) {
  const common = { width: size, height: size, viewBox: '0 0 12 12', 'aria-hidden': true as const, className: cn('shrink-0', className) };
  switch (status) {
    case 'running':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.5" fill="currentColor" />
        </svg>
      );
    case 'waiting_on_human':
      return (
        <svg {...common}>
          <path d="M6 0.8 11.4 10.6H0.6Z" fill="currentColor" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
        </svg>
      );
    case 'idle':
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case 'ended':
      return (
        <svg {...common}>
          <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="0.8" fill="currentColor" opacity="0.8" />
        </svg>
      );
  }
}

export function StatusDot({
  status,
  pulse,
  stale = false,
}: {
  status: AgentStatus;
  pulse?: boolean;
  stale?: boolean;
}) {
  const doPulse = (pulse ?? (status === 'running' || status === 'waiting_on_human')) && !stale;
  const label = AGENT_STATUS_LABEL[status] + (stale ? ' (quiet)' : '');
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-flex h-3 w-3 shrink-0 items-center justify-center', STATUS_TEXT[status], stale && 'opacity-50')}
    >
      {doPulse && status === 'running' && (
        <span aria-hidden className="absolute inset-0 m-auto h-2.5 w-2.5 animate-ring-out rounded-full bg-current" />
      )}
      {doPulse && status === 'waiting_on_human' && (
        <span aria-hidden className="absolute inset-[-3px] animate-beacon rounded-full bg-current opacity-25" />
      )}
      <StatusGlyph status={status} size={status === 'waiting_on_human' ? 13 : 12} className="relative" />
    </span>
  );
}
