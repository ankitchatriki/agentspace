'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AgentCard,
  Button,
  Callout,
  Card,
  CopyField,
  EmptyState,
  GithubEventItem,
  Input,
  PageHeader,
  RequestCard,
  TokenRow,
} from '@/components/ui';
import { useProjects } from '@/lib/hooks/useProjects';
import { useAgents } from '@/lib/hooks/useAgents';
import { useRequests } from '@/lib/hooks/useRequests';
import { useGithubEvents } from '@/lib/hooks/useGithubEvents';
import { useSupabase } from '@/lib/hooks/useSupabase';
import { sortAgents } from '@/lib/client/format';
import * as api from '@/lib/client/api';
import type { ProjectToken, WebhookSecretResponse } from '@/lib/types';
import { Loading } from '../../_components/Loading';
import { useRequestActions } from '../../_components/useRequestActions';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useSupabase();
  const { byId, loading: projLoading, reload } = useProjects();
  const project = byId[id];
  const { agents, loading: agentsLoading } = useAgents({ projectId: id });
  const { requests, loading: reqLoading } = useRequests({ projectId: id, limit: 50 });
  const { events, loading: ghLoading } = useGithubEvents({ projectId: id, limit: 30 });
  const actions = useRequestActions();

  const [tokens, setTokens] = useState<ProjectToken[]>([]);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [secret, setSecret] = useState<WebhookSecretResponse | null>(null);
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setRepo(project.repo_full_name ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const loadTokens = useCallback(async () => {
    const { data, error } = await supabase
      .from('project_tokens')
      .select('id, team_id, project_id, label, token_prefix, created_by, created_at, last_used_at, revoked_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false });
    if (error) setTokensError(error.message);
    else {
      setTokensError(null);
      setTokens((data ?? []) as ProjectToken[]);
    }
  }, [supabase, id]);
  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  if (projLoading) return <Loading />;
  if (!project)
    return (
      <EmptyState
        title="Project not found"
        description="It may have been deleted, or you do not have access."
        action={<Link href="/projects"><Button variant="secondary">Back to projects</Button></Link>}
      />
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateProject(id, { name: name.trim(), repo_full_name: repo.trim() || null });
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function genSecret() {
    setSecretBusy(true);
    setSecretError(null);
    try {
      setSecret(await api.createWebhookSecret(id));
      await reload();
    } catch (err) {
      setSecretError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSecretBusy(false);
    }
  }

  async function revoke(tokenId: string) {
    setRevoking(tokenId);
    try {
      await api.revokeToken(id, tokenId);
      await loadTokens();
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete project "${project.name}" and all its agents, events and requests?`)) return;
    setDeleting(true);
    try {
      await api.deleteProject(id);
      router.push('/projects');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ href: '/projects', label: 'Projects' }]}
        title={project.name}
        description={project.repo_full_name ?? 'No repository linked'}
        actions={
          <>
            <Link href={`/projects/${id}/connect`}>
              <Button variant="secondary">Connect</Button>
            </Link>
            <Button variant="danger" onClick={remove} loading={deleting}>
              Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Agents" description="Live">
          {agentsLoading ? (
            <Loading />
          ) : agents.length === 0 ? (
            <p className="text-sm text-fg-muted">No agents yet. Connect Claude Code to this project.</p>
          ) : (
            <div className="space-y-3">
              {sortAgents(agents).map((a) => (
                <AgentCard key={a.id} agent={a} href={`/agents/${a.id}`} showProject={false} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Requests">
          {reqLoading ? (
            <Loading />
          ) : requests.length === 0 ? (
            <p className="text-sm text-fg-muted">No requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  agentHref={r.agent ? `/agents/${r.agent.id}` : undefined}
                  busy={actions.busy[r.id]}
                  error={actions.errors[r.id]}
                  onAnswer={(t) => actions.answer(r.id, t)}
                  onDismiss={() => actions.dismiss(r.id)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card title="GitHub activity">
          {ghLoading ? (
            <Loading />
          ) : events.length === 0 ? (
            <p className="text-sm text-fg-muted">No GitHub events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <GithubEventItem key={e.id} event={e} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Settings">
        <div className="space-y-8">
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            <Input label="GitHub repo" hint="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <div className="md:col-span-2">
              <Button type="submit" loading={saving} disabled={!name.trim()}>
                Save
              </Button>
            </div>
            {saveError && (
              <div className="md:col-span-2">
                <Callout tone="danger">{saveError}</Callout>
              </div>
            )}
          </form>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">GitHub webhook</h3>
            <p className="text-sm text-fg-muted">
              {project.github_webhook_configured
                ? 'A webhook secret exists. Generating a new one rotates it.'
                : 'Generate a secret, then add a webhook in your GitHub repo.'}
            </p>
            <Button variant="secondary" onClick={genSecret} loading={secretBusy} disabled={!project.repo_full_name}>
              Generate webhook secret
            </Button>
            {!project.repo_full_name && <p className="text-xs text-fg-subtle">Set a repository above first.</p>}
            {secretError && <Callout tone="danger">{secretError}</Callout>}
            {secret && (
              <div className="space-y-3">
                <Callout tone="warning" title="Shown once">Copy the secret now. It cannot be displayed again.</Callout>
                <CopyField label="Payload URL" value={secret.webhook_url} mono />
                <CopyField label="Secret" value={secret.secret} secret mono />
                <p className="text-xs text-fg-muted">
                  In GitHub: repo Settings, Webhooks, Add webhook. Content type application/json. Events: pushes, pull
                  requests, pull request reviews, issue comments, workflow runs.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Tokens</h3>
              <Link href={`/projects/${id}/connect`} className="text-xs text-accent hover:underline">
                Create token
              </Link>
            </div>
            {tokensError && <Callout tone="danger">{tokensError}</Callout>}
            {tokens.length === 0 ? (
              <p className="text-sm text-fg-muted">No tokens yet.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((t) => (
                  <TokenRow key={t.id} token={t} busy={revoking === t.id} onRevoke={() => revoke(t.id)} />
                ))}
              </div>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}
