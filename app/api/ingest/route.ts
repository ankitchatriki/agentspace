import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateProjectToken } from '@/lib/server/tokens';
import { error, json, readJson } from '@/lib/server/http';
import { ingestSchema } from '@/lib/server/schemas';
import { summarizeHookEvent } from '@/lib/server/summarize';
import { truncatePayload } from '@/lib/server/truncate';
import { applyHookEvent, recomputeAgentRequests } from '@/lib/server/status';
import { upsertAgent } from '@/lib/server/requests';
import type { HookPayload, IngestResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await authenticateProjectToken(req);
  if (!auth) return error(401, 'invalid token');
  const parsed = await readJson(req, ingestSchema, 256 * 1024);
  if (!parsed.ok) return parsed.response;
  const hook = parsed.data.hook as HookPayload;
  const meta = parsed.data.meta ?? { connector_version: "1", sent_at: new Date().toISOString() };
  const { project } = auth;

  try {
    const admin = createAdminClient();
    const agent = await upsertAgent(admin, project, hook.session_id, {
      agent_name: meta.agent_name,
      agent_role: meta.agent_role,
      human: meta.human,
      host: meta.host,
      cwd: meta.cwd ?? hook.cwd,
    });
    if (!agent) return error(500, 'could not resolve agent');

    const redacted = !!meta.redacted;
    const summary = summarizeHookEvent(hook, redacted);
    const patch = applyHookEvent(agent, hook);
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = {
      ...patch,
      last_event_name: hook.hook_event_name,
      last_event_summary: summary,
      last_event_at: nowIso,
      event_count: agent.event_count + 1,
    };
    const merge: Record<string, string | null | undefined> = {
      name: meta.agent_name,
      role: meta.agent_role,
      human: meta.human,
      host: meta.host,
      git_branch: meta.git_branch,
      cwd: meta.cwd ?? hook.cwd,
      transcript_path: hook.transcript_path,
    };
    for (const [k, v] of Object.entries(merge)) if (v) update[k] = v;

    const { error: upErr } = await admin.from('agents').update(update).eq('id', agent.id);
    if (upErr) return error(500, 'agent update failed', upErr.message);

    const { error: evErr } = await admin.from('events').insert({
      team_id: project.team_id,
      project_id: project.id,
      agent_id: agent.id,
      session_id: hook.session_id,
      hook_event_name: hook.hook_event_name,
      tool_name: typeof hook.tool_name === 'string' ? hook.tool_name : null,
      summary,
      payload: truncatePayload(hook),
      human: meta.human ?? agent.human ?? null,
    });
    if (evErr) return error(500, 'event insert failed', evErr.message);

    if (hook.hook_event_name === 'SessionEnd') {
      await admin.from('requests').update({ status: 'cancelled' }).eq('agent_id', agent.id).eq('status', 'open');
      await recomputeAgentRequests(admin, agent.id);
    }

    const status = (patch.status ?? agent.status) as IngestResponse['status'];
    return json({ ok: true, agent_id: agent.id, status } satisfies IngestResponse, 202);
  } catch (e) {
    return error(500, 'internal error', e instanceof Error ? e.message : String(e));
  }
}
