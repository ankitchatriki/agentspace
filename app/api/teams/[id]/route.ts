import { requireUser } from '@/lib/server/auth';
import { error, json, readJson } from '@/lib/server/http';
import { updateTeamSchema } from '@/lib/server/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { supabase, user } = auth;
  const { id } = await params;
  const parsed = await readJson(req, updateTeamSchema, 2 * 1024);
  if (!parsed.ok) return parsed.response;
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member) return error(404, 'not found');
  if (member.role !== 'owner') return error(403, 'only the team owner can rename');
  const { data, error: err } = await supabase.from('teams').update({ name: parsed.data.name }).eq('id', id).select().maybeSingle();
  if (err) return error(400, err.message);
  if (!data) return error(403, 'forbidden');
  return json({ team: data });
}
