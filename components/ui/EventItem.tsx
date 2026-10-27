'use client';

import { useState } from 'react';
import {
  Bell, ChevronRight, CircleStop, Hammer, MessageSquare, Play, Power, Users, Wrench, Zap,
} from 'lucide-react';
import type { AgentEvent } from '@/lib/types';
import { cn } from './cn';
import { CodeBlock } from './CodeBlock';
import { RelativeTime } from './RelativeTime';

const ICONS: Record<string, { Icon: typeof Play; tone: string }> = {
  SessionStart: { Icon: Play, tone: 'text-running' },
  UserPromptSubmit: { Icon: MessageSquare, tone: 'text-info' },
  PreToolUse: { Icon: Hammer, tone: 'text-fg-muted' },
  PostToolUse: { Icon: Wrench, tone: 'text-fg-subtle' },
  Notification: { Icon: Bell, tone: 'text-waiting' },
  Stop: { Icon: CircleStop, tone: 'text-idle' },
  SubagentStop: { Icon: Users, tone: 'text-idle' },
  SessionEnd: { Icon: Power, tone: 'text-ended' },
};

export function EventItem({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const meta = ICONS[event.hook_event_name] ?? { Icon: Zap, tone: 'text-fg-subtle' };
  const attention = event.hook_event_name === 'Notification';
  return (
    <li className="relative pl-9">
      <span
        aria-hidden
        className={cn(
          'absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-sm border bg-surface',
          attention ? 'border-waiting/70' : 'border-line',
        )}
      >
        <meta.Icon className={cn('h-3.5 w-3.5', meta.tone)} />
      </span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-2',
          attention && 'bg-waiting/5',
        )}
      >
        <ChevronRight aria-hidden className={cn('mt-1 h-3 w-3 shrink-0 text-fg-subtle transition-transform', open && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-xs font-semibold text-fg">{event.hook_event_name}</span>
            {event.tool_name && <span className="font-mono text-xs text-fg-muted">{event.tool_name}</span>}
          </div>
          {event.summary && <p className="mt-0.5 break-words text-sm text-fg-muted">{event.summary}</p>}
        </div>
        <RelativeTime iso={event.created_at} className="shrink-0 pt-0.5 font-mono text-[11px] text-fg-subtle" />
      </button>
      {open && (
        <div className="mb-2 ml-7 mt-1">
          <CodeBlock code={JSON.stringify(event.payload, null, 2)} language="json" title={`event #${event.id}`} />
        </div>
      )}
    </li>
  );
}
