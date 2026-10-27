'use client';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Callout, Card, PageHeader } from '@/components/ui';
import * as api from '@/lib/client/api';

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await api.joinTeam(code);
      router.push('/team');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join team');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title="Join a team" description="You were invited to share agents, projects and requests with a team." />
      <Card>
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Invite code: <span className="font-mono text-fg">{code}</span>
          </p>
          {error && <Callout tone="danger" title="Could not join">{error}</Callout>}
          <Button onClick={join} loading={busy}>
            Join team
          </Button>
        </div>
      </Card>
    </div>
  );
}
