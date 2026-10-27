import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateProjectToken } from '@/lib/server/tokens';
import { error, json } from '@/lib/server/http';
import { expireIfDue } from '@/lib/server/requests';
import type { AgentRequest, RequestPollResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateProjectToken(req);
  if (!auth) return error(401, 'invalid token');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error(404, 'not found');
  const admin = createAdminClient();
  const { data } = await admin.from('requests').select('*').eq('id', id).maybeSingle();
  if (!data || data.project_id !== auth.project.id) return error(404, 'not found');
  const r = await expireIfDue(admin, data as AgentRequest);

  let name: string | null = null;
  if (r.answered_by) {
    const { data: p } = await admin.from('profiles').select('display_name').eq('id', r.answered_by).maybeSingle();
    name = p?.display_name ?? null;
  }
  const body: RequestPollResponse = {
    id: r.id,
    status: r.status,
    kind: r.kind,
    answer: r.answer,
    answered_by_name: name,
    answered_at: r.answered_at,
    expires_at: r.expires_at,
  };
  return json(body, 200, { 'Cache-Control': 'no-store' });
}
