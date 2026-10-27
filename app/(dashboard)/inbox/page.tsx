'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AttentionCard, Callout, Card, EmptyState, PageHeader, RequestCard } from '@/components/ui';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOpenRequests, useRequests } from '@/lib/hooks/useRequests';
import { needsTerminalAttention } from '@/lib/types';
import { Loading } from '../_components/Loading';
import { SkeletonCards } from '../_components/Skeleton';
import { useRequestActions } from '../_components/useRequestActions';

export default function InboxPage() {
  const { requests, loading, error } = useOpenRequests();
  const { agents } = useAgents();
  const { requests: resolved, loading: resolvedLoading } = useRequests({ resolvedOnly: true, limit: 20 });
  const [showResolved, setShowResolved] = useState(false);
  const actions = useRequestActions();
  const attention = agents.filter(needsTerminalAttention);
  const visible = requests.filter((r) => !actions.hidden.has(r.id));

  // Shortcut: press "r" (outside inputs) to focus the first answer box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'r') return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const box = document.querySelector<HTMLTextAreaElement>('[id^="req-"] textarea');
      if (box) {
        e.preventDefault();
        box.focus();
        box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Requests from agents waiting for a human. Press R to jump to the first answer box."
      />

      {error ? (
        <Callout tone="danger" title="Could not load requests">{error}</Callout>
      ) : loading ? (
        <SkeletonCards count={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="Inbox zero"
          description="No agent is waiting on you. New requests appear here the moment they are asked."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <div key={r.id} id={`req-${r.id}`} className="scroll-mt-20">
              <RequestCard
                request={r}
                agentHref={r.agent ? `/agents/${r.agent.id}` : undefined}
                busy={actions.busy[r.id]}
                error={actions.errors[r.id]}
                onAnswer={(text) => actions.answer(r.id, text)}
                onDismiss={() => actions.dismiss(r.id)}
              />
            </div>
          ))}
        </div>
      )}

      {attention.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-fg">Needs attention in terminal</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {attention.map((a) => (
              <AttentionCard key={a.id} agent={a} href={`/agents/${a.id}`} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="text-sm font-semibold text-fg hover:text-accent"
          aria-expanded={showResolved}
        >
          {showResolved ? '▾' : '▸'} Recently resolved
        </button>
        {showResolved &&
          (resolvedLoading ? (
            <Loading />
          ) : resolved.length === 0 ? (
            <Card>
              <p className="text-sm text-fg-muted">Nothing resolved yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {resolved.map((r) => (
                <div key={r.id} id={`req-${r.id}`}>
                  <RequestCard request={r} agentHref={r.agent ? `/agents/${r.agent.id}` : undefined} />
                </div>
              ))}
            </div>
          ))}
      </section>
      <p className="text-xs text-fg-subtle">
        Agents ask with <span className="font-mono">cc-ask.mjs</span>. <Link href="/projects" className="text-accent hover:underline">Connect a project</Link> to start.
      </p>
    </div>
  );
}
