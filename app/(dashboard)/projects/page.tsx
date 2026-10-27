'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Callout, Card, EmptyState, Input, PageHeader, ProjectCard, Select } from '@/components/ui';
import { useProjects } from '@/lib/hooks/useProjects';
import { useAgents } from '@/lib/hooks/useAgents';
import { useTeams } from '@/lib/hooks/useTeams';
import { useOpenRequests } from '@/lib/hooks/useRequests';
import { countByStatus } from '@/lib/client/format';
import * as api from '@/lib/client/api';
import { Loading } from '../_components/Loading';

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, loading, error } = useProjects();
  const { agents } = useAgents();
  const { requests } = useOpenRequests();
  const { teams } = useTeams();

  const [name, setName] = useState('');
  const [repo, setRepo] = useState('');
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const perProject = useMemo(() => {
    const m: Record<string, ReturnType<typeof countByStatus>> = {};
    for (const p of projects) m[p.id] = countByStatus(agents.filter((a) => a.project_id === p.id));
    return m;
  }, [projects, agents]);

  const effectiveTeam = teamId || teams[0]?.id || '';

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !effectiveTeam) return;
    setBusy(true);
    setFormError(null);
    try {
      const { project } = await api.createProject({
        team_id: effectiveTeam,
        name: name.trim(),
        repo_full_name: repo.trim() || null,
      });
      router.push(`/projects/${project.id}/connect`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create project');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Each project gets its own tokens and GitHub webhook." />

      <Card title="New project">
        <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Acme API" />
          <Input
            label="GitHub repo (optional)"
            hint="owner/repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="acme/api"
            pattern="[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+"
          />
          {teams.length > 1 && (
            <Select
              label="Team"
              value={effectiveTeam}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
          )}
          <div className="flex items-end md:col-span-2">
            <Button type="submit" loading={busy} disabled={!name.trim() || !effectiveTeam}>
              Create project
            </Button>
          </div>
          {formError && (
            <div className="md:col-span-2">
              <Callout tone="danger">{formError}</Callout>
            </div>
          )}
        </form>
      </Card>

      {error ? (
        <Callout tone="danger" title="Could not load projects">{error}</Callout>
      ) : loading ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project above, then connect Claude Code to it." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              counts={perProject[p.id]}
              href={`/projects/${p.id}`}
              openRequests={requests.filter((r) => r.project_id === p.id).length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
