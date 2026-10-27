import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateProjectToken } from '@/lib/server/tokens';
import { error, json } from '@/lib/server/http';
import { recomputeAgentRequests } from '@/lib/server/status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateProjectToken(req);
  if (!auth) return error(401, 'invalid token');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error(404, 'not found');
  const admin = createAdminClient();
  const { data } = await admin.from('requests').select('*').eq('id', id).maybeSingle();
  if (!data || data.project_id !== auth.project.id) return error(404, 'not found');
  if (data.status !== 'open') return error(409, 'not open', { status: data.status });
  const { data: updated } = await admin
    .from('requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'open')
    .select()
    .maybeSingle();
  if (!updated) return error(409, 'not open');
  await recomputeAgentRequests(admin, data.agent_id);
  return json({ request: updated });
}
