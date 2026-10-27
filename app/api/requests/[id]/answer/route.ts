import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { answerSchema } from '@/lib/server/schemas';
import { recomputeAgentRequests } from '@/lib/server/status';
import { expireIfDue } from '@/lib/server/requests';
import type { AgentRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase, user } = auth;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error(404, 'not found');
  const parsed = await readJson(req, answerSchema, 16 * 1024);
  if (!parsed.ok) return parsed.response;

  const nowIso = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from('requests')
    .update({ status: 'answered', answer: parsed.data.answer, answered_by: user.id, answered_at: nowIso })
    .eq('id', id)
    .eq('status', 'open')
    .gt('expires_at', nowIso)
    .select()
    .maybeSingle();
  if (upErr) return error(500, 'update failed', upErr.message);

  const admin = createAdminClient();
  if (!updated) {
    const { data: row } = await supabase.from('requests').select('*').eq('id', id).maybeSingle();
    if (!row) return error(404, 'not found');
    if (row.status === 'open' && new Date(row.expires_at).getTime() <= Date.now()) {
      await expireIfDue(admin, row as AgentRequest);
      return error(410, 'expired');
    }
    return error(409, 'not open', { status: row.status });
  }
  await recomputeAgentRequests(admin, updated.agent_id);
  return json({ request: updated });
}
