import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateProjectToken } from '@/lib/server/tokens';
import { error, json, readJson } from '@/lib/server/http';
import { createRequestSchema } from '@/lib/server/schemas';
import { resolveAgentForAsk } from '@/lib/server/requests';
import { recomputeAgentRequests } from '@/lib/server/status';
import { env } from '@/lib/server/env';
import type { CreateRequestResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await authenticateProjectToken(req);
  if (!auth) return error(401, 'invalid token');
  const parsed = await readJson(req, createRequestSchema, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const b = { ...parsed.data, meta: parsed.data.meta ?? { connector_version: "1", sent_at: new Date().toISOString() } };
  const { project } = auth;

  try {
    const admin = createAdminClient();
    const agent = await resolveAgentForAsk(admin, project, {
      session_id: b.session_id,
      prompt: b.prompt,
      meta: { human: b.meta.human, host: b.meta.host, agent_name: b.meta.agent_name ?? b.asked_by, agent_role: b.meta.agent_role, cwd: b.meta.cwd },
    });
    if (!agent) return error(500, 'could not resolve agent');

    const kind = b.kind ?? 'question';
    let options = b.options ?? [];
    if (kind === 'approval' && options.length === 0) options = ['Approve', 'Reject'];
    const expiresAt = new Date(Date.now() + (b.expires_in_sec ?? 86400) * 1000).toISOString();

    const { data, error: insErr } = await admin
      .from('requests')
      .insert({
        team_id: project.team_id,
        project_id: project.id,
        agent_id: agent.id,
        session_id: agent.session_id,
        asked_by: b.asked_by ?? b.meta.agent_name ?? agent.name ?? null,
        kind,
        prompt: b.prompt,
        context: b.context ?? null,
        options,
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single();
    if (insErr || !data) return error(500, 'insert failed', insErr?.message);
    await recomputeAgentRequests(admin, agent.id);

    const body: CreateRequestResponse = {
      id: data.id,
      status: 'open',
      agent_id: agent.id,
      expires_at: data.expires_at,
      url: `${env.appUrl}/inbox#req-${data.id}`,
    };
    return json(body, 201);
  } catch (e) {
    return error(500, 'internal error', e instanceof Error ? e.message : String(e));
  }
}
