'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AttentionCard, Callout, Card, EmptyState, PageHeader, RequestCard } from '@/components/ui';
import { useAgents } from '@/lib/hooks/useAgents';
import { useOpenRequests, useRequests } from '@/lib/hooks/useRequests';
import { needsTerminalAttention } from '@/lib/types';
import { Loading } from '../_components/Loading';
import { useRequestActions } from '../_components/useRequestActions';

export default function InboxPage() {
  const { requests, loading, error } = useOpenRequests();
  const { agents } = useAgents();
  const { requests: resolved, loading: resolvedLoading } = useRequests({ resolvedOnly: true, limit: 20 });
  const [showResolved, setShowResolved] = useState(false);
  const actions = useRequestActions();
  const attention = agents.filter(needsTerminalAttention);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Requests from agents waiting for a human. Answers go straight back to the agent."
      />

      {error ? (
        <Callout tone="danger" title="Could not load requests">{error}</Callout>
      ) : loading ? (
        <Loading label="Loading requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          title="Inbox zero"
          description="No agent is waiting on you. New requests appear here the moment they are asked."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
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
