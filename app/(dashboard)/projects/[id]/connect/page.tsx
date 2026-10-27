'use client';
import { use, useEffect, useMemo, useState } from 'react';
import { Button, Callout, Card, CodeBlock, CopyField, Input, PageHeader } from '@/components/ui';
import { useProjects } from '@/lib/hooks/useProjects';
import { useAgents } from '@/lib/hooks/useAgents';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { buildInstallCommands } from '@/lib/client/connect';
import * as api from '@/lib/client/api';
import { Loading } from '../../../_components/Loading';

export default function ConnectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { byId, loading } = useProjects();
  const project = byId[id];
  const { profile } = useCurrentUser();
  const { agents } = useAgents({ projectId: id });

  const [label, setLabel] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [tokenCreatedAt, setTokenCreatedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [snippetError, setSnippetError] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  useEffect(() => {
    setAppUrl(window.location.origin);
  }, []);
  useEffect(() => {
    if (!label && profile?.display_name) setLabel(profile.display_name);
  }, [profile, label]);
  useEffect(() => {
    fetch('/api/connector/settings.snippet.json')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('bad'))))
      .then(setSnippet)
      .catch(() => setSnippetError(true));
  }, []);

  const commands = useMemo(() => (token && appUrl ? buildInstallCommands(appUrl, token) : ''), [token, appUrl]);
  // Only events after this token was created count, so existing agents from teammates don't fake success.
  const connected =
    tokenCreatedAt !== null && agents.some((a) => new Date(a.last_event_at).getTime() >= tokenCreatedAt);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createToken(id, label.trim() || undefined);
      setToken(res.token);
      setTokenCreatedAt(new Date(res.token_meta.created_at).getTime());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create token');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!project) return <Callout tone="danger" title="Project not found" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        breadcrumb={[
          { href: '/projects', label: 'Projects' },
          { href: `/projects/${id}`, label: project.name },
        ]}
        title="Connect Claude Code"
        description={`Send ${project.name} agent activity to Agentspace.`}
      />

      <Card title="1. Create a token" description="Each teammate creates their own token.">
        <div className="space-y-4">
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} disabled={!!token} />
          {!token && (
            <Button onClick={create} loading={busy}>
              Create token
            </Button>
          )}
          {error && <Callout tone="danger">{error}</Callout>}
          {token && (
            <div className="space-y-3">
              <CopyField value={token} secret mono label="Token" />
              <Callout tone="warning" title="Shown once">
                Copy it now. Only a hash is stored, so it cannot be displayed again.
              </Callout>
            </div>
          )}
        </div>
      </Card>

      <Card title="2. Install the connector" description="Run in the root of the repo Claude Code works in.">
        {token ? (
          <CodeBlock code={commands} language="bash" />
        ) : (
          <p className="text-sm text-fg-muted">Create a token to see the commands.</p>
        )}
      </Card>

      <Card title="3. Add hooks to .claude/settings.json" description="Merge this into your settings, then restart Claude Code.">
        {snippet ? (
          <CodeBlock code={snippet} language="json" />
        ) : snippetError ? (
          <Callout tone="danger">Could not load the snippet. Open /api/connector/settings.snippet.json directly.</Callout>
        ) : (
          <Loading />
        )}
      </Card>

      <Card title="4. Optional environment" description="Set per terminal to label your agents.">
        <CodeBlock
          language="bash"
          code={`export CC_USER="you@example.com"   # who you are
export CC_AGENT_NAME="coder-a"     # shows as the agent name
export CC_AGENT_ROLE="coder"       # shows as a role badge`}
        />
      </Card>

      <Card title="5. Waiting for the first event">
        {connected ? (
          <Callout tone="success" title="Connected">
            An agent is reporting for this project. Head to the overview to watch it.
          </Callout>
        ) : (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-waiting" /> Waiting for first event…
          </div>
        )}
      </Card>
    </div>
  );
}
