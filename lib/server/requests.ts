import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Agent, AgentRequest, ConnectorMeta, Project } from '@/lib/types';
import { recomputeAgentRequests } from './status';

export async function upsertAgent(
  admin: SupabaseClient,
  project: Project,
  sessionId: string,
  meta?: Partial<ConnectorMeta> | null,
): Promise<Agent | null> {
  const find = () =>
    admin.from('agents').select('*').eq('project_id', project.id).eq('session_id', sessionId).maybeSingle();
  const first = await find();
  if (first.data) return first.data as Agent;
  await admin.from('agents').upsert(
    {
      team_id: project.team_id,
      project_id: project.id,
      session_id: sessionId,
      name: meta?.agent_name ?? null,
      role: meta?.agent_role ?? null,
      human: meta?.human ?? null,
      host: meta?.host ?? null,
      cwd: meta?.cwd ?? null,
    },
    { onConflict: 'project_id,session_id', ignoreDuplicates: true },
  );
  const second = await find();
  return (second.data as Agent | null) ?? null;
}

export async function resolveAgentForAsk(
  admin: SupabaseClient,
  project: Project,
  body: { session_id?: string | null; prompt: string; meta?: Partial<ConnectorMeta> | null },
): Promise<Agent | null> {
  if (body.session_id) return upsertAgent(admin, project, body.session_id, body.meta);

  const since = new Date(Date.now() - 120_000).toISOString();
  const { data: events } = await admin
    .from('events')
    .select('agent_id, payload, created_at')
    .eq('project_id', project.id)
    .eq('hook_event_name', 'PreToolUse')
    .eq('tool_name', 'Bash')
    .gt('created_at', since)
    .ilike('payload->tool_input->>command', '%cc-ask%')
    .order('created_at', { ascending: false })
    .limit(5);
  if (events && events.length) {
    const head = body.prompt.slice(0, 30);
    const match =
      events.find((e) => {
        const cmd = ((e.payload as { tool_input?: { command?: string } })?.tool_input?.command ?? '') as string;
        return head && cmd.includes(head);
      }) ?? events[0];
    const { data: agent } = await admin.from('agents').select('*').eq('id', match.agent_id).maybeSingle();
    if (agent) return agent as Agent;
  }

  const sid = `adhoc:${body.meta?.human ?? 'unknown'}:${body.meta?.host ?? 'host'}`;
  return upsertAgent(admin, project, sid, body.meta);
}

/** If the request is open but past expires_at, mark it expired. Returns the (possibly updated) request. */
export async function expireIfDue(admin: SupabaseClient, request: AgentRequest): Promise<AgentRequest> {
  if (request.status !== 'open' || new Date(request.expires_at).getTime() > Date.now()) return request;
  const { data } = await admin
    .from('requests')
    .update({ status: 'expired' })
    .eq('id', request.id)
    .eq('status', 'open')
    .select()
    .maybeSingle();
  await recomputeAgentRequests(admin, request.agent_id);
  return (data as AgentRequest | null) ?? { ...request, status: 'expired' };
}
