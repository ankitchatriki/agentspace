import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/server/auth';
import { error, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; tokenId: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const { id, tokenId } = await params;
  const { data: tok } = await supabase
    .from('project_tokens')
    .select('id')
    .eq('id', tokenId)
    .eq('project_id', id)
    .maybeSingle();
  if (!tok) return error(404, 'not found');
  const admin = createAdminClient();
  const { error: err } = await admin
    .from('project_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('revoked_at', null);
  if (err) return error(500, err.message);
  return json({ ok: true });
}
