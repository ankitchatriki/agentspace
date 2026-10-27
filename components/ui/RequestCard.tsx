'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, Send } from 'lucide-react';
import type { RequestWithContext } from '@/lib/types';
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, agentDisplayName } from '@/lib/types';
import { cn } from './cn';
import { Badge } from './Badge';
import { Button } from './Button';
import { RelativeTime } from './RelativeTime';
import { Textarea } from './fields';

const statusTone = { open: 'warning', answered: 'success', cancelled: 'neutral', expired: 'neutral' } as const;

function approvalTone(opt: string): 'primary' | 'danger' | 'secondary' {
  if (/^(approve|yes|allow|accept)/i.test(opt)) return 'primary';
  if (/^(reject|no|deny|decline)/i.test(opt)) return 'danger';
  return 'secondary';
}

export function RequestCard({
  request,
  onAnswer,
  onDismiss,
  busy = false,
  error = null,
  compact = false,
  agentHref,
}: {
  request: RequestWithContext;
  onAnswer?: (answer: string) => void | Promise<void>;
  onDismiss?: () => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
  compact?: boolean;
  agentHref?: string;
}) {
  const [text, setText] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  const open = request.status === 'open';
  const agentName = request.agent ? agentDisplayName(request.agent) : (request.asked_by ?? 'Unknown agent');
  const meta = [request.project?.name, request.agent?.human, request.asked_by && request.asked_by !== agentName ? `via ${request.asked_by}` : null]
    .filter(Boolean)
    .join(' · ');
  const answererName = request.answerer?.display_name ?? null;

  function send() {
    const v = text.trim();
    if (!v || busy) return;
    void onAnswer?.(v);
  }

  const shell = cn(
    'relative overflow-hidden rounded-md border bg-surface before:absolute before:inset-y-0 before:left-0 before:w-1',
    open ? 'border-waiting/70 shadow-signal before:bg-waiting' : 'border-line before:bg-ended',
  );

  if (compact) {
    return (
      <div id={`req-${request.id}`} className={cn(shell, 'p-3 pl-4')}>
        <div className="flex items-center justify-between gap-2">
          <Badge tone={open ? 'warning' : 'neutral'}>{REQUEST_KIND_LABEL[request.kind]}</Badge>
          <RelativeTime iso={request.created_at} className="font-mono text-[11px] text-fg-subtle" />
        </div>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-fg">{request.prompt}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-fg-muted">{agentName}</p>
          <Link
            href={`/inbox#req-${request.id}`}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-waiting hover:underline"
          >
            Answer <ArrowRight aria-hidden className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article id={`req-${request.id}`} className={cn(shell, 'scroll-mt-20 p-4 pl-5')} aria-label={`Request from ${agentName}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={open ? 'warning' : 'neutral'}>{REQUEST_KIND_LABEL[request.kind]}</Badge>
          {!open && <Badge tone={statusTone[request.status]}>{REQUEST_STATUS_LABEL[request.status]}</Badge>}
          {agentHref ? (
            <Link href={agentHref} className="text-sm font-semibold text-fg hover:underline">
              {agentName}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-fg">{agentName}</span>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-fg-subtle">
          <RelativeTime iso={request.created_at} prefix="asked" />
          {open && <RelativeTime iso={request.expires_at} prefix="expires" />}
        </div>
      </header>
      {meta && <p className="mt-1 text-xs text-fg-muted">{meta}</p>}

      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-relaxed text-fg">{request.prompt}</p>

      {request.context && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCtx((s) => !s)}
            aria-expanded={showCtx}
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-fg-subtle hover:text-fg"
          >
            <ChevronDown aria-hidden className={cn('h-3 w-3 transition-transform', showCtx && 'rotate-180')} />
            Context
          </button>
          {showCtx && (
            <p className="mt-1.5 whitespace-pre-wrap rounded-sm border border-line bg-canvas p-3 font-mono text-xs leading-relaxed text-fg-muted">
              {request.context}
            </p>
          )}
        </div>
      )}

      {open ? (
        <div className="mt-4 flex flex-col gap-3">
          {request.options.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick answers">
              {request.options.map((opt) => (
                <Button
                  key={opt}
                  size="md"
                  variant={request.kind === 'approval' ? approvalTone(opt) : 'secondary'}
                  disabled={busy || !onAnswer}
                  onClick={() => void onAnswer?.(opt)}
                  className={cn(request.kind === 'approval' && approvalTone(opt) === 'primary' && 'bg-success border-success text-canvas hover:bg-success/90')}
                >
                  {opt}
                </Button>
              ))}
            </div>
          )}
          <Textarea
            aria-label="Your answer"
            placeholder={request.options.length ? 'Or type a different answer…' : 'Type your answer…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy || !onAnswer}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            error={error}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="hidden font-mono text-[11px] text-fg-subtle sm:inline">Ctrl/Cmd + Enter to send</span>
            <div className="ml-auto flex items-center gap-2">
              {onDismiss && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void onDismiss()}>
                  Dismiss
                </Button>
              )}
              <Button variant="primary" loading={busy} disabled={!text.trim() || !onAnswer} onClick={send}>
                <Send aria-hidden className="h-3.5 w-3.5" />
                Send answer
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-sm border border-line bg-canvas p-3">
          <p className="label-caps mb-1">
            {request.status === 'answered' ? `Answer${answererName ? ` · ${answererName}` : ''}` : REQUEST_STATUS_LABEL[request.status]}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm text-fg">
            {request.answer ?? <span className="text-fg-subtle">No answer recorded.</span>}
          </p>
          {request.answered_at && <RelativeTime iso={request.answered_at} className="mt-1 block font-mono text-[11px] text-fg-subtle" />}
        </div>
      )}
    </article>
  );
}
