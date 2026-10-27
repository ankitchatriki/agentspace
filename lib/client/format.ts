import {
  AGENT_STATUSES,
  emptyStatusCounts,
  type AgentStatus,
  type AgentWithProject,
  type StatusCounts,
} from '@/lib/types';

const RANK = Object.fromEntries(AGENT_STATUSES.map((s, i) => [s, i])) as Record<AgentStatus, number>;

export function sortAgents(agents: AgentWithProject[]): AgentWithProject[] {
  return agents
    .slice()
    .sort(
      (a, b) =>
        RANK[a.status] - RANK[b.status] || new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime(),
    );
}

export function countByStatus(agents: Pick<AgentWithProject, 'status'>[]): StatusCounts {
  const c = emptyStatusCounts();
  for (const a of agents) c[a.status] += 1;
  return c;
}

export interface AgentGroupData {
  key: string;
  title: string;
  projectId?: string;
  agents: AgentWithProject[];
}

export function groupAgents(agents: AgentWithProject[], by: 'project' | 'human'): AgentGroupData[] {
  const map = new Map<string, AgentGroupData>();
  for (const a of sortAgents(agents)) {
    const key = by === 'project' ? a.project_id : a.human ?? 'unknown';
    const title = by === 'project' ? a.project?.name ?? 'Unknown project' : a.human ?? 'Unknown';
    let g = map.get(key);
    if (!g) {
      g = { key, title, projectId: by === 'project' ? a.project_id : undefined, agents: [] };
      map.set(key, g);
    }
    g.agents.push(a);
  }
  const rank = (g: AgentGroupData) => Math.min(...g.agents.map((a) => RANK[a.status]));
  return Array.from(map.values()).sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
