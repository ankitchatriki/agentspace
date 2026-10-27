import { requireUser } from '@/lib/server/auth';
import { error, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase } = auth;
  const { id } = await params;
  const { data, error: err } = await supabase.rpc('rotate_invite_code', { p_team: id });
  if (err) {
    if (err.code === '42501') return error(403, 'only the team owner can rotate the invite code');
    return error(400, err.message);
  }
  return json({ invite_code: data as string });
}
